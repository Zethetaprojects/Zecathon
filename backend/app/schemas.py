from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, EmailStr

from app.models import SubmissionType, SubmissionStatus


# Auth schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# Hackathon schemas
class HackathonBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class HackathonCreate(HackathonBase):
    pass


class HackathonOut(HackathonBase):
    id: int
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HackathonDetail(HackathonOut):
    problem_statements: List["ProblemStatementOut"] = []
    teams: List["TeamOut"] = []

    model_config = ConfigDict(from_attributes=True)


# Problem statement schemas
class ProblemStatementCreate(BaseModel):
    title: str
    description: Optional[str] = None


class ProblemStatementOut(ProblemStatementCreate):
    id: int
    hackathon_id: int
    file_path: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Team schemas
class TeamCreate(BaseModel):
    hackathon_id: int
    name: str


class TeamMemberOut(BaseModel):
    id: int
    user_id: int
    username: str
    role: str
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamOut(BaseModel):
    id: int
    hackathon_id: int
    name: str
    created_at: datetime
    members: List[TeamMemberOut] = []

    model_config = ConfigDict(from_attributes=True)


# Submission schemas
class SubmissionCreate(BaseModel):
    problem_statement_id: int
    type: SubmissionType
    submission_url: str
    ppt_url: Optional[str] = None


class SubmissionOut(BaseModel):
    id: int
    team_id: int
    problem_statement_id: int
    type: SubmissionType
    submission_url: str
    ppt_url: Optional[str]
    status: SubmissionStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvaluationOut(BaseModel):
    id: int
    submission_id: int
    total_score: int
    percentage: float
    verdict: str
    raw_score: int
    multiplier: float
    authenticity_band: str
    category_scores: Dict[str, Any]
    review_flags: List[str]
    needs_review: bool
    evaluated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubmissionDetail(SubmissionOut):
    evaluation: Optional[EvaluationOut] = None

    model_config = ConfigDict(from_attributes=True)


class LeaderboardEntry(BaseModel):
    team_id: int
    team_name: str
    problem_statement_id: int
    problem_statement_title: str
    submission_id: int
    type: SubmissionType
    total_score: int
    percentage: float
    verdict: str
    needs_review: bool

    model_config = ConfigDict(from_attributes=True)
