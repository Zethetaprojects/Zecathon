from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import logging
from app.auth import require_permission
from app.database import get_db
from app.models import Evaluation, ProblemStatement, Submission, SubmissionType, Team, User, UserRole
from app.routers.common import can_manage_hackathon
from app.schemas import EvaluationOut
from app.services.document_extractor import extract_text
from app.services.github_client import GitHubUnavailableError
from app.services.scoring.llm_client import LLMUnavailableError
from app.services.scoring.non_tech_evaluator import evaluate_non_tech
from app.services.scoring.tech_evaluator import evaluate_tech

router = APIRouter()
logger = logging.getLogger(__name__)

# Evaluation endpoints are plain `def` so FastAPI runs them in its threadpool:
# GitHub and LLM calls block for many seconds and must not stall the event loop.


def _get_problem_statement_text(ps: ProblemStatement) -> str:
    parts = []
    if ps.title:
        parts.append(ps.title)
    if ps.description:
        parts.append(ps.description)
    if ps.file_path:
        parts.append(extract_text(ps.file_path))
    return "\n\n".join(parts)


def _run_evaluation(db: Session, submission: Submission) -> Evaluation:
    ps = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    problem_text = _get_problem_statement_text(ps)
    kind = submission.type.value
    submission_id = submission.id  # read before any rollback expires the instance
    evaluator = evaluate_tech if submission.type == SubmissionType.tech else evaluate_non_tech
    logger.info("Starting %s evaluation for submission id=%s team_id=%s", kind, submission.id, submission.team_id)
    try:
        evaluation = evaluator(db, submission, problem_text)
    except LLMUnavailableError as exc:
        db.rollback()
        logger.error("LLM unavailable for submission id=%s: %s", submission_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"The AI evaluator is unavailable right now, so nothing was scored. Please try again later. ({exc})",
        )
    except GitHubUnavailableError as exc:
        db.rollback()
        logger.error("GitHub unavailable for submission id=%s: %s", submission_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"GitHub could not be reached, so nothing was scored. Please try again later. ({exc})",
        )
    except IntegrityError:
        # Someone else (another tab, organiser or bulk run) finished scoring this
        # submission while we were waiting on the AI. Their score stands; return it.
        db.rollback()
        existing = db.query(Evaluation).filter(Evaluation.submission_id == submission_id).first()
        if existing:
            logger.info("Submission id=%s was scored concurrently; returning the saved evaluation", submission_id)
            return existing
        logger.exception("%s evaluation failed for submission id=%s", kind, submission_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not save the evaluation; please try again.")
    except Exception as exc:
        db.rollback()
        logger.exception("%s evaluation failed for submission id=%s: %s", kind, submission_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    logger.info("%s evaluation completed for submission id=%s score=%s verdict=%s source=%s",
                kind, submission.id, evaluation.total_score, evaluation.verdict, evaluation.llm_source)
    return evaluation


def _ensure_evaluation_access(submission: Submission, user: User, db: Session) -> None:
    """Judges may evaluate any submission; admins and organisers only hackathons they manage."""
    if user.role == UserRole.judge:
        return
    team = db.query(Team).filter(Team.id == submission.team_id).first()
    if team and can_manage_hackathon(user, team.hackathon):
        return
    logger.warning("User id=%s role=%s denied evaluation of submission id=%s", user.id, user.role, submission.id)
    raise HTTPException(status_code=403, detail="Only a judge, the hackathon organiser, or an admin can evaluate this submission")


def _load_submission(db: Session, submission_id: int, expected: SubmissionType, user: User) -> Submission:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != expected:
        label = "tech" if expected == SubmissionType.tech else "non-tech"
        raise HTTPException(status_code=400, detail=f"Submission is not a {label} submission")
    _ensure_evaluation_access(submission, user, db)
    return submission


def _evaluate(db: Session, submission_id: int, expected: SubmissionType, user: User) -> Evaluation:
    submission = _load_submission(db, submission_id, expected, user)
    if submission.evaluation:
        logger.info("Returning cached evaluation for submission id=%s", submission.id)
        return submission.evaluation
    return _run_evaluation(db, submission)


def _retry(db: Session, submission_id: int, expected: SubmissionType, user: User) -> Evaluation:
    submission = _load_submission(db, submission_id, expected, user)
    logger.info("Evaluation retry requested for submission id=%s by user id=%s", submission.id, user.id)
    # Remove the old evaluation inside the same transaction. The evaluators only
    # commit after scoring succeeds, so if scoring fails the rollback in
    # _run_evaluation restores the previous evaluation instead of losing it.
    if submission.evaluation:
        db.delete(submission.evaluation)
        db.flush()
        db.expire(submission, ["evaluation"])
    return _run_evaluation(db, submission)


@router.post("/tech/{submission_id}", response_model=EvaluationOut)
def evaluate_tech_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    return _evaluate(db, submission_id, SubmissionType.tech, current_user)


@router.post("/non-tech/{submission_id}", response_model=EvaluationOut)
def evaluate_non_tech_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    return _evaluate(db, submission_id, SubmissionType.non_tech, current_user)


@router.post("/tech/{submission_id}/retry", response_model=EvaluationOut)
def retry_evaluate_tech(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    return _retry(db, submission_id, SubmissionType.tech, current_user)


@router.post("/non-tech/{submission_id}/retry", response_model=EvaluationOut)
def retry_evaluate_non_tech(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    return _retry(db, submission_id, SubmissionType.non_tech, current_user)
