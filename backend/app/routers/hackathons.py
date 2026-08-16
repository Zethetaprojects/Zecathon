from datetime import datetime, timedelta
from typing import List

import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_active_user, require_permission
from app.database import get_db
from app.models import Hackathon, ProblemStatement, Team, User, UserRole
from app.routers.common import can_access_hackathon, can_manage_hackathon
from app.schemas import (
    HackathonCreate,
    HackathonOut,
    HackathonDetail,
    HackathonPublicOut,
    HackathonPublicStats,
    HackathonUpdate,
    ProblemStatementOut,
)
from app.services.file_storage import save_upload

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


def _hackathon_counts(db: Session, hackathon: Hackathon) -> dict:
    return {
        "problem_statement_count": db.query(func.count(ProblemStatement.id))
        .filter(ProblemStatement.hackathon_id == hackathon.id)
        .scalar()
        or 0,
        "team_count": db.query(func.count(Team.id)).filter(Team.hackathon_id == hackathon.id).scalar() or 0,
    }


@router.get("", response_model=List[HackathonOut])
async def list_hackathons(
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
async def create_hackathon(
    payload: HackathonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_hackathon")),
):
    end_date = _compute_end_date(payload.start_date, payload.duration_hours, payload.end_date)
    hackathon = Hackathon(
        name=payload.name,
        description=payload.description,
        start_date=payload.start_date,
        end_date=end_date,
        duration_hours=payload.duration_hours,
        rubric=payload.rubric,
        max_participants=payload.max_participants,
        max_team_members=payload.max_team_members,
        created_by=current_user.id,
    )
    db.add(hackathon)
    db.commit()
    db.refresh(hackathon)
    logger.info("Hackathon created id=%s name=%s by user id=%s", hackathon.id, hackathon.name, current_user.id)
    return hackathon


@router.get("/public", response_model=List[HackathonPublicOut])
async def list_public_hackathons(db: Session = Depends(get_db)):
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
                **counts,
            )
        )
    return result


@router.get("/public/stats", response_model=HackathonPublicStats)
async def public_hackathon_stats(db: Session = Depends(get_db)):
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


@router.get("/{hackathon_id}", response_model=HackathonDetail)
async def get_hackathon(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_access_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied access to hackathon id=%s owned by %s", current_user.id, current_user.role, hackathon_id, hackathon.created_by)
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    return hackathon


@router.put("/{hackathon_id}", response_model=HackathonOut)
async def update_hackathon(
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
    if payload.rubric is not None:
        hackathon.rubric = payload.rubric
    if payload.max_participants is not None:
        hackathon.max_participants = payload.max_participants
    if payload.max_team_members is not None:
        hackathon.max_team_members = payload.max_team_members

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


@router.post("/{hackathon_id}/problem-statements", response_model=ProblemStatementOut, status_code=status.HTTP_201_CREATED)
async def create_problem_statement(
    hackathon_id: int,
    title: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_problem_statements")),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_manage_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied problem statement creation on hackathon id=%s", current_user.id, current_user.role, hackathon_id)
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can add problem statements")

    file_path = None
    if file:
        file_path = await save_upload(file)

    ps = ProblemStatement(
        hackathon_id=hackathon_id,
        title=title,
        description=description,
        file_path=file_path,
    )
    db.add(ps)
    db.commit()
    db.refresh(ps)
    logger.info("Problem statement created id=%s hackathon_id=%s by user id=%s", ps.id, hackathon_id, current_user.id)
    return ps


@router.delete("/{hackathon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hackathon(
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
