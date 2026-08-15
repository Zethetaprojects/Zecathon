from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session, contains_eager

from app.auth import get_current_active_user, require_organizer
from app.database import get_db
from app.models import Evaluation, Hackathon, ProblemStatement, Submission, Team, TeamMember, User, UserRole
from app.schemas import HackathonCreate, HackathonOut, HackathonDetail, HackathonUpdate, ProblemStatementOut
from app.services.file_storage import save_upload

router = APIRouter()


@router.get("", response_model=List[HackathonOut])
async def list_hackathons(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    hacks = db.query(Hackathon).order_by(Hackathon.created_at.desc()).all()
    result = []
    for h in hacks:
        ps_count = db.query(func.count(ProblemStatement.id)).filter(ProblemStatement.hackathon_id == h.id).scalar()
        team_count = db.query(func.count(Team.id)).filter(Team.hackathon_id == h.id).scalar()
        result.append(
            HackathonOut(
                id=h.id,
                name=h.name,
                description=h.description,
                start_date=h.start_date,
                end_date=h.end_date,
                rubric=h.rubric,
                created_by=h.created_by,
                created_at=h.created_at,
                problem_statement_count=ps_count or 0,
                team_count=team_count or 0,
            )
        )
    return result


@router.post("", response_model=HackathonOut, status_code=status.HTTP_201_CREATED)
async def create_hackathon(
    payload: HackathonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    hackathon = Hackathon(
        name=payload.name,
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date,
        rubric=payload.rubric,
        created_by=current_user.id,
    )
    db.add(hackathon)
    db.commit()
    db.refresh(hackathon)
    return hackathon


@router.get("/{hackathon_id}", response_model=HackathonDetail)
async def get_hackathon(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    return hackathon


@router.put("/{hackathon_id}", response_model=HackathonOut)
async def update_hackathon(
    hackathon_id: int,
    payload: HackathonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if current_user.role != UserRole.admin and hackathon.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can update this hackathon")

    if payload.name is not None:
        hackathon.name = payload.name
    if payload.description is not None:
        hackathon.description = payload.description
    if payload.start_date is not None:
        hackathon.start_date = payload.start_date
    if payload.end_date is not None:
        hackathon.end_date = payload.end_date
    if payload.rubric is not None:
        hackathon.rubric = payload.rubric

    db.commit()
    db.refresh(hackathon)
    return hackathon


@router.post("/{hackathon_id}/problem-statements", response_model=ProblemStatementOut, status_code=status.HTTP_201_CREATED)
async def create_problem_statement(
    hackathon_id: int,
    title: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if hackathon.created_by != current_user.id and current_user.role != UserRole.admin:
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
    return ps


@router.delete("/{hackathon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hackathon(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if current_user.role != UserRole.admin and hackathon.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can delete this hackathon")

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
    return None
