from typing import Optional

from app.models import Hackathon, ProblemStatement, SubmissionType


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


def _rubric_for_type(stored, submission_type: SubmissionType) -> Optional[dict]:
    """Pick the rubric for one submission type out of a stored rubric, if it is valid."""
    if not isinstance(stored, dict) or not stored:
        return None
    # Support either a flat map of category->max or nested {tech:{...}, non_tech:{...}}
    key = "tech" if submission_type == SubmissionType.tech else "non_tech"
    if key in stored:
        candidate = stored[key]
    elif submission_type.value in stored:
        candidate = stored[submission_type.value]
    elif "tech" in stored or "non_tech" in stored:
        return None  # nested rubric that only covers the other submission type
    else:
        candidate = stored
    if (
        isinstance(candidate, dict)
        and candidate
        and all(isinstance(v, int) and v > 0 for v in candidate.values())
        and sum(candidate.values()) == 1000
    ):
        return candidate
    return None


def get_rubric(
    hackathon: Optional[Hackathon],
    submission_type: SubmissionType,
    problem_statement: Optional[ProblemStatement] = None,
) -> dict:
    """The rubric to score with: the problem statement's own rubric, else the
    hackathon's, else the platform default."""
    for owner in (problem_statement, hackathon):
        chosen = _rubric_for_type(getattr(owner, "rubric", None), submission_type)
        if chosen:
            return chosen
    return TECH_CATEGORIES if submission_type == SubmissionType.tech else NON_TECH_CATEGORIES
