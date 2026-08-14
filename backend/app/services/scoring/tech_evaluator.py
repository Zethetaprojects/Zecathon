from typing import List

from sqlalchemy.orm import Session

from app.models import Evaluation, Submission, SubmissionStatus, SubmissionType, Team
from app.services.github_client import summarize_repo
from app.services.scoring.admissibility import tech_admissibility
from app.services.scoring.authenticity import tech_authenticity
from app.services.scoring.constants import verdict_for_score
from app.services.scoring.llm_client import LLMClient
from app.services.scoring.prompts import build_tech_prompt
from app.services.scoring.reconciliation import reconcile_score


def _existing_scores_for_hackathon(db: Session, hackathon_id: int, exclude_submission_id: int) -> List[int]:
    return [
        ev.total_score
        for ev in db.query(Evaluation)
        .join(Submission)
        .join(Team)
        .filter(Team.hackathon_id == hackathon_id, Submission.id != exclude_submission_id)
        .all()
    ]


def evaluate_tech(db: Session, submission: Submission, problem_statement: str) -> Evaluation:
    if submission.type != SubmissionType.tech:
        raise ValueError("Submission is not a tech submission")

    repo_summary = summarize_repo(submission.submission_url)
    admissible, reason = tech_admissibility(repo_summary)
    if not admissible:
        return _persist_not_assessable(db, submission, reason or "NOT_ASSESSABLE")

    prompt = build_tech_prompt(problem_statement, repo_summary)
    llm = LLMClient()
    result = llm.complete_json(prompt)

    raw_subtotal = int(result.get("total_score", 0))
    category_scores = result.get("category_scores", {})
    authenticity = tech_authenticity(repo_summary)

    team = db.query(Team).filter(Team.id == submission.team_id).first()
    existing = _existing_scores_for_hackathon(db, team.hackathon_id, submission.id)
    final_score = reconcile_score(raw_subtotal, authenticity["multiplier"], existing, submission.team_id)

    verdict = verdict_for_score(final_score)
    percentage = round(final_score / 10.0, 2)

    evaluation = Evaluation(
        submission_id=submission.id,
        total_score=final_score,
        percentage=percentage,
        verdict=verdict,
        raw_score=raw_subtotal,
        multiplier=authenticity["multiplier"],
        authenticity_band=authenticity["band"],
        category_scores=category_scores,
        review_flags=result.get("red_flags", []) if isinstance(result.get("red_flags"), list) else [],
        needs_review=verdict == "NEEDS WORK" or authenticity["band"] in ("PREDOMINANTLY_ASSISTED", "NO_DISCERNIBLE_HUMAN_INPUT"),
    )

    db.add(evaluation)
    submission.status = SubmissionStatus.evaluated
    db.commit()
    db.refresh(evaluation)
    return evaluation


def _persist_not_assessable(db: Session, submission: Submission, reason: str) -> Evaluation:
    evaluation = Evaluation(
        submission_id=submission.id,
        total_score=0,
        percentage=0.0,
        verdict="NOT ASSESSABLE",
        raw_score=0,
        multiplier=0.0,
        authenticity_band="NO_DISCERNIBLE_HUMAN_INPUT",
        category_scores={},
        review_flags=[reason],
        needs_review=True,
    )
    db.add(evaluation)
    submission.status = SubmissionStatus.not_assessable
    db.commit()
    db.refresh(evaluation)
    return evaluation
