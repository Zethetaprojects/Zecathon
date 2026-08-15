from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.database import get_db
from app.models import ProblemStatement, Submission, SubmissionStatus, SubmissionType, Team, TeamMember, User
from app.schemas import SubmissionCreate, SubmissionDetail, SubmissionOut
from app.services.file_storage import save_upload

router = APIRouter()


def _ensure_team_member(team_id: int, user_id: int, db: Session) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id).first()
    if not member:
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
    current_user: User = Depends(get_current_active_user),
):
    try:
        sub_type = SubmissionType(type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid submission type")

    team = _ensure_team_member(team_id, current_user.id, db)

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
    _ensure_team_member(submission.team_id, current_user.id, db)
    return submission


@router.get("", response_model=List[SubmissionOut])
async def list_submissions(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _ensure_team_member(team_id, current_user.id, db)
    return db.query(Submission).filter(Submission.team_id == team_id).order_by(Submission.created_at.desc()).all()
