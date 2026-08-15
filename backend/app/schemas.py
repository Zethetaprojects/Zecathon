from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models import SubmissionType, SubmissionStatus, UserRole


# Auth schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.participant

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in v):
            raise ValueError("Password must contain at least one symbol")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: UserRole) -> UserRole:
        if v not in (UserRole.participant, UserRole.organizer):
            raise ValueError("Registration is only allowed for participant or organizer roles")
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
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
    rubric: Optional[Dict[str, Any]] = None


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
    submission_url: Optional[str] = None
    github_url: Optional[str] = None
    ppt_url: Optional[str] = None


class SubmissionOut(BaseModel):
    id: int
    team_id: int
    problem_statement_id: int
    type: SubmissionType
    submission_url: str
    github_url: Optional[str]
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
    judge_questions: List[str] = []
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


# Report schemas
class TeamReportEntry(BaseModel):
    team_id: int
    team_name: str
    problem_statement_id: int
    problem_statement_title: str
    submission_id: Optional[int] = None
    type: Optional[str] = None
    total_score: Optional[int] = None
    verdict: Optional[str] = None
    status: Optional[str] = None
    needs_review: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class HackathonReportSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    problem_statement_count: int
    team_count: int
    submission_count: int
    evaluated_count: int
    average_score: Optional[float] = None
    top_team_name: Optional[str] = None
    top_team_score: Optional[int] = None
    verdict_breakdown: Dict[str, int]
    type_breakdown: Dict[str, int]

    model_config = ConfigDict(from_attributes=True)


class HackathonReportDetail(HackathonReportSummary):
    team_entries: List[TeamReportEntry] = []

    model_config = ConfigDict(from_attributes=True)
