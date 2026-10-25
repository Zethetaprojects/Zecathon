import json
import logging

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_active_user, is_platform_admin
from app.database import get_db
from app.models import Hackathon, Team, User, UserRole
from app.schemas import TeamOut, check_rubric

logger = logging.getLogger(__name__)


def can_access_hackathon(user: User, hackathon: Hackathon | None) -> bool:
    """Return True if a user is allowed to view a hackathon.

    Admins and superadmins have platform-wide access. Organizers may only access
    hackathons they created. Participants and judges may view any hackathon (so
    they can join teams, submit projects, judge, and view leaderboards).
    """
    if not hackathon:
        return False
    if is_platform_admin(user):
        return True
    if user.role == UserRole.organizer:
        return hackathon.created_by == user.id
    return user.role in (UserRole.participant, UserRole.judge)


def can_manage_hackathon(user: User, hackathon: Hackathon | None) -> bool:
    """Return True if a user can manage (edit, delete, problem statements, teams) a hackathon."""
    if not hackathon:
        return False
    if is_platform_admin(user):
        return True
    return user.role == UserRole.organizer and hackathon.created_by == user.id


def team_out(team: Team, user: User, hackathon: Hackathon | None = None) -> TeamOut:
    """Serialize a team, hiding its invite code from everyone except its own
    members and the hackathon's managers (anyone with the code can join)."""
    out = TeamOut.model_validate(team)
    is_member = any(m.user_id == user.id for m in out.members)
    if not is_member and not can_manage_hackathon(user, hackathon or team.hackathon):
        out = out.model_copy(update={"join_code": None})
    return out


def parse_rubric_form(value: str | None) -> dict | None:
    """Parse a JSON rubric sent as a multipart form field; 400 if it is invalid."""
    if value is None or not value.strip() or value.strip() == "null":
        return None
    try:
        return check_rubric(json.loads(value))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Rubric must be valid JSON")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def is_manager(user: User) -> bool:
    """Roles that may act on behalf of teams in hackathons they manage."""
    return is_platform_admin(user) or user.role == UserRole.organizer


def require_hackathon_access(hackathon_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> Hackathon:
    """Dependency that returns the hackathon only if the current user may access it."""
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hackathon not found")
    if not can_access_hackathon(current_user, hackathon):
        logger.warning(
            "Access denied user_id=%s role=%s hackathon_id=%s owner=%s",
            current_user.id, current_user.role, hackathon_id, hackathon.created_by
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this hackathon")
    return hackathon
