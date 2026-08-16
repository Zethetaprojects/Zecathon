import secrets
import string
from typing import List

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_active_user, require_permission
from app.database import get_db
from app.models import Hackathon, Submission, Team, TeamMember, User, UserRole
from app.routers.common import can_access_hackathon, can_manage_hackathon
from app.schemas import TeamCreate, TeamJoinByCode, TeamMemberAdd, TeamMemberUpdate, TeamOut

router = APIRouter()
logger = logging.getLogger(__name__)

_JOIN_CODE_ALPHABET = string.ascii_uppercase + string.digits
_JOIN_CODE_ALPHABET = _JOIN_CODE_ALPHABET.replace("O", "").replace("I", "")  # avoid ambiguous chars
_JOIN_CODE_LENGTH = 8


def _is_manager(user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.organizer)


def _is_team_leader(user: User, team: Team) -> bool:
    return any(m.user_id == user.id and m.role == "leader" for m in team.members)


def _can_manage_team(user: User, team: Team) -> bool:
    if user.role == UserRole.admin:
        return True
    if user.role == UserRole.organizer and can_manage_hackathon(user, team.hackathon):
        return True
    return _is_team_leader(user, team)


def _user_team_in_hackathon(user_id: int, hackathon_id: int, db: Session) -> Team | None:
    return (
        db.query(Team)
        .join(TeamMember)
        .filter(Team.hackathon_id == hackathon_id, TeamMember.user_id == user_id)
        .first()
    )


def _count_hackathon_participants(hackathon_id: int, db: Session) -> int:
    return (
        db.query(TeamMember)
        .join(Team)
        .filter(Team.hackathon_id == hackathon_id)
        .count()
    )


def _team_size(team: Team) -> int:
    return len(team.members)


def _check_hackathon_limits(hackathon: Hackathon, team: Team, db: Session, adding: int = 1):
    if hackathon.max_team_members is not None and _team_size(team) + adding > hackathon.max_team_members:
        raise HTTPException(
            status_code=400,
            detail=f"Team member limit reached (max {hackathon.max_team_members} per team)",
        )
    if hackathon.max_participants is not None:
        current = _count_hackathon_participants(hackathon.id, db)
        if current + adding > hackathon.max_participants:
            raise HTTPException(
                status_code=400,
                detail=f"Hackathon participant limit reached (max {hackathon.max_participants})",
            )


def _generate_join_code(db: Session) -> str:
    for _ in range(10):
        code = "".join(secrets.choice(_JOIN_CODE_ALPHABET) for _ in range(_JOIN_CODE_LENGTH))
        if not db.query(Team).filter(Team.join_code == code).first():
            return code
    raise RuntimeError("Could not generate a unique team join code")


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_team")),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == payload.hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_access_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied team creation on hackathon id=%s owned by %s", current_user.id, current_user.role, payload.hackathon_id, hackathon.created_by)
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")

    if not _is_manager(current_user) and _user_team_in_hackathon(current_user.id, payload.hackathon_id, db):
        raise HTTPException(status_code=400, detail="You are already in a team for this hackathon")

    if hackathon.max_team_members is not None and hackathon.max_team_members < 1:
        raise HTTPException(status_code=400, detail="Invalid team member limit")

    if hackathon.max_participants is not None:
        current = _count_hackathon_participants(hackathon.id, db)
        if current + 1 > hackathon.max_participants:
            raise HTTPException(status_code=400, detail=f"Hackathon participant limit reached (max {hackathon.max_participants})")

    team = Team(
        hackathon_id=payload.hackathon_id,
        name=payload.name,
        join_code=_generate_join_code(db),
    )
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=current_user.id, role="leader"))
    db.commit()
    db.refresh(team)
    logger.info("Team created id=%s name=%s hackathon_id=%s by user id=%s", team.id, team.name, payload.hackathon_id, current_user.id)
    return team


@router.get("", response_model=List[TeamOut])
async def list_teams(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_access_hackathon(current_user, hackathon):
        logger.warning("User id=%s role=%s denied team list on hackathon id=%s owned by %s", current_user.id, current_user.role, hackathon_id, hackathon.created_by)
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
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
    if not can_access_hackathon(current_user, team.hackathon):
        logger.warning("User id=%s role=%s denied team detail on hackathon id=%s owned by %s", current_user.id, current_user.role, team.hackathon_id, team.hackathon.created_by)
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    return team


@router.post("/join-by-code", response_model=TeamOut)
async def join_team_by_code(
    payload: TeamJoinByCode,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("join_team")),
):
    team = db.query(Team).filter(Team.join_code == payload.code).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not can_access_hackathon(current_user, team.hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")

    existing_team = _user_team_in_hackathon(current_user.id, team.hackathon_id, db)
    if existing_team:
        if existing_team.id == team.id:
            raise HTTPException(status_code=400, detail="You are already a member of this team")
        raise HTTPException(status_code=400, detail="You are already in a team for this hackathon")

    _check_hackathon_limits(team.hackathon, team, db, adding=1)

    db.add(TeamMember(team_id=team.id, user_id=current_user.id, role="member"))
    db.commit()
    db.refresh(team)
    logger.info("User id=%s joined team id=%s by code", current_user.id, team.id)
    return team


@router.post("/{team_id}/members", response_model=TeamOut)
async def add_team_member(
    team_id: int,
    payload: TeamMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_team_members")),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not can_access_hackathon(current_user, team.hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    if not _can_manage_team(current_user, team):
        raise HTTPException(status_code=403, detail="Only a team leader, hackathon organiser, or admin can add members")

    target_user = db.query(User).filter(User.username == payload.username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_member = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == target_user.id).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member of this team")

    existing_team = _user_team_in_hackathon(target_user.id, team.hackathon_id, db)
    if existing_team and existing_team.id != team.id:
        raise HTTPException(status_code=400, detail="User is already in another team for this hackathon")

    _check_hackathon_limits(team.hackathon, team, db, adding=1)

    db.add(TeamMember(team_id=team_id, user_id=target_user.id, role="member"))
    db.commit()
    db.refresh(team)
    logger.info("User id=%s added user id=%s to team id=%s", current_user.id, target_user.id, team_id)
    return team


@router.patch("/{team_id}/members/{member_id}", response_model=TeamOut)
async def update_team_member(
    team_id: int,
    member_id: int,
    payload: TeamMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_team_members")),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not can_access_hackathon(current_user, team.hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    if not _can_manage_team(current_user, team):
        raise HTTPException(status_code=403, detail="Only a team leader, hackathon organiser, or admin can manage members")

    member = db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.team_id == team_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    new_role = payload.role.strip().lower()
    if new_role not in ("leader", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'leader' or 'member'")

    if new_role == "leader" and member.role != "leader":
        # Demote any existing leaders so there is only one leader at a time.
        for m in team.members:
            if m.role == "leader":
                m.role = "member"
        member.role = "leader"
    elif new_role == "member" and member.role == "leader":
        other_leader = any(m.id != member.id and m.role == "leader" for m in team.members)
        if not other_leader:
            raise HTTPException(status_code=400, detail="Cannot demote the only team leader")
        member.role = "member"

    db.commit()
    db.refresh(team)
    logger.info("User id=%s updated member id=%s role to %s in team id=%s", current_user.id, member_id, new_role, team_id)
    return team


@router.delete("/{team_id}/members/{member_id}", response_model=TeamOut)
async def remove_team_member(
    team_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_team_members")),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not can_access_hackathon(current_user, team.hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    if not _can_manage_team(current_user, team):
        raise HTTPException(status_code=403, detail="Only a team leader, hackathon organiser, or admin can manage members")

    member = db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.team_id == team_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.role == "leader" and not any(m.id != member.id and m.role == "leader" for m in team.members):
        raise HTTPException(status_code=400, detail="Cannot remove the only team leader")

    db.delete(member)
    db.commit()
    db.refresh(team)
    logger.info("User id=%s removed member id=%s from team id=%s", current_user.id, member_id, team_id)
    return team


@router.post("/{team_id}/join", response_model=TeamOut)
async def join_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("join_team")),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not can_access_hackathon(current_user, team.hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    if _user_team_in_hackathon(current_user.id, team.hackathon_id, db):
        raise HTTPException(status_code=400, detail="You are already in a team for this hackathon")
    _check_hackathon_limits(team.hackathon, team, db, adding=1)
    db.add(TeamMember(team_id=team_id, user_id=current_user.id, role="member"))
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delete_hackathon")),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    hackathon = db.query(Hackathon).filter(Hackathon.id == team.hackathon_id).first()
    if current_user.role != UserRole.admin and hackathon.created_by != current_user.id:
        logger.warning("User id=%s role=%s denied delete on team id=%s hackathon_id=%s owned by %s", current_user.id, current_user.role, team_id, team.hackathon_id, hackathon.created_by)
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can delete this team")

    logger.info("Deleting team id=%s name=%s hackathon_id=%s by user id=%s", team.id, team.name, team.hackathon_id, current_user.id)
    # Delete submissions and evaluations first to avoid FK/ORM cascade conflicts
    for submission in team.submissions:
        if submission.evaluation:
            db.delete(submission.evaluation)
        db.delete(submission)
    for member in team.members:
        db.delete(member)
    db.delete(team)
    db.commit()
    logger.info("Team id=%s deleted by user id=%s", team_id, current_user.id)
    return None
