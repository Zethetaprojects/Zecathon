from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.database import get_db
from app.models import Hackathon, Team, TeamMember, User
from app.schemas import TeamCreate, TeamOut

router = APIRouter()


def _user_team_in_hackathon(user_id: int, hackathon_id: int, db: Session) -> Team | None:
    return (
        db.query(Team)
        .join(TeamMember)
        .filter(Team.hackathon_id == hackathon_id, TeamMember.user_id == user_id)
        .first()
    )


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == payload.hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if _user_team_in_hackathon(current_user.id, payload.hackathon_id, db):
        raise HTTPException(status_code=400, detail="You are already in a team for this hackathon")

    team = Team(hackathon_id=payload.hackathon_id, name=payload.name)
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=current_user.id, role="leader"))
    db.commit()
    db.refresh(team)
    return team


@router.get("", response_model=List[TeamOut])
async def list_teams(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return db.query(Team).filter(Team.hackathon_id == hackathon_id).order_by(Team.created_at.desc()).all()


@router.get("/{team_id}", response_model=TeamOut)
async def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.post("/{team_id}/join", response_model=TeamOut)
async def join_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if _user_team_in_hackathon(current_user.id, team.hackathon_id, db):
        raise HTTPException(status_code=400, detail="You are already in a team for this hackathon")
    db.add(TeamMember(team_id=team_id, user_id=current_user.id, role="member"))
    db.commit()
    db.refresh(team)
    return team
