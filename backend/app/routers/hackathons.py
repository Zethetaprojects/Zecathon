from datetime import datetime, timedelta
from typing import List

import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_active_user, require_permission
from app.database import get_db
from app.models import Hackathon, ProblemStatement, Team, TeamMember, User, UserRole
from app.routers.common import (
    can_access_hackathon,
    can_manage_hackathon,
    can_see_problem_statements,
    hackathon_not_started,
    team_out,
)
from app.schemas import (
    HackathonCreate,
    HackathonOut,
    HackathonDetail,
    HackathonPublicDetail,
    HackathonPublicOut,
    HackathonPublicStats,
    PublicProblemStatement,
    slugify,
    HackathonUpdate,
    ProblemStatementOut,
)
from app.services.file_storage import save_upload
from app.routers.common import parse_rubric_form

router = APIRouter()
logger = logging.getLogger(__name__)


def _compute_end_date(
    start_date: datetime | None,
    duration_hours: int | None,
    end_date: datetime | None,
) -> datetime | None:
    if start_date and duration_hours is not None:
        return start_date + timedelta(hours=duration_hours)
    return end_date


def _check_deadline(start_date: datetime | None, deadline: datetime | None) -> None:
    if start_date and deadline and deadline <= start_date:
        raise HTTPException(status_code=400, detail="The submission deadline must be after the hackathon start time")


def _next_partner_number(db: Session, slug: str, exclude_id: int | None = None) -> int:
    query = db.query(func.max(Hackathon.partner_number)).filter(Hackathon.partner_slug == slug)
    if exclude_id is not None:
        query = query.filter(Hackathon.id != exclude_id)
    return (query.scalar() or 0) + 1


def _set_partner(db: Session, hackathon: Hackathon, name: str | None, slug: str | None, website: str | None) -> None:
    """Set (or clear) the partner. A new partner URL name gets the next number for that partner."""
    if not name:
        hackathon.partner_name = hackathon.partner_slug = hackathon.partner_website = None
        hackathon.partner_number = None
        hackathon.partner_logo_path = None
        return
    slug = slug or hackathon.partner_slug or slugify(name)
    if not slug or len(slug) < 2:
        raise HTTPException(status_code=400, detail="Give the partner a URL name, e.g. iit-patna")
    if slug != hackathon.partner_slug or hackathon.partner_number is None:
        hackathon.partner_number = _next_partner_number(db, slug, exclude_id=hackathon.id)
    hackathon.partner_name, hackathon.partner_slug, hackathon.partner_website = name, slug, website


def _public_detail(db: Session, hackathon: Hackathon) -> HackathonPublicDetail:
    started = not hackathon_not_started(hackathon)
    counts = _hackathon_counts(db, hackathon)
    return HackathonPublicDetail(
        **{
            field: getattr(hackathon, field)
            for field in (
                "id", "name", "description", "start_date", "end_date", "duration_hours", "banner_path",
                "submission_deadline", "partner_name", "partner_slug", "partner_number", "partner_logo_path",
                "partner_website", "submission_guidelines", "one_statement_per_team", "max_team_members",
            )
        },
        **counts,
        problem_statements=[PublicProblemStatement.model_validate(ps) for ps in hackathon.problem_statements] if started else [],
        problem_statements_hidden=not started and bool(hackathon.problem_statements),
    )


def _hackathon_counts(db: Session, hackathon: Hackathon) -> dict:
    return {
        "problem_statement_count": db.query(func.count(ProblemStatement.id))
        .filter(ProblemStatement.hackathon_id == hackathon.id)
        .scalar()
        or 0,
        "team_count": db.query(func.count(Team.id)).filter(Team.hackathon_id == hackathon.id).scalar() or 0,
    }


@router.get("", response_model=List[HackathonOut])
def list_hackathons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hacks = db.query(Hackathon).order_by(Hackathon.created_at.desc()).all()
    # Organizers only see hackathons they created; admins and participants see everything.
    if current_user.role == UserRole.organizer:
        hacks = [h for h in hacks if h.created_by == current_user.id]
    result = []
    for h in hacks:
        counts = _hackathon_counts(db, h)
        result.append(HackathonOut.model_validate(h).model_copy(update=counts))
    return result


@router.post("", response_model=HackathonOut, status_code=status.HTTP_201_CREATED)
def create_hackathon(
    payload: HackathonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_hackathon")),
):
    end_date = _compute_end_date(payload.start_date, payload.duration_hours, payload.end_date)
    _check_deadline(payload.start_date, payload.submission_deadline)
    hackathon = Hackathon(
        name=payload.name,
        description=payload.description,
        start_date=payload.start_date,
        end_date=end_date,
        duration_hours=payload.duration_hours,
        rubric=payload.rubric,
        max_participants=payload.max_participants,
        max_team_members=payload.max_team_members,
        submission_deadline=payload.submission_deadline,
        submission_guidelines=payload.submission_guidelines,
        one_statement_per_team=bool(payload.one_statement_per_team),
        created_by=current_user.id,
    )
    if payload.partner_name:
        _set_partner(db, hackathon, payload.partner_name, payload.partner_slug, payload.partner_website)
    db.add(hackathon)
    db.commit()
    db.refresh(hackathon)
    logger.info("Hackathon created id=%s name=%s by user id=%s", hackathon.id, hackathon.name, current_user.id)
    return hackathon


@router.get("/public", response_model=List[HackathonPublicOut])
def list_public_hackathons(db: Session = Depends(get_db)):
    """Return upcoming/active hackathons for the public landing page."""
    now = datetime.utcnow()
    hacks = (
        db.query(Hackathon)
        .filter((Hackathon.end_date == None) | (Hackathon.end_date >= now))
        .order_by(Hackathon.start_date.asc().nulls_last())
        .all()
    )
    result = []
    for h in hacks:
        counts = _hackathon_counts(db, h)
        result.append(
            HackathonPublicOut(
                id=h.id,
                name=h.name,
                description=h.description,
                start_date=h.start_date,
                end_date=h.end_date,
                duration_hours=h.duration_hours,
                banner_path=h.banner_path,
                submission_deadline=h.submission_deadline,
                partner_name=h.partner_name,
                partner_slug=h.partner_slug,
                partner_number=h.partner_number,
                partner_logo_path=h.partner_logo_path,
                **counts,
            )
        )
    return result


@router.get("/public/stats", response_model=HackathonPublicStats)
def public_hackathon_stats(db: Session = Depends(get_db)):
    from app.models import Submission, Evaluation

    total_hackathons = db.query(func.count(Hackathon.id)).scalar() or 0
    total_teams = db.query(func.count(Team.id)).scalar() or 0
    total_submissions = db.query(func.count(Submission.id)).scalar() or 0
    total_evaluations = db.query(func.count(Evaluation.id)).scalar() or 0
    return {
        "total_hackathons": total_hackathons,
        "total_teams": total_teams,
        "total_submissions": total_submissions,
        "total_evaluations": total_evaluations,
    }


@router.get("/public/partner/{partner_slug}/{partner_number}", response_model=HackathonPublicDetail)
def get_public_hackathon_by_partner(partner_slug: str, partner_number: int, db: Session = Depends(get_db)):
    """A partner hackathon by its URL, e.g. /hackathons/iit-patna/1. No login needed."""
    hackathon = (
        db.query(Hackathon)
        .options(selectinload(Hackathon.problem_statements))
        .filter(Hackathon.partner_slug == partner_slug.lower(), Hackathon.partner_number == partner_number)
        .first()
    )
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    return _public_detail(db, hackathon)


@router.get("/public/{hackathon_id}", response_model=HackathonPublicDetail)
def get_public_hackathon(hackathon_id: int, db: Session = Depends(get_db)):
    """The public view of a hackathon: no login needed, no teams or scores."""
    hackathon = (
        db.query(Hackathon).options(selectinload(Hackathon.problem_statements)).filter(Hackathon.id == hackathon_id).first()
    )
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    return _public_detail(db, hackathon)


@router.get("/{hackathon_id}", response_model=HackathonDetail)
def get_hackathon(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Load teams, members, their users and statement submissions in a few batched
    # queries; lazy loading issued ~4 queries per team (≈700 for 170 teams).
    hackathon = (
        db.query(Hackathon)
        .options(
            selectinload(Hackathon.teams).selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Hackathon.problem_statements).selectinload(ProblemStatement.submissions),
        )
        .filter(Hackathon.id == hackathon_id)
        .first()
    )
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_access_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied access to hackathon id=%s owned by %s", current_user.id, current_user.role, hackathon_id, hackathon.created_by)
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    detail = HackathonDetail.model_validate(hackathon)
    update = {
        "teams": [team_out(t, current_user, hackathon) for t in hackathon.teams],
        "problem_statement_count": len(hackathon.problem_statements),
        "team_count": len(hackathon.teams),
    }
    if not can_see_problem_statements(current_user, hackathon):
        # The count stays visible ("4 problem statements unlock at the start").
        update.update(problem_statements=[], problem_statements_hidden=bool(hackathon.problem_statements))
    return detail.model_copy(update=update)


@router.put("/{hackathon_id}", response_model=HackathonOut)
def update_hackathon(
    hackathon_id: int,
    payload: HackathonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_hackathon")),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_manage_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied update on hackathon id=%s owned by %s", current_user.id, current_user.role, hackathon_id, hackathon.created_by)
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can update this hackathon")

    if payload.name is not None:
        hackathon.name = payload.name
    if payload.description is not None:
        hackathon.description = payload.description
    if payload.start_date is not None:
        hackathon.start_date = payload.start_date
    if payload.duration_hours is not None:
        hackathon.duration_hours = payload.duration_hours
    if payload.end_date is not None:
        hackathon.end_date = payload.end_date
    # An explicit null (or {}) resets the rubric to the platform defaults.
    if "rubric" in payload.model_fields_set:
        hackathon.rubric = payload.rubric
    # Limits can be cleared by sending an explicit null.
    if "max_participants" in payload.model_fields_set:
        hackathon.max_participants = payload.max_participants
    if "max_team_members" in payload.model_fields_set:
        hackathon.max_team_members = payload.max_team_members

    partner_fields = {"partner_name", "partner_slug", "partner_website"}
    if partner_fields & payload.model_fields_set:
        name = payload.partner_name if "partner_name" in payload.model_fields_set else hackathon.partner_name
        slug = payload.partner_slug if "partner_slug" in payload.model_fields_set else None
        website = payload.partner_website if "partner_website" in payload.model_fields_set else hackathon.partner_website
        _set_partner(db, hackathon, name, slug, website)

    if "submission_guidelines" in payload.model_fields_set:
        hackathon.submission_guidelines = payload.submission_guidelines
    if payload.one_statement_per_team is not None:
        hackathon.one_statement_per_team = payload.one_statement_per_team

    # An explicit null removes the deadline.
    if "submission_deadline" in payload.model_fields_set:
        hackathon.submission_deadline = payload.submission_deadline
    _check_deadline(hackathon.start_date, hackathon.submission_deadline)

    # Recompute end_date whenever scheduling inputs change.
    hackathon.end_date = _compute_end_date(hackathon.start_date, hackathon.duration_hours, hackathon.end_date)

    db.commit()
    db.refresh(hackathon)
    logger.info("Hackathon updated id=%s by user id=%s", hackathon.id, current_user.id)
    return hackathon


@router.post("/{hackathon_id}/banner", response_model=HackathonOut)
async def upload_hackathon_banner(
    hackathon_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_hackathon")),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_manage_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied banner upload on hackathon id=%s owned by %s", current_user.id, current_user.role, hackathon_id, hackathon.created_by)
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can upload a banner")

    banner_path = await save_upload(file)
    hackathon.banner_path = banner_path
    db.commit()
    db.refresh(hackathon)
    logger.info("Banner uploaded for hackathon id=%s by user id=%s", hackathon.id, current_user.id)
    return hackathon


@router.post("/{hackathon_id}/partner-logo", response_model=HackathonOut)
async def upload_partner_logo(
    hackathon_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_hackathon")),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_manage_hackathon(current_user, hackathon):
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can change the partner logo")
    if not hackathon.partner_name:
        raise HTTPException(status_code=400, detail="Add a partner before uploading its logo")
    if not (file.filename or "").lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
        raise HTTPException(status_code=400, detail="Partner logo must be a PNG, JPG, GIF or WebP image")
    hackathon.partner_logo_path = await save_upload(file)
    db.commit()
    db.refresh(hackathon)
    logger.info("Partner logo uploaded for hackathon id=%s by user id=%s", hackathon.id, current_user.id)
    return hackathon


@router.post("/{hackathon_id}/problem-statements", response_model=ProblemStatementOut, status_code=status.HTTP_201_CREATED)
async def create_problem_statement(
    hackathon_id: int,
    title: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(None),
    rubric: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_problem_statements")),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_manage_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied problem statement creation on hackathon id=%s", current_user.id, current_user.role, hackathon_id)
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can add problem statements")

    statement_rubric = parse_rubric_form(rubric)
    file_path = None
    if file:
        file_path = await save_upload(file)

    ps = ProblemStatement(
        hackathon_id=hackathon_id,
        title=title,
        description=description,
        file_path=file_path,
        rubric=statement_rubric,
    )
    db.add(ps)
    db.commit()
    db.refresh(ps)
    logger.info("Problem statement created id=%s hackathon_id=%s by user id=%s", ps.id, hackathon_id, current_user.id)
    return ps


@router.delete("/{hackathon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hackathon(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delete_hackathon")),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_manage_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied delete on hackathon id=%s owned by %s", current_user.id, current_user.role, hackathon_id, hackathon.created_by)
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can delete this hackathon")

    logger.info("Deleting hackathon id=%s name=%s by user id=%s", hackathon.id, hackathon.name, current_user.id)
    # Explicitly delete children in dependency order to keep reports/leaderboard consistent.
    teams = db.query(Team).filter(Team.hackathon_id == hackathon_id).all()
    for team in teams:
        for submission in team.submissions:
            if submission.evaluation:
                db.delete(submission.evaluation)
            db.delete(submission)
        for member in team.members:
            db.delete(member)
        db.delete(team)

    problem_statements = db.query(ProblemStatement).filter(ProblemStatement.hackathon_id == hackathon_id).all()
    for ps in problem_statements:
        db.delete(ps)

    db.delete(hackathon)
    db.commit()
    logger.info("Hackathon id=%s deleted by user id=%s", hackathon_id, current_user.id)
    return None
