from typing import Optional, Tuple

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "this", "that", "these", "those", "it", "its", "we", "our", "us", "i",
    "my", "you", "your", "they", "their", "them", "he", "she", "his", "her", "him", "from", "as", "about",
    "into", "through", "during", "before", "after", "above", "below", "between", "among", "within", "without",
}


def _meaningful_words(text: str):
    return {w for w in text.lower().split() if len(w) > 3 and w not in STOP_WORDS}


def tech_admissibility(repo_summary: dict) -> Tuple[bool, Optional[str]]:
    if not repo_summary.get("valid"):
        return False, repo_summary.get("error") or "Invalid repository"
    files = repo_summary.get("files", [])
    if not files:
        return False, "EMPTY_OR_TEMPLATE"
    if len(files) <= 1 and "README" in (files[0] or "").upper():
        return False, "README_ONLY"
    if repo_summary.get("total_commits", 0) == 0:
        return False, "NO_COMMIT_HISTORY"
    return True, None


def non_tech_admissibility(text: str, problem_statement: str) -> Tuple[bool, Optional[str]]:
    word_count = len(text.split())
    if word_count < 50:
        return False, "EMPTY_OR_CORRUPT"

    ps_words = _meaningful_words(problem_statement)
    doc_words = _meaningful_words(text)
    if not doc_words:
        return False, "EMPTY_OR_CORRUPT"

    if ps_words:
        # If almost all meaningful document words are just the problem statement,
        # the submission is a restatement, not a solution.
        overlap = len(ps_words & doc_words) / len(doc_words)
        if overlap > 0.85:
            return False, "THIS_PROBLEM_RESTATED"
    return True, None
