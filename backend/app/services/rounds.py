"""Rounds: round 1 is the hackathon itself; rounds 2+ are for shortlisted teams."""
from typing import Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import Evaluation, HackathonRound, JudgeScore


def round_name(number: int, row: Optional[HackathonRound]) -> str:
    return (row.name if row and row.name else None) or f"Round {number}"


def get_round(db: Session, hackathon_id: int, number: int) -> Optional[HackathonRound]:
    return (
        db.query(HackathonRound)
        .filter(HackathonRound.hackathon_id == hackathon_id, HackathonRound.number == number)
        .first()
    )


def last_round_number(db: Session, hackathon_id: int) -> int:
    numbers = [n for (n,) in db.query(HackathonRound.number).filter(HackathonRound.hackathon_id == hackathon_id)]
    return max([1, *numbers])


def results_published(round_row: Optional[HackathonRound]) -> bool:
    """Whether everyone may see this round's scores and rankings (off until the organiser publishes)."""
    return bool(round_row and round_row.results_published)


def published_result_rounds(db: Session, hackathon_id: int) -> List[int]:
    return sorted(
        n
        for (n,) in db.query(HackathonRound.number).filter(
            HackathonRound.hackathon_id == hackathon_id, HackathonRound.results_published.is_(True)
        )
    )


def is_shortlisted(round_row: Optional[HackathonRound], team_id: int) -> bool:
    return bool(round_row and any(s.team_id == team_id for s in round_row.shortlist))


def round_score(
    evaluation: Optional[Evaluation], judge_scores: Iterable[JudgeScore], judge_weight: int
) -> Tuple[Optional[int], Optional[int], Optional[float], int, bool]:
    """Combine the AI score and the judges' marks for one submission.

    Returns (final, ai, judge_average, judge_count, awaiting_judges). The final
    score blends the two by the round's judge weight; when only one part exists
    it is used alone, and awaiting_judges is set while judges are expected but
    have not marked yet.
    """
    scores: List[int] = [j.score for j in judge_scores]
    ai = evaluation.total_score if evaluation else None
    judge_avg = round(sum(scores) / len(scores), 1) if scores else None
    weight = max(0, min(100, judge_weight or 0))

    if ai is not None and judge_avg is not None:
        final = round(ai * (100 - weight) / 100 + judge_avg * weight / 100) if weight else ai
    elif judge_avg is not None:
        final = round(judge_avg)
    else:
        final = ai
    awaiting = weight > 0 and judge_avg is None
    return final, ai, judge_avg, len(scores), awaiting
