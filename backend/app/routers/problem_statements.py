import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_active_user, require_permission
from app.database import get_db
from app.models import ProblemStatement, User
from app.routers.common import can_access_hackathon, can_manage_hackathon, can_see_problem_statements, parse_rubric_form
from app.schemas import ProblemStatementOut
from app.services.file_storage import save_upload

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_manageable_statement(problem_statement_id: int, user: User, db: Session) -> ProblemStatement:
    """Load a statement the user may change; refuse once any team has submitted to it."""
    ps = db.query(ProblemStatement).filter(ProblemStatement.id == problem_statement_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Problem statement not found")
    if not can_manage_hackathon(user, ps.hackathon):
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can change problem statements")
    if ps.submission_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This problem statement already has {ps.submission_count} submission(s), so it can no longer "
                "be edited or deleted. Teams have already answered it."
            ),
        )
    return ps


@router.get("/{problem_statement_id}", response_model=ProblemStatementOut)
def get_problem_statement(
    problem_statement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ps = db.query(ProblemStatement).filter(ProblemStatement.id == problem_statement_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Problem statement not found")
    if not can_access_hackathon(current_user, ps.hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    if not can_see_problem_statements(current_user, ps.hackathon):
        raise HTTPException(status_code=403, detail="Problem statements are revealed when the hackathon starts")
    return ps


@router.put("/{problem_statement_id}", response_model=ProblemStatementOut)
async def update_problem_statement(
    problem_statement_id: int,
    title: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(None),
    remove_file: bool = Form(False),
    rubric: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_problem_statements")),
):
    """Edit a statement's title, description, or attachment (only before any submission)."""
    ps = _get_manageable_statement(problem_statement_id, current_user, db)
    if not title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    ps.title = title.strip()
    ps.description = description.strip() or None
    if rubric is not None:
        # An empty value ("" or "null") clears the statement rubric.
        ps.rubric = parse_rubric_form(rubric)
    if file and file.filename:
        ps.file_path = await save_upload(file)
    elif remove_file:
        ps.file_path = None
    db.commit()
    db.refresh(ps)
    logger.info("Problem statement id=%s updated by user id=%s", ps.id, current_user.id)
    return ps


@router.delete("/{problem_statement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_problem_statement(
    problem_statement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_problem_statements")),
):
    """Delete a statement (only before any submission)."""
    ps = _get_manageable_statement(problem_statement_id, current_user, db)
    db.delete(ps)
    db.commit()
    logger.info("Problem statement id=%s deleted by user id=%s", problem_statement_id, current_user.id)
    return None
