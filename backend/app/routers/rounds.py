"""Hackathon rounds, shortlists and judges' marks.

Round 1 is the hackathon itself. Organisers add rounds 2, 3... and shortlist the
teams that advance; once a round is published those teams see it and may submit
to it. Judges (and the hackathon's managers) can mark any submission out of
1000; each round's judge weight decides how much those marks count against the
AI score on that round's leaderboard.
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_active_user, require_permission
from app.database import get_db
from app.models import Hackathon, HackathonRound, JudgeScore, RoundShortlist, Submission, Team, TeamMember, User, UserRole
from app.routers.common import can_access_hackathon, can_manage_hackathon
from app.schemas import JudgeScoreIn, JudgeScoreOut, RoundOut, RoundUpdate, ShortlistUpdate
from app.services.rounds import get_round, last_round_number, round_name

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_ROUNDS = 10


def _hackathon(db: Session, hackathon_id: int) -> Hackathon:
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    return hackathon


def _managed_hackathon(db: Session, hackathon_id: int, user: User) -> Hackathon:
    hackathon = _hackathon(db, hackathon_id)
    if not can_manage_hackathon(user, hackathon):
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can change its rounds")
    return hackathon


def _round_out(db: Session, hackathon: Hackathon, number: int, row: HackathonRound | None, user: User) -> RoundOut:
    staff = can_manage_hackathon(user, hackathon) or user.role == UserRole.judge
    submission_count = (
        db.query(Submission)
        .join(Team, Submission.team_id == Team.id)
        .filter(Team.hackathon_id == hackathon.id, Submission.round_number == number)
        .count()
    )
    out = RoundOut(
        number=number,
        name=round_name(number, row),
        instructions=row.instructions if row else None,
        submission_deadline=hackathon.submission_deadline if number == 1 else (row.submission_deadline if row else None),
        judge_weight=row.judge_weight if row else 0,
        # Round 1 is open to every team from the start.
        published=True if number == 1 else bool(row and row.published),
        submission_count=submission_count,
    )
    if number > 1 and row and (staff or row.published):
        teams = sorted((s.team for s in row.shortlist if s.team), key=lambda t: t.name.lower())
        out.shortlisted_team_ids = [t.id for t in teams]
        out.shortlisted_teams = [{"id": t.id, "name": t.name} for t in teams]
    return out


def _all_rounds(db: Session, hackathon: Hackathon, user: User) -> List[RoundOut]:
    rows = {
        r.number: r
        for r in db.query(HackathonRound)
        .options(selectinload(HackathonRound.shortlist).selectinload(RoundShortlist.team))
        .filter(HackathonRound.hackathon_id == hackathon.id)
    }
    numbers = sorted({1, *rows})
    return [_round_out(db, hackathon, n, rows.get(n), user) for n in numbers]


@router.get("/{hackathon_id}/rounds", response_model=List[RoundOut])
def list_rounds(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    hackathon = _hackathon(db, hackathon_id)
    if not can_access_hackathon(current_user, hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    return _all_rounds(db, hackathon, current_user)


@router.get("/public/{hackathon_id}/rounds", response_model=List[RoundOut])
def list_public_rounds(hackathon_id: int, db: Session = Depends(get_db)):
    """Rounds as anyone may see them: unpublished rounds keep their shortlist hidden."""
    hackathon = _hackathon(db, hackathon_id)
    anonymous = User(id=0, role=UserRole.participant)
    return _all_rounds(db, hackathon, anonymous)


@router.post("/{hackathon_id}/rounds", response_model=RoundOut, status_code=status.HTTP_201_CREATED)
def add_round(
    hackathon_id: int,
    payload: RoundUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_hackathon")),
):
    hackathon = _managed_hackathon(db, hackathon_id, current_user)
    number = last_round_number(db, hackathon_id) + 1
    if number > MAX_ROUNDS:
        raise HTTPException(status_code=400, detail=f"A hackathon can have at most {MAX_ROUNDS} rounds")
    row = HackathonRound(
        hackathon_id=hackathon_id,
        number=number,
        name=payload.name,
        instructions=payload.instructions,
        submission_deadline=payload.submission_deadline,
        judge_weight=payload.judge_weight if payload.judge_weight is not None else 0,
        published=False,  # publish after shortlisting
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info("Round %s added to hackathon id=%s by user id=%s", number, hackathon_id, current_user.id)
    return _round_out(db, hackathon, number, row, current_user)


@router.put("/{hackathon_id}/rounds/{number}", response_model=RoundOut)
def update_round(
    hackathon_id: int,
    number: int,
    payload: RoundUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_hackathon")),
):
    hackathon = _managed_hackathon(db, hackathon_id, current_user)
    row = get_round(db, hackathon_id, number)
    if not row:
        if number != 1:
            raise HTTPException(status_code=404, detail="Round not found")
        # Round 1 gets a settings row the first time it is named or weighted.
        row = HackathonRound(hackathon_id=hackathon_id, number=1, judge_weight=0, published=True)
        db.add(row)

    fields = payload.model_fields_set
    if "name" in fields:
        row.name = payload.name
    if "instructions" in fields:
        row.instructions = payload.instructions
    if "judge_weight" in fields and payload.judge_weight is not None:
        row.judge_weight = payload.judge_weight
    if number > 1:
        if "submission_deadline" in fields:
            row.submission_deadline = payload.submission_deadline
        if "published" in fields and payload.published is not None:
            if payload.published and not row.shortlist:
                raise HTTPException(status_code=400, detail="Shortlist at least one team before publishing this round")
            row.published = payload.published
    db.commit()
    db.refresh(row)
    logger.info("Round %s of hackathon id=%s updated by user id=%s (%s)", number, hackathon_id, current_user.id, sorted(fields))
    return _round_out(db, hackathon, number, row, current_user)


@router.delete("/{hackathon_id}/rounds/{number}", status_code=status.HTTP_204_NO_CONTENT)
def delete_round(
    hackathon_id: int,
    number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_hackathon")),
):
    _managed_hackathon(db, hackathon_id, current_user)
    if number == 1:
        raise HTTPException(status_code=400, detail="Round 1 is the hackathon itself and cannot be removed")
    row = get_round(db, hackathon_id, number)
    if not row:
        raise HTTPException(status_code=404, detail="Round not found")
    if number != last_round_number(db, hackathon_id):
        raise HTTPException(status_code=400, detail="Remove the later rounds first")
    has_submissions = (
        db.query(Submission)
        .join(Team, Submission.team_id == Team.id)
        .filter(Team.hackathon_id == hackathon_id, Submission.round_number == number)
        .first()
    )
    if has_submissions:
        raise HTTPException(status_code=400, detail="Teams have already submitted to this round, so it cannot be removed")
    db.delete(row)
    db.commit()
    logger.info("Round %s removed from hackathon id=%s by user id=%s", number, hackathon_id, current_user.id)
    return None


@router.put("/{hackathon_id}/rounds/{number}/shortlist", response_model=RoundOut)
def set_shortlist(
    hackathon_id: int,
    number: int,
    payload: ShortlistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_hackathon")),
):
    """Replace the list of teams that advance to this round."""
    hackathon = _managed_hackathon(db, hackathon_id, current_user)
    if number == 1:
        raise HTTPException(status_code=400, detail="Every team takes part in round 1; shortlists start from round 2")
    row = get_round(db, hackathon_id, number)
    if not row:
        raise HTTPException(status_code=404, detail="Round not found")

    wanted = set(payload.team_ids)
    valid = {t.id for t in db.query(Team.id).filter(Team.hackathon_id == hackathon_id, Team.id.in_(wanted))} if wanted else set()
    unknown = wanted - valid
    if unknown:
        raise HTTPException(status_code=400, detail=f"Teams not in this hackathon: {sorted(unknown)}")
    if not wanted and row.published:
        raise HTTPException(status_code=400, detail="Unpublish the round before clearing its shortlist")

    removed = [s for s in row.shortlist if s.team_id not in wanted]
    submitted = {
        s.team_id
        for s in db.query(Submission.team_id).filter(
            Submission.round_number == number, Submission.team_id.in_([r.team_id for r in removed] or [0])
        )
    }
    if submitted:
        names = [s.team.name for s in removed if s.team_id in submitted]
        raise HTTPException(status_code=400, detail=f"Already submitted to this round, so they stay shortlisted: {', '.join(names)}")

    for s in removed:
        db.delete(s)
    existing = {s.team_id for s in row.shortlist}
    for team_id in wanted - existing:
        db.add(RoundShortlist(round_id=row.id, team_id=team_id))
    db.commit()
    db.refresh(row)
    logger.info("Shortlist for round %s of hackathon id=%s set to %s teams by user id=%s", number, hackathon_id, len(wanted), current_user.id)
    return _round_out(db, hackathon, number, row, current_user)


@router.get("/{hackathon_id}/rounds/my-status")
def my_round_status(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """For a participant: which published rounds their team advanced to."""
    hackathon = _hackathon(db, hackathon_id)
    team = (
        db.query(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .filter(Team.hackathon_id == hackathon.id, TeamMember.user_id == current_user.id)
        .first()
    )
    if not team:
        return {"team_id": None, "rounds": []}
    rounds = (
        db.query(HackathonRound)
        .filter(HackathonRound.hackathon_id == hackathon.id, HackathonRound.number > 1, HackathonRound.published.is_(True))
        .order_by(HackathonRound.number)
        .all()
    )
    return {
        "team_id": team.id,
        "rounds": [
            {"number": r.number, "name": round_name(r.number, r), "shortlisted": any(s.team_id == team.id for s in r.shortlist)}
            for r in rounds
        ],
    }


# ---------------------------------------------------------------- judges' marks
judge_router = APIRouter()


def _submission_for_judging(db: Session, submission_id: int, user: User) -> Submission:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    hackathon = submission.team.hackathon if submission.team else None
    if not (user.role == UserRole.judge or can_manage_hackathon(user, hackathon)):
        raise HTTPException(status_code=403, detail="Only judges and the hackathon's organisers can mark submissions")
    return submission


@judge_router.get("/{submission_id}/judge-scores", response_model=List[JudgeScoreOut])
def list_judge_scores(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    submission = _submission_for_judging(db, submission_id, current_user)
    return sorted(submission.judge_scores, key=lambda j: j.updated_at)


@judge_router.put("/{submission_id}/judge-score", response_model=JudgeScoreOut)
def set_judge_score(
    submission_id: int,
    payload: JudgeScoreIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    """Create or replace the current user's mark for a submission."""
    submission = _submission_for_judging(db, submission_id, current_user)
    mark = (
        db.query(JudgeScore)
        .filter(JudgeScore.submission_id == submission.id, JudgeScore.judge_id == current_user.id)
        .first()
    )
    if mark:
        mark.score = payload.score
        mark.comment = payload.comment
    else:
        mark = JudgeScore(submission_id=submission.id, judge_id=current_user.id, score=payload.score, comment=payload.comment)
        db.add(mark)
    db.commit()
    db.refresh(mark)
    logger.info("Judge mark %s for submission id=%s by user id=%s", payload.score, submission.id, current_user.id)
    return mark


@judge_router.delete("/{submission_id}/judge-score", status_code=status.HTTP_204_NO_CONTENT)
def delete_judge_score(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evaluate_submission")),
):
    submission = _submission_for_judging(db, submission_id, current_user)
    mark = (
        db.query(JudgeScore)
        .filter(JudgeScore.submission_id == submission.id, JudgeScore.judge_id == current_user.id)
        .first()
    )
    if not mark:
        raise HTTPException(status_code=404, detail="You have not marked this submission")
    db.delete(mark)
    db.commit()
    return None
