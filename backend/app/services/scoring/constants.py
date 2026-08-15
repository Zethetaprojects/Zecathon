from typing import Optional

from app.models import Hackathon, SubmissionType


VERDICT_BANDS = [
    (850, 1000, "OUTSTANDING"),
    (700, 849, "EXCELLENT"),
    (500, 699, "SATISFACTORY"),
    (0, 499, "NEEDS WORK"),
]

AUTHENTICITY_MULTIPLIERS = {
    "HIGH_HUMAN_INPUT": 1.00,
    "MIXED": 0.85,
    "PREDOMINANTLY_ASSISTED": 0.60,
    "NO_DISCERNIBLE_HUMAN_INPUT": 0.40,
}

TECH_CATEGORIES = {
    "Problem Understanding": 150,
    "Implementation Completeness": 200,
    "Code Quality & Architecture": 150,
    "Innovation & Creativity": 150,
    "Technical Feasibility": 100,
    "Documentation": 100,
    "Commit Authenticity / Effort": 100,
    "Presentation / Demo": 50,
}

NON_TECH_CATEGORIES = {
    "Problem-Specific Grounding": 150,
    "Solution Effectiveness": 200,
    "Research & Evidence": 150,
    "Feasibility & Practicality": 150,
    "Communication & Clarity": 100,
    "Innovation & Creativity": 150,
    "Presentation Quality": 100,
}


def verdict_for_score(score: int) -> str:
    for low, high, name in VERDICT_BANDS:
        if low <= score <= high:
            return name
    return "NEEDS WORK"


def band_bounds(score: int):
    for low, high, name in VERDICT_BANDS:
        if low <= score <= high:
            return low, high, name
    return 0, 1000, "NEEDS WORK"


def get_rubric(hackathon: Optional[Hackathon], submission_type: SubmissionType) -> dict:
    """Return the per-hackathon rubric if it is valid, otherwise the default rubric."""
    defaults = TECH_CATEGORIES if submission_type == SubmissionType.tech else NON_TECH_CATEGORIES
    if not hackathon or not hackathon.rubric:
        return defaults
    stored = hackathon.rubric
    if isinstance(stored, dict):
        # Support either a flat map of category->max or nested {tech:{...}, non_tech:{...}}
        key = "tech" if submission_type == SubmissionType.tech else "non_tech"
        if key in stored and isinstance(stored[key], dict):
            candidate = stored[key]
        elif submission_type.value in stored and isinstance(stored[submission_type.value], dict):
            candidate = stored[submission_type.value]
        else:
            candidate = stored
        # Ensure all required categories are present and total ~1000
        if all(isinstance(v, int) and v > 0 for v in candidate.values()) and sum(candidate.values()) == 1000:
            return candidate
    return defaults
