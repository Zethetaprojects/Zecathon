import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel as _PydanticBaseModel, ConfigDict, EmailStr, field_serializer, field_validator

from app.models import SubmissionType, SubmissionStatus, UserRole


PARTNER_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# Path segments that already mean something under /hackathons/.
RESERVED_PARTNER_SLUGS = {"new", "public", "edit", "teams", "leaderboard", "submit"}


def slugify(value: str) -> str:
    """'IIT Patna' -> 'iit-patna' (lowercase letters, digits and single hyphens)."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:50].rstrip("-")


def check_partner_slug(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    slug = value.strip().lower()
    if not (2 <= len(slug) <= 50) or not PARTNER_SLUG_RE.match(slug):
        raise ValueError("Partner URL name must be 2-50 lowercase letters, digits or single hyphens, e.g. iit-patna")
    if slug in RESERVED_PARTNER_SLUGS:
        raise ValueError(f"'{slug}' is reserved; choose another partner URL name")
    return slug


def to_naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Store every timestamp as naive UTC (the database columns have no time zone)."""
    if value is not None and value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


class BaseModel(_PydanticBaseModel):
    """Shared base for API schemas.

    Timestamps are stored as naive UTC. Serialize them with an explicit "Z" so
    browsers do not mistake them for local time (which shifted every displayed
    time by the viewer's UTC offset, e.g. 5h30 in India)."""

    @field_serializer("*", mode="wrap", when_used="json")
    def _serialize_utc(self, value, handler):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return handler(value)


def check_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(c.isalpha() for c in v):
        raise ValueError("Password must contain at least one letter")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one digit")
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in v):
        raise ValueError("Password must contain at least one symbol")
    return v


# Auth schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.participant

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return check_password_strength(v)

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


class AdminUserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.participant

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return check_password_strength(v)


class AdminPasswordUpdate(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return check_password_strength(v)


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


RUBRIC_TOTAL_POINTS = 1000


def check_rubric(v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """A custom rubric is {"tech": {...}, "non_tech": {...}} (either part optional),
    each mapping category names to whole points that add up to exactly 1000.
    The scorer ignores anything else, so reject it instead of saving it silently."""
    if v is None or v == {}:
        return None
    unknown = set(v) - {"tech", "non_tech"}
    if unknown:
        raise ValueError(f"Rubric keys must be 'tech' and/or 'non_tech' (got {', '.join(sorted(unknown))})")
    for kind, categories in v.items():
        label = "Tech" if kind == "tech" else "Non-tech"
        if not isinstance(categories, dict) or not categories:
            raise ValueError(f"{label} rubric must have at least one category")
        for name, points in categories.items():
            if not str(name).strip():
                raise ValueError(f"{label} rubric has a category without a name")
            if isinstance(points, bool) or not isinstance(points, int) or points < 1:
                raise ValueError(f"{label} rubric: '{name}' must be a whole number of points (at least 1)")
        total = sum(categories.values())
        if total != RUBRIC_TOTAL_POINTS:
            raise ValueError(f"{label} rubric must total exactly {RUBRIC_TOTAL_POINTS} points (currently {total})")
    return v


# Hackathon schemas
class HackathonBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    duration_hours: Optional[int] = None
    banner_path: Optional[str] = None
    rubric: Optional[Dict[str, Any]] = None
    max_participants: Optional[int] = None
    max_team_members: Optional[int] = None
    submission_deadline: Optional[datetime] = None
    submission_guidelines: Optional[str] = None
    one_statement_per_team: Optional[bool] = None
    partner_name: Optional[str] = None
    partner_slug: Optional[str] = None
    partner_website: Optional[str] = None

    @field_validator("partner_name")
    @classmethod
    def validate_partner_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        if len(v.strip()) > 100:
            raise ValueError("Partner name can be at most 100 characters")
        return v.strip()

    @field_validator("partner_slug")
    @classmethod
    def validate_partner_slug(cls, v: Optional[str]) -> Optional[str]:
        return check_partner_slug(v)

    @field_validator("partner_website")
    @classmethod
    def validate_partner_website(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        v = v.strip()
        if not re.match(r"^https?://[^\s/$.?#].[^\s]*$", v) or len(v) > 300:
            raise ValueError("Partner website must be a full link starting with https://")
        return v

    @field_validator("max_participants", "max_team_members")
    @classmethod
    def validate_positive_limit(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("Limit must be at least 1")
        return v

    @field_validator("start_date", "end_date", "submission_deadline")
    @classmethod
    def normalize_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        return to_naive_utc(v)

    @field_validator("submission_guidelines")
    @classmethod
    def validate_guidelines(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 10000:
            raise ValueError("Submission guidelines can be at most 10,000 characters")
        return v or None


class HackathonCreate(HackathonBase):
    @field_validator("rubric")
    @classmethod
    def validate_rubric(cls, v):
        return check_rubric(v)

    pass


class HackathonUpdate(HackathonBase):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    duration_hours: Optional[int] = None
    banner_path: Optional[str] = None
    rubric: Optional[Dict[str, Any]] = None
    max_participants: Optional[int] = None
    max_team_members: Optional[int] = None
    submission_deadline: Optional[datetime] = None
    submission_guidelines: Optional[str] = None
    one_statement_per_team: Optional[bool] = None
    partner_name: Optional[str] = None
    partner_slug: Optional[str] = None
    partner_website: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("rubric")
    @classmethod
    def validate_rubric(cls, v):
        return check_rubric(v)


class HackathonOut(HackathonBase):
    id: int
    created_by: int
    created_at: datetime
    partner_number: Optional[int] = None
    partner_logo_path: Optional[str] = None
    problem_statement_count: int = 0
    team_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class HackathonDetail(HackathonOut):
    problem_statements: List["ProblemStatementOut"] = []
    teams: List["TeamOut"] = []
    # True when the statements exist but are withheld until the hackathon starts.
    problem_statements_hidden: bool = False

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
    submission_count: int = 0
    rubric: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


# Team schemas
class TeamCreate(BaseModel):
    hackathon_id: int
    name: str


class TeamMemberAdd(BaseModel):
    username: str


class TeamMemberUpdate(BaseModel):
    role: str  # "leader" or "member"


class TeamJoinByCode(BaseModel):
    code: str


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
    join_code: Optional[str] = None
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
    round_number: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("round_number", mode="before")
    @classmethod
    def _default_round(cls, v):
        return v or 1


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
    category_max_points: Dict[str, int] = {}
    category_explanations: Dict[str, str] = {}
    review_flags: List[str]
    needs_review: bool
    judge_questions: List[str] = []
    overall_assessment: Optional[str] = None
    key_strengths: Optional[List[str]] = None
    areas_for_improvement: Optional[List[str]] = None
    llm_source: Optional[str] = None
    evaluated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubmissionDetail(SubmissionOut):
    evaluation: Optional[EvaluationOut] = None

    model_config = ConfigDict(from_attributes=True)


class StaffSubmissionDetail(SubmissionDetail):
    """A submission as organisers and judges see it, with the judges' marks."""

    judge_scores: List["JudgeScoreOut"] = []

    model_config = ConfigDict(from_attributes=True)


class SubmissionReport(SubmissionDetail):
    team_name: str
    problem_statement_title: str
    hackathon_name: str

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
    round_number: int = 1
    # Round score parts: total_score above is the final score for the round.
    ai_score: Optional[int] = None
    judge_score: Optional[float] = None
    judge_count: int = 0
    awaiting_judges: bool = False

    model_config = ConfigDict(from_attributes=True)


# Round schemas
class RoundOut(BaseModel):
    number: int
    name: str
    instructions: Optional[str] = None
    # Round 1 uses the hackathon's own deadline.
    submission_deadline: Optional[datetime] = None
    judge_weight: int = 0
    published: bool = False
    # Teams that advanced to this round (rounds 2+). Visible to the hackathon's
    # managers and judges always, and to everyone once the round is published.
    shortlisted_team_ids: Optional[List[int]] = None
    shortlisted_teams: Optional[List[Dict[str, Any]]] = None
    submission_count: int = 0


class RoundUpdate(BaseModel):
    name: Optional[str] = None
    instructions: Optional[str] = None
    submission_deadline: Optional[datetime] = None
    judge_weight: Optional[int] = None
    published: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) > 80:
                raise ValueError("Round name must be 80 characters or fewer")
        return v or None

    @field_validator("instructions")
    @classmethod
    def _instructions(cls, v):
        if v is not None and len(v) > 5000:
            raise ValueError("Round instructions must be 5000 characters or fewer")
        return v.strip() or None if v is not None else None

    @field_validator("judge_weight")
    @classmethod
    def _weight(cls, v):
        if v is not None and not 0 <= v <= 100:
            raise ValueError("Judge weight must be between 0 and 100")
        return v

    @field_validator("submission_deadline")
    @classmethod
    def _deadline(cls, v):
        return to_naive_utc(v)


class ShortlistUpdate(BaseModel):
    team_ids: List[int]


class JudgeScoreIn(BaseModel):
    score: int
    comment: Optional[str] = None

    @field_validator("score")
    @classmethod
    def _score(cls, v):
        if not 0 <= v <= 1000:
            raise ValueError("Score must be between 0 and 1000")
        return v

    @field_validator("comment")
    @classmethod
    def _comment(cls, v):
        if v is not None and len(v) > 2000:
            raise ValueError("Comment must be 2000 characters or fewer")
        return v.strip() or None if v is not None else None


class JudgeScoreOut(BaseModel):
    id: int
    submission_id: int
    judge_id: int
    judge_username: Optional[str] = None
    score: int
    comment: Optional[str] = None
    updated_at: datetime

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
    llm_source: Optional[str] = None
    round_number: int = 1

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


# Public (unauthenticated) hackathon schemas

class HackathonPublicOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    duration_hours: Optional[int] = None
    banner_path: Optional[str] = None
    submission_deadline: Optional[datetime] = None
    partner_name: Optional[str] = None
    partner_slug: Optional[str] = None
    partner_number: Optional[int] = None
    partner_logo_path: Optional[str] = None
    problem_statement_count: int = 0
    team_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PublicProblemStatement(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    file_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class HackathonPublicDetail(HackathonPublicOut):
    """What anyone can see without logging in (no teams, rubrics or scores)."""

    partner_website: Optional[str] = None
    submission_guidelines: Optional[str] = None
    one_statement_per_team: Optional[bool] = None
    max_team_members: Optional[int] = None
    problem_statements: List[PublicProblemStatement] = []
    problem_statements_hidden: bool = False


class HackathonPublicStats(BaseModel):
    total_hackathons: int
    total_teams: int
    total_submissions: int
    total_evaluations: int


# Global settings / feature-flag schemas
class RolePermissions(BaseModel):
    superadmin: Dict[str, bool]
    admin: Dict[str, bool]
    organizer: Dict[str, bool]
    judge: Dict[str, bool]
    participant: Dict[str, bool]


class GlobalSettingsOut(BaseModel):
    registration_open: bool
    role_permissions: RolePermissions


class GlobalSettingsUpdate(BaseModel):
    registration_open: Optional[bool] = None
    role_permissions: Optional[RolePermissions] = None


class MyPermissionsOut(BaseModel):
    role: UserRole
    permissions: Dict[str, bool]


StaffSubmissionDetail.model_rebuild()
