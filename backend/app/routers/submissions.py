from typing import List

import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.auth import get_current_active_user, require_permission
from app.database import get_db
from app.models import Hackathon, ProblemStatement, Submission, SubmissionStatus, SubmissionType, Team, TeamMember, User, UserRole
from app.routers.common import can_access_hackathon, can_manage_hackathon
from app.schemas import SubmissionCreate, SubmissionDetail, SubmissionOut
from app.services.file_storage import save_upload

router = APIRouter()
logger = logging.getLogger(__name__)


def _is_manager(user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.organizer)


def _is_judge(user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.organizer, UserRole.judge)


def _ensure_team_access(team_id: int, user: User, db: Session) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if user.role == UserRole.admin:
        return team
    if user.role == UserRole.organizer:
        if can_manage_hackathon(user, team.hackathon):
            return team
        logger.warning("Organizer id=%s denied access to team id=%s in unowned hackathon id=%s", user.id, team_id, team.hackathon_id)
        raise HTTPException(status_code=403, detail="You do not have access to this team")
    if user.role == UserRole.judge:
        return team
    member = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user.id).first()
    if not member:
        logger.warning("User id=%s role=%s denied access to team id=%s", user.id, user.role, team_id)
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    return team


@router.post("", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
async def create_submission(
    team_id: int = Form(...),
    problem_statement_id: int = Form(...),
    type: str = Form(...),
    submission_url: str = Form(None),
    github_url: str = Form(None),
    submission_file: UploadFile = File(None),
    ppt_file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("submit_project")),
):
    try:
        sub_type = SubmissionType(type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid submission type")

    if current_user.role not in (UserRole.participant, UserRole.admin, UserRole.organizer):
        raise HTTPException(status_code=403, detail="Only participants, organizers, or admins can submit")

    if _is_manager(current_user):
        team = db.query(Team).filter(Team.id == team_id).first()
        if team and not can_manage_hackathon(current_user, team.hackathon):
            logger.warning("Manager id=%s denied submission for team id=%s in unowned hackathon id=%s", current_user.id, team_id, team.hackathon_id)
            raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    else:
        team = _ensure_team_access(team_id, current_user, db)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    ps = db.query(ProblemStatement).filter(ProblemStatement.id == problem_statement_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Problem statement not found")
    if ps.hackathon_id != team.hackathon_id:
        raise HTTPException(status_code=400, detail="Problem statement does not belong to this hackathon")

    existing = (
        db.query(Submission)
        .filter(Submission.team_id == team_id, Submission.problem_statement_id == problem_statement_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Submission already exists for this team and problem statement")

    if sub_type == SubmissionType.tech:
        if not submission_url:
            raise HTTPException(status_code=400, detail="Tech submissions require a GitHub URL")
        final_url = submission_url
        final_github = None
    else:
        # Non-tech: accept either a document file or an optional GitHub URL (or both)
        file_url = None
        if submission_file and submission_file.filename:
            file_url = await save_upload(submission_file)
        if not file_url and not submission_url and not github_url:
            raise HTTPException(
                status_code=400,
                detail="Non-tech submissions require a document file, submission URL, or GitHub URL",
            )
        final_url = file_url or submission_url or github_url or ""
        final_github = github_url

    ppt_url = None
    if ppt_file and ppt_file.filename:
        ppt_url = await save_upload(ppt_file)

    submission = Submission(
        team_id=team_id,
        problem_statement_id=problem_statement_id,
        type=sub_type,
        submission_url=final_url,
        github_url=final_github,
        ppt_url=ppt_url,
        status=SubmissionStatus.pending,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    logger.info("Submission created id=%s type=%s team_id=%s ps_id=%s by user id=%s", submission.id, submission.type, team_id, problem_statement_id, current_user.id)
    return submission


@router.get("/{submission_id}", response_model=SubmissionDetail)
async def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    _ensure_team_access(submission.team_id, current_user, db)
    return submission


@router.get("", response_model=List[SubmissionOut])
async def list_submissions(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _ensure_team_access(team_id, current_user, db)
    return db.query(Submission).filter(Submission.team_id == team_id).order_by(Submission.created_at.desc()).all()
