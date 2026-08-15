from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.database import get_db
from app.models import Evaluation, Hackathon, ProblemStatement, Submission, Team, User
from app.schemas import LeaderboardEntry

router = APIRouter()


def _build_leaderboard(db: Session, hackathon_id: int) -> List[LeaderboardEntry]:
    rows = (
        db.query(Team, ProblemStatement, Submission, Evaluation)
        .join(Submission, Team.id == Submission.team_id)
        .join(ProblemStatement, Submission.problem_statement_id == ProblemStatement.id)
        .join(Evaluation, Submission.id == Evaluation.submission_id)
        .filter(Team.hackathon_id == hackathon_id)
        .order_by(Evaluation.total_score.desc())
        .all()
    )
    return [
        LeaderboardEntry(
            team_id=team.id,
            team_name=team.name,
            problem_statement_id=ps.id,
            problem_statement_title=ps.title,
            submission_id=sub.id,
            type=sub.type,
            total_score=ev.total_score,
            percentage=ev.percentage,
            verdict=ev.verdict,
            needs_review=ev.needs_review,
        )
        for team, ps, sub, ev in rows
    ]


@router.get("/{hackathon_id}", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    return _build_leaderboard(db, hackathon_id)


@router.get("/public/{hackathon_id}", response_model=List[LeaderboardEntry])
async def get_public_leaderboard(hackathon_id: int, db: Session = Depends(get_db)):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    return _build_leaderboard(db, hackathon_id)
