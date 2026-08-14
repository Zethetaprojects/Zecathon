from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.database import get_db
from app.models import ProblemStatement, Submission, SubmissionType, Team, TeamMember, User
from app.schemas import EvaluationOut
from app.services.document_extractor import extract_text
from app.services.scoring.non_tech_evaluator import evaluate_non_tech
from app.services.scoring.tech_evaluator import evaluate_tech

router = APIRouter()


def _ensure_team_member(team_id: int, user_id: int, db: Session) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    return team


def _get_problem_statement_text(ps: ProblemStatement) -> str:
    parts = []
    if ps.title:
        parts.append(ps.title)
    if ps.description:
        parts.append(ps.description)
    if ps.file_path:
        parts.append(extract_text(ps.file_path))
    return "\n\n".join(parts)


@router.post("/tech/{submission_id}", response_model=EvaluationOut)
async def evaluate_tech_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.tech:
        raise HTTPException(status_code=400, detail="Submission is not a tech submission")

    _ensure_team_member(submission.team_id, current_user.id, db)

    if submission.evaluation:
        return submission.evaluation

    ps = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    problem_text = _get_problem_statement_text(ps)

    try:
        result = evaluate_tech(db, submission, problem_text)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return result


@router.post("/non-tech/{submission_id}", response_model=EvaluationOut)
async def evaluate_non_tech_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.type != SubmissionType.non_tech:
        raise HTTPException(status_code=400, detail="Submission is not a non-tech submission")

    _ensure_team_member(submission.team_id, current_user.id, db)

    if submission.evaluation:
        return submission.evaluation

    ps = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    problem_text = _get_problem_statement_text(ps)

    try:
        result = evaluate_non_tech(db, submission, problem_text)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return result
