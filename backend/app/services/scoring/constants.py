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
