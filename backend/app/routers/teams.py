from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_active_user, require_organizer, require_participant
from app.database import get_db
from app.models import Evaluation, Hackathon, Submission, Team, TeamMember, User, UserRole
from app.schemas import TeamCreate, TeamOut

router = APIRouter()


def _is_manager(user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.organizer)


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

    if current_user.role not in (UserRole.participant, UserRole.admin, UserRole.organizer):
        raise HTTPException(status_code=403, detail="Only participants, organizers, or admins can create teams")

    if not _is_manager(current_user) and _user_team_in_hackathon(current_user.id, payload.hackathon_id, db):
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
    current_user: User = Depends(require_participant),
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


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    hackathon = db.query(Hackathon).filter(Hackathon.id == team.hackathon_id).first()
    if current_user.role != UserRole.admin and hackathon.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can delete this team")

    # Delete submissions and evaluations first to avoid FK/ORM cascade conflicts
    for submission in team.submissions:
        if submission.evaluation:
            db.delete(submission.evaluation)
        db.delete(submission)
    for member in team.members:
        db.delete(member)
    db.delete(team)
    db.commit()
    return None
