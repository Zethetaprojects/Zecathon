from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import require_organizer
from app.database import get_db
from app.models import Evaluation, Hackathon, ProblemStatement, Submission, Team, User, UserRole
from app.schemas import HackathonReportDetail, HackathonReportSummary, SubmissionReport, TeamReportEntry, EvaluationOut
from app.services.pdf_generator import generate_pdf

router = APIRouter()


def _aggregate(rows, problem_statement_count: int) -> dict:
    submission_count = len(rows)
    evaluated_rows = [r for r in rows if r[3] is not None]
    evaluated_count = len(evaluated_rows)
    scores = [ev.total_score for _, _, _, ev in evaluated_rows]
    average_score = round(sum(scores) / len(scores), 1) if scores else None

    verdict_breakdown: dict = defaultdict(int)
    type_breakdown: dict = defaultdict(int)
    top_team_name: Optional[str] = None
    top_team_score: Optional[int] = None

    for team, _, submission, evaluation in rows:
        type_breakdown[submission.type.value if submission.type else "unknown"] += 1
        if evaluation:
            verdict_breakdown[evaluation.verdict] += 1
            if top_team_score is None or evaluation.total_score > top_team_score:
                top_team_score = evaluation.total_score
                top_team_name = team.name

    return {
        "problem_statement_count": problem_statement_count,
        "team_count": len({team.id for team, _, _, _ in rows}),
        "submission_count": submission_count,
        "evaluated_count": evaluated_count,
        "average_score": average_score,
        "top_team_name": top_team_name,
        "top_team_score": top_team_score,
        "verdict_breakdown": dict(verdict_breakdown),
        "type_breakdown": dict(type_breakdown),
    }


def _build_report(db: Session, hackathon: Hackathon) -> HackathonReportDetail:
    problem_statement_count = (
        db.query(ProblemStatement).filter(ProblemStatement.hackathon_id == hackathon.id).count()
    )

    rows = (
        db.query(Team, ProblemStatement, Submission, Evaluation)
        .join(Submission, Team.id == Submission.team_id)
        .join(ProblemStatement, Submission.problem_statement_id == ProblemStatement.id)
        .outerjoin(Evaluation, Submission.id == Evaluation.submission_id)
        .filter(Team.hackathon_id == hackathon.id)
        .order_by(Team.created_at.asc())
        .all()
    )

    agg = _aggregate(rows, problem_statement_count)

    team_entries = [
        TeamReportEntry(
            team_id=team.id,
            team_name=team.name,
            problem_statement_id=ps.id,
            problem_statement_title=ps.title,
            submission_id=sub.id,
            type=sub.type.value if sub.type else None,
            total_score=ev.total_score if ev else None,
            verdict=ev.verdict if ev else None,
            status=sub.status.value if sub.status else None,
            needs_review=ev.needs_review if ev else None,
        )
        for team, ps, sub, ev in rows
    ]

    return HackathonReportDetail(
        id=hackathon.id,
        name=hackathon.name,
        description=hackathon.description,
        start_date=hackathon.start_date,
        end_date=hackathon.end_date,
        team_entries=team_entries,
        **agg,
    )


@router.get("", response_model=List[HackathonReportSummary])
async def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    hackathons = db.query(Hackathon).order_by(Hackathon.created_at.desc()).all()
    reports: List[HackathonReportSummary] = []
    for hackathon in hackathons:
        if current_user.role != UserRole.admin and hackathon.created_by != current_user.id:
            continue
        problem_statement_count = (
            db.query(ProblemStatement).filter(ProblemStatement.hackathon_id == hackathon.id).count()
        )
        rows = (
            db.query(Team, ProblemStatement, Submission, Evaluation)
            .join(Submission, Team.id == Submission.team_id)
            .join(ProblemStatement, Submission.problem_statement_id == ProblemStatement.id)
            .outerjoin(Evaluation, Submission.id == Evaluation.submission_id)
            .filter(Team.hackathon_id == hackathon.id)
            .all()
        )
        agg = _aggregate(rows, problem_statement_count)
        reports.append(
            HackathonReportSummary(
                id=hackathon.id,
                name=hackathon.name,
                description=hackathon.description,
                start_date=hackathon.start_date,
                end_date=hackathon.end_date,
                **agg,
            )
        )
    return reports


@router.get("/submission/{submission_id}", response_model=SubmissionReport)
async def get_submission_report(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    submission = (
        db.query(Submission)
        .filter(Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    team = db.query(Team).filter(Team.id == submission.team_id).first()
    problem_statement = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    hackathon = db.query(Hackathon).filter(Hackathon.id == team.hackathon_id).first() if team else None

    if current_user.role != UserRole.admin and hackathon and hackathon.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can view this report")

    return _build_submission_report(submission, team, problem_statement, hackathon)


def _build_submission_report(
    submission: Submission,
    team: Team | None,
    problem_statement: ProblemStatement | None,
    hackathon: Hackathon | None,
) -> SubmissionReport:
    return SubmissionReport(
        id=submission.id,
        team_id=submission.team_id,
        problem_statement_id=submission.problem_statement_id,
        type=submission.type,
        submission_url=submission.submission_url,
        github_url=submission.github_url,
        ppt_url=submission.ppt_url,
        status=submission.status,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
        team_name=team.name if team else "",
        problem_statement_title=problem_statement.title if problem_statement else "",
        hackathon_name=hackathon.name if hackathon else "",
        evaluation=EvaluationOut.model_validate(submission.evaluation) if submission.evaluation else None,
    )


@router.get("/submission/{submission_id}", response_model=SubmissionReport)
async def get_submission_report(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    submission = (
        db.query(Submission)
        .filter(Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    team = db.query(Team).filter(Team.id == submission.team_id).first()
    problem_statement = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    hackathon = db.query(Hackathon).filter(Hackathon.id == team.hackathon_id).first() if team else None

    if current_user.role != UserRole.admin and hackathon and hackathon.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can view this report")

    return _build_submission_report(submission, team, problem_statement, hackathon)


@router.get("/submission/{submission_id}/pdf")
async def download_submission_report_pdf(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    submission = (
        db.query(Submission)
        .filter(Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    team = db.query(Team).filter(Team.id == submission.team_id).first()
    problem_statement = db.query(ProblemStatement).filter(ProblemStatement.id == submission.problem_statement_id).first()
    hackathon = db.query(Hackathon).filter(Hackathon.id == team.hackathon_id).first() if team else None

    if current_user.role != UserRole.admin and hackathon and hackathon.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can view this report")

    report = _build_submission_report(submission, team, problem_statement, hackathon)

    try:
        pdf_bytes = generate_pdf(report)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {exc}")

    safe_team_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in (team.name if team else "team")).lower()
    filename = f"{safe_team_name}-report.pdf"

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{hackathon_id}", response_model=HackathonReportDetail)
async def get_report(
    hackathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_organizer),
):
    hackathon = db.query(Hackathon).filter(Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if current_user.role != UserRole.admin and hackathon.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the hackathon organiser or an admin can view this report")
    return _build_report(db, hackathon)
