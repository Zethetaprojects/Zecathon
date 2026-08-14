from typing import Iterable, List

from app.services.scoring.constants import band_bounds, verdict_for_score


def reconcile_score(
    raw_subtotal: int,
    multiplier: float,
    existing_scores: Iterable[int],
    team_id: int,
) -> int:
    """Apply the authenticity multiplier and a deterministic tie-breaker so
    leaderboard scores stay discrete and within the same verdict band.
    """
    base = max(0, min(1000, round(raw_subtotal * multiplier)))
    low, high, _ = band_bounds(base)
    existing = set(existing_scores)

    # Prefer a small positive offset first; if it would leave the band, go negative.
    final = base
    for offset in range(0, 21):
        candidates = []
        if base + offset <= high and base + offset not in existing:
            candidates.append(base + offset)
        if base - offset >= low and base - offset not in existing and base - offset != base:
            candidates.append(base - offset)
        if candidates:
            final = candidates[0]
            break

    return max(low, min(high, final))
