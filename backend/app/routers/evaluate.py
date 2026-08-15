from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_active_user, require_judge
from app.database import get_db
from app.models import Evaluation, ProblemStatement, Submission, SubmissionStatus, SubmissionType, Team, TeamMember, User
from app.schemas import EvaluationOut
from app.services.document_extractor import extract_text
from app.services.scoring.non_tech_evaluator import evaluate_non_tech
from app.services.scoring.tech_evaluator import evaluate_tech

router = APIRouter()


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
    try:
        return evaluate_tech(db, submission, problem_text)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def _run_non_tech_evaluation(db: Session, submission: Submission) -> Evaluation:
    ps = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    problem_text = _get_problem_statement_text(ps)
    try:
        return evaluate_non_tech(db, submission, problem_text)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/tech/{submission_id}", response_model=EvaluationOut)
async def evaluate_tech_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_judge),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.tech:
        raise HTTPException(status_code=400, detail="Submission is not a tech submission")

    if submission.evaluation:
        return submission.evaluation

    return _run_tech_evaluation(db, submission)


@router.post("/non-tech/{submission_id}", response_model=EvaluationOut)
async def evaluate_non_tech_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_judge),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.non_tech:
        raise HTTPException(status_code=400, detail="Submission is not a non-tech submission")

    if submission.evaluation:
        return submission.evaluation

    return _run_non_tech_evaluation(db, submission)


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
    current_user: User = Depends(require_judge),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.tech:
        raise HTTPException(status_code=400, detail="Submission is not a tech submission")

    _reset_evaluation(db, submission)
    return _run_tech_evaluation(db, submission)


@router.post("/non-tech/{submission_id}/retry", response_model=EvaluationOut)
async def retry_evaluate_non_tech(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_judge),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.non_tech:
        raise HTTPException(status_code=400, detail="Submission is not a non-tech submission")

    _reset_evaluation(db, submission)
    return _run_non_tech_evaluation(db, submission)
