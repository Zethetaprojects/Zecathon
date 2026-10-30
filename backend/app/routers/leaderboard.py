from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.auth import require_permission
from app.database import get_db
from app.models import Evaluation, Hackathon, ProblemStatement, Submission, Team, User, UserRole
from app.routers.common import can_access_hackathon, can_manage_hackathon
from app.schemas import LeaderboardEntry
from app.services.rounds import get_round, published_result_rounds, round_score
from app.services.scoring.constants import verdict_for_score

router = APIRouter()


def default_round(db: Session, hackathon_id: int) -> int:
    """The latest round that has scored submissions (1 when nothing is scored yet)."""
    numbers = [
        n or 1
        for (n,) in db.query(Submission.round_number)
        .join(Team, Submission.team_id == Team.id)
        .outerjoin(Evaluation, Submission.id == Evaluation.submission_id)
        .filter(Team.hackathon_id == hackathon_id)
        .filter(or_(Evaluation.id.isnot(None), Submission.judge_scores.any()))
        .distinct()
    ]
    return max(numbers, default=1)


def _build_leaderboard(db: Session, hackathon_id: int, round_number: Optional[int] = None) -> List[LeaderboardEntry]:
    round_number = round_number or default_round(db, hackathon_id)
    row = get_round(db, hackathon_id, round_number)
    judge_weight = row.judge_weight if row else 0

    rows = (
        db.query(Team, ProblemStatement, Submission)
        .join(Submission, Team.id == Submission.team_id)
        .join(ProblemStatement, Submission.problem_statement_id == ProblemStatement.id)
        .options(selectinload(Submission.evaluation), selectinload(Submission.judge_scores))
        .filter(Team.hackathon_id == hackathon_id)
        .filter(Submission.round_number == round_number)
        .all()
    )
    entries: List[LeaderboardEntry] = []
    for team, ps, sub in rows:
        ev = sub.evaluation
        final, ai, judge_avg, judge_count, awaiting = round_score(ev, sub.judge_scores, judge_weight)
        if final is None:
            continue  # not scored yet
        # The AI verdict stands while the score is the AI score; otherwise derive it.
        verdict = ev.verdict if ev and final == ai and not judge_count else verdict_for_score(final)
        entries.append(
            LeaderboardEntry(
                team_id=team.id,
                team_name=team.name,
                problem_statement_id=ps.id,
                problem_statement_title=ps.title,
                submission_id=sub.id,
                type=sub.type,
                total_score=final,
                percentage=round(final / 10.0, 2),
                verdict=verdict,
                needs_review=bool(ev.needs_review) if ev else False,
                round_number=round_number,
                ai_score=ai,
                judge_score=judge_avg,
                judge_count=judge_count,
                awaiting_judges=awaiting,
            )
        )
    entries.sort(key=lambda e: e.total_score, reverse=True)
    return entries


def _visible_leaderboard(db: Session, hackathon_id: int, round_number: Optional[int]) -> List[LeaderboardEntry]:
    """What teams and the public may see: only rounds whose results are published.

    Without a round, the latest published round. Unpublished rounds come back empty.
    """
    published = published_result_rounds(db, hackathon_id)
    if round_number is None:
        if not published:
            return []
        round_number = published[-1]
    if round_number not in published:
        return []
    return _build_leaderboard(db, hackathon_id, round_number)


@router.get("/{hackathon_id}", response_model=List[LeaderboardEntry])
def get_leaderboard(
    hackathon_id: int,
    round: Optional[int] = Query(None, ge=1, description="Round number; defaults to the latest scored round"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_leaderboard")),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not can_access_hackathon(current_user, hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    # Organisers, admins and judges always see the scores, published or not.
    if can_manage_hackathon(current_user, hackathon) or current_user.role == UserRole.judge:
        return _build_leaderboard(db, hackathon_id, round)
    return _visible_leaderboard(db, hackathon_id, round)


@router.get("/public/{hackathon_id}", response_model=List[LeaderboardEntry])
def get_public_leaderboard(
    hackathon_id: int,
    round: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    return _visible_leaderboard(db, hackathon_id, round)
