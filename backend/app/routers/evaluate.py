from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import logging
from app.auth import get_current_active_user, require_permission
from app.database import get_db
from app.models import Evaluation, Hackathon, ProblemStatement, Submission, SubmissionStatus, SubmissionType, Team, TeamMember, User, UserRole
from app.routers.common import can_manage_hackathon
from app.schemas import EvaluationOut
from app.services.document_extractor import extract_text
from app.services.scoring.non_tech_evaluator import evaluate_non_tech
from app.services.scoring.tech_evaluator import evaluate_tech

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_problem_statement_text(ps: ProblemStatement) -> str:
    parts = []
    if ps.title:
        parts.append(ps.title)
    if ps.description:
        parts.append(ps.description)
    if ps.file_path:
        parts.append(extract_text(ps.file_path))
    return "\n\n".join(parts)


def _run_tech_evaluation(db: Session, submission: Submission) -> Evaluation:
    ps = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    problem_text = _get_problem_statement_text(ps)
    logger.info("Starting tech evaluation for submission id=%s team_id=%s", submission.id, submission.team_id)
    try:
        return evaluate_tech(db, submission, problem_text)
    except Exception as exc:
        logger.exception("Tech evaluation failed for submission id=%s: %s", submission.id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def _run_non_tech_evaluation(db: Session, submission: Submission) -> Evaluation:
    ps = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    problem_text = _get_problem_statement_text(ps)
    logger.info("Starting non-tech evaluation for submission id=%s team_id=%s", submission.id, submission.team_id)
    try:
        return evaluate_non_tech(db, submission, problem_text)
    except Exception as exc:
        logger.exception("Non-tech evaluation failed for submission id=%s: %s", submission.id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def _ensure_evaluation_access(submission: Submission, user: User, db: Session) -> None:
    """Admins and judges may evaluate any submission; organisers only their own hackathons."""
    if user.role == UserRole.admin or user.role == UserRole.judge:
        return
    if user.role == UserRole.organizer:
        team = db.query(Team).filter(Team.id == submission.team_id).first()
        hackathon = db.query(Hackathon).filter(Hackathon.id == team.hackathon_id).first() if team else None
        if hackathon and can_manage_hackathon(user, hackathon):
            return
    logger.warning(
        "User id=%s role=%s denied evaluation of submission id=%s",
        user.id, user.role, submission.id
    )
    raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can evaluate this submission")


@router.post("/tech/{submission_id}", response_model=EvaluationOut)
async def evaluate_tech_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.tech:
        raise HTTPException(status_code=400, detail="Submission is not a tech submission")
    _ensure_evaluation_access(submission, current_user, db)

    if submission.evaluation:
        logger.info("Returning cached tech evaluation for submission id=%s", submission.id)
        return submission.evaluation

    evaluation = _run_tech_evaluation(db, submission)
    logger.info("Tech evaluation completed for submission id=%s score=%s verdict=%s", evaluation.submission_id, evaluation.total_score, evaluation.verdict)
    return evaluation


@router.post("/non-tech/{submission_id}", response_model=EvaluationOut)
async def evaluate_non_tech_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.non_tech:
        raise HTTPException(status_code=400, detail="Submission is not a non-tech submission")
    _ensure_evaluation_access(submission, current_user, db)

    if submission.evaluation:
        logger.info("Returning cached non-tech evaluation for submission id=%s", submission.id)
        return submission.evaluation

    evaluation = _run_non_tech_evaluation(db, submission)
    logger.info("Non-tech evaluation completed for submission id=%s score=%s verdict=%s", evaluation.submission_id, evaluation.total_score, evaluation.verdict)
    return evaluation


def _reset_evaluation(db: Session, submission: Submission):
    if submission.evaluation:
        db.delete(submission.evaluation)
    submission.status = SubmissionStatus.pending
    db.commit()
    db.refresh(submission)


@router.post("/tech/{submission_id}/retry", response_model=EvaluationOut)
async def retry_evaluate_tech(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.tech:
        raise HTTPException(status_code=400, detail="Submission is not a tech submission")
    _ensure_evaluation_access(submission, current_user, db)

    _reset_evaluation(db, submission)
    logger.info("Tech evaluation retry requested for submission id=%s by user id=%s", submission.id, current_user.id)
    evaluation = _run_tech_evaluation(db, submission)
    logger.info("Tech evaluation retry completed for submission id=%s score=%s verdict=%s", evaluation.submission_id, evaluation.total_score, evaluation.verdict)
    return evaluation


@router.post("/non-tech/{submission_id}/retry", response_model=EvaluationOut)
async def retry_evaluate_non_tech(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.non_tech:
        raise HTTPException(status_code=400, detail="Submission is not a non-tech submission")
    _ensure_evaluation_access(submission, current_user, db)

    _reset_evaluation(db, submission)
    logger.info("Non-tech evaluation retry requested for submission id=%s by user id=%s", submission.id, current_user.id)
    evaluation = _run_non_tech_evaluation(db, submission)
    logger.info("Non-tech evaluation retry completed for submission id=%s score=%s verdict=%s", evaluation.submission_id, evaluation.total_score, evaluation.verdict)
    return evaluation
