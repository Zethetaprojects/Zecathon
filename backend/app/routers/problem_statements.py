from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.database import get_db
from app.models import Hackathon, ProblemStatement, User
from app.routers.common import can_access_hackathon
from app.schemas import ProblemStatementOut

router = APIRouter()


@router.get("/{problem_statement_id}", response_model=ProblemStatementOut)
async def get_problem_statement(
    problem_statement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ps = db.query(ProblemStatement).filter(ProblemStatement.id == problem_statement_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Problem statement not found")
    if not can_access_hackathon(current_user, ps.hackathon):
        raise HTTPException(status_code=403, detail="You do not have access to this hackathon")
    return ps
