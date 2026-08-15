from typing import Dict, Any

from app.services.scoring.constants import TECH_CATEGORIES, NON_TECH_CATEGORIES, verdict_for_score


def _format_rubric(categories: Dict[str, int]) -> str:
    total = sum(categories.values())
    lines = "\n".join(
        f"{i+1}. {name} ({max_points})" for i, (name, max_points) in enumerate(categories.items())
    )
    return f"RUBRIC ({len(categories)} categories, {total} points total)\n{lines}"


def _default_sample_questions() -> str:
    return '''"judge_questions": [
    "Walk us through the biggest trade-off you made while building this solution.",
    "Which part of the problem statement was hardest to address and why?",
    "If you had one more day, what would you improve or add?"
  ]'''


def build_tech_prompt(
    problem_statement: str,
    repo_summary: dict,
    categories: Dict[str, int] = None,
) -> str:
    categories = categories or TECH_CATEGORIES
    rubric_lines = _format_rubric(categories)

    files = "\n".join(f"- {f}" for f in repo_summary.get("files", [])[:50])
    snippets = "\n\n".join(
        f"--- {path} ---\n{content[:1500]}" for path, content in repo_summary.get("snippets", {}).items()
    )

    return f"""You are a rigorous senior hackathon technical evaluator. Evaluate the GitHub repository below against the specific problem statement.

PROBLEM STATEMENT
{problem_statement}

REPOSITORY SUMMARY
Owner/Repo: {repo_summary.get('owner')}/{repo_summary.get('repo')}
Files: {len(repo_summary.get('files', []))}
Total commits: {repo_summary.get('total_commits')}
Active commit days: {repo_summary.get('active_days')}

FILE LIST
{files}

README
{repo_summary.get('readme', '')[:8000]}

CODE SNIPPETS
{snippets}

{rubric_lines}

CRITICAL SCORING RULES
- Default to SATISFACTORY unless there is specific evidence for EXCELLENT or OUTSTANDING.
- Do NOT give every category a similar score; scores per category should vary.
- If no README exists, cap Documentation at 30.
- If all commits are on a single day, cap Commit Authenticity / Effort at 40.
- If the repo is a plain CRUD with no differentiation, cap Innovation & Creativity at 60.

AUTHENTICITY GATE (you will classify, but the final score is multiplied server-side)
Classify the apparent human effort as one of: HIGH_HUMAN_INPUT, MIXED, PREDOMINANTLY_ASSISTED, NO_DISCERNIBLE_HUMAN_INPUT.

JUDGE QUESTIONS
Generate 3-5 specific questions the judging panel could ask the team to probe their thinking and validate their work. Base them on the repository and the problem statement.

Return ONLY valid JSON. No markdown, no extra commentary.

OUTPUT FORMAT
{{
  "total_score": <int 0-1000>,
  "percentage": <float>,
  "verdict": "<OUTSTANDING|EXCELLENT|SATISFACTORY|NEEDS_WORK>",
  "category_scores": {{{", ".join(f'"{cat}": <int>' for cat in categories)}}},
  "authenticity_band": "<HIGH_HUMAN_INPUT|MIXED|PREDOMINANTLY_ASSISTED|NO_DISCERNIBLE_HUMAN_INPUT>",
  "overall_assessment": "<2-4 sentences>",
  "key_strengths": ["..."],
  "areas_for_improvement": ["..."],
  "red_flags": ["..."],
  "recommendation": "<one sentence>",
  {_default_sample_questions()}
}}
"""


def build_non_tech_prompt(
    problem_statement: str,
    document_text: str,
    ppt_text: str = "",
    categories: Dict[str, int] = None,
    repo_summary: dict = None,
) -> str:
    categories = categories or NON_TECH_CATEGORIES
    rubric_lines = _format_rubric(categories)
    ppt_section = f"\n\nOPTIONAL PPT CONTENT\n{ppt_text[:5000]}" if ppt_text else ""
    repo_section = ""
    if repo_summary and repo_summary.get("valid"):
        repo_section = f"""\n\nOPTIONAL GITHUB REPOSITORY
Owner/Repo: {repo_summary.get('owner')}/{repo_summary.get('repo')}
Files: {len(repo_summary.get('files', []))}
README: {repo_summary.get('readme', '')[:3000]}
"""

    return f"""You are a rigorous senior hackathon evaluator for non-technical project submissions. Evaluate the submitted document against the problem statement.

PROBLEM STATEMENT
{problem_statement}

SUBMITTED DOCUMENT
{document_text[:12000]}
{ppt_section}
{repo_section}

{rubric_lines}

CRITICAL SCORING RULES
- Default to SATISFACTORY unless specific evidence supports EXCELLENT or OUTSTANDING.
- Do NOT give every category a similar score; scores per category should vary.
- If the submission mostly restates the problem statement, score Solution Effectiveness and Research & Evidence very low.
- If the document is extremely short, return total_score 0 and verdict "NEEDS_WORK".

AUTHENTICITY GATE (classify only; final multiplier applied server-side)
Classify the apparent human effort as one of: HIGH_HUMAN_INPUT, MIXED, PREDOMINANTLY_ASSISTED, NO_DISCERNIBLE_HUMAN_INPUT.

JUDGE QUESTIONS
Generate 3-5 specific questions the judging panel could ask the team to probe their reasoning, evidence, and design choices.

Return ONLY valid JSON. No markdown, no extra commentary.

OUTPUT FORMAT
{{
  "total_score": <int 0-1000>,
  "percentage": <float>,
  "verdict": "<OUTSTANDING|EXCELLENT|SATISFACTORY|NEEDS_WORK>",
  "category_scores": {{{", ".join(f'"{cat}": <int>' for cat in categories)}}},
  "authenticity_band": "<HIGH_HUMAN_INPUT|MIXED|PREDOMINANTLY_ASSISTED|NO_DISCERNIBLE_HUMAN_INPUT>",
  "overall_assessment": "<2-4 sentences>",
  "key_strengths": ["..."],
  "areas_for_improvement": ["..."],
  "red_flags": ["..."],
  "recommendation": "<one sentence>",
  {_default_sample_questions()}
}}
"""
