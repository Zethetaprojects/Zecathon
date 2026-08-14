from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.database import get_db
from app.models import Hackathon, ProblemStatement, User
from app.schemas import HackathonCreate, HackathonOut, HackathonDetail, ProblemStatementOut
from app.services.file_storage import save_upload

router = APIRouter()


@router.get("", response_model=List[HackathonOut])
async def list_hackathons(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Hackathon).order_by(Hackathon.created_at.desc()).all()


@router.post("", response_model=HackathonOut, status_code=status.HTTP_201_CREATED)
async def create_hackathon(
    payload: HackathonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hackathon = Hackathon(
        name=payload.name,
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date,
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


@router.post("/{hackathon_id}/problem-statements", response_model=ProblemStatementOut, status_code=status.HTTP_201_CREATED)
async def create_problem_statement(
    hackathon_id: int,
    title: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if hackathon.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the hackathon organiser can add problem statements")

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
