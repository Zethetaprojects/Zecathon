from typing import Dict

from app.services.scoring.constants import AUTHENTICITY_MULTIPLIERS


def tech_authenticity(repo_summary: dict) -> Dict[str, any]:
    active_days = repo_summary.get("active_days", 0)
    total_commits = repo_summary.get("total_commits", 0)
    files = repo_summary.get("files", [])

    if active_days >= 5 and total_commits >= 20 and len(files) >= 8:
        band = "HIGH_HUMAN_INPUT"
    elif active_days >= 2 and total_commits >= 5 and len(files) >= 4:
        band = "MIXED"
    elif total_commits >= 2 and len(files) >= 2:
        band = "PREDOMINANTLY_ASSISTED"
    else:
        band = "NO_DISCERNIBLE_HUMAN_INPUT"

    return {
        "band": band,
        "multiplier": AUTHENTICITY_MULTIPLIERS[band],
        "signals": {
            "active_days": active_days,
            "total_commits": total_commits,
            "file_count": len(files),
        },
    }


def non_tech_authenticity(text: str) -> Dict[str, any]:
    words = text.split()
    unique_words = set(w.lower() for w in words)
    word_count = len(words)
    unique_ratio = len(unique_words) / max(word_count, 1)

    if word_count >= 500 and unique_ratio >= 0.35:
        band = "HIGH_HUMAN_INPUT"
    elif word_count >= 250 and unique_ratio >= 0.25:
        band = "MIXED"
    elif word_count >= 100:
        band = "PREDOMINANTLY_ASSISTED"
    else:
        band = "NO_DISCERNIBLE_HUMAN_INPUT"

    return {
        "band": band,
        "multiplier": AUTHENTICITY_MULTIPLIERS[band],
        "signals": {
            "word_count": word_count,
            "unique_word_ratio": round(unique_ratio, 3),
        },
    }
