import datetime as dt
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey, Enum, JSON, Float
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    organizer = "organizer"
    judge = "judge"
    participant = "participant"


# Granular features that can be toggled per role by a superadmin.
FEATURES = [
    "create_hackathon",
    "edit_hackathon",
    "delete_hackathon",
    "manage_problem_statements",
    "create_team",
    "join_team",
    "manage_team_members",
    "submit_project",
    "evaluate_submission",
    "view_reports",
    "view_leaderboard",
    "manage_users",
    "view_admin_panel",
    "view_api_docs",
    "manage_settings",
    "participate",
]


def _default_role_permissions():
    return {
        "superadmin": {f: True for f in FEATURES},
        "admin": {f: True for f in FEATURES},
        "organizer": {
            "create_hackathon": True,
            "edit_hackathon": True,
            "delete_hackathon": True,
            "manage_problem_statements": True,
            "create_team": True,
            "join_team": True,
            "manage_team_members": True,
            "submit_project": True,
            "evaluate_submission": True,
            "view_reports": True,
            "view_leaderboard": True,
            "manage_users": False,
            "view_admin_panel": False,
            "view_api_docs": False,
            "manage_settings": False,
            "participate": True,
        },
        "judge": {
            "create_hackathon": False,
            "edit_hackathon": False,
            "delete_hackathon": False,
            "manage_problem_statements": False,
            "create_team": False,
            "join_team": False,
            "manage_team_members": False,
            "submit_project": False,
            "evaluate_submission": True,
            "view_reports": True,
            "view_leaderboard": True,
            "manage_users": False,
            "view_admin_panel": False,
            "view_api_docs": False,
            "manage_settings": False,
            "participate": False,
        },
        "participant": {
            "create_hackathon": False,
            "edit_hackathon": False,
            "delete_hackathon": False,
            "manage_problem_statements": False,
            "create_team": True,
            "join_team": True,
            "manage_team_members": True,
            "submit_project": True,
            "evaluate_submission": False,
            "view_reports": False,
            "view_leaderboard": True,
            "manage_users": False,
            "view_admin_panel": False,
            "view_api_docs": False,
            "manage_settings": False,
            "participate": True,
        },
    }


def _default_global_settings():
    return {
        "registration_open": True,
        "role_permissions": _default_role_permissions(),
    }


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.participant, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class GlobalSettings(Base):
    __tablename__ = "global_settings"

    id = Column(Integer, primary_key=True)
    registration_open = Column(Boolean, default=True, nullable=False)
    role_permissions = Column(JSON, nullable=False, default=_default_role_permissions)


class Hackathon(Base):
    __tablename__ = "hackathons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    rubric = Column(JSON, nullable=True, default=None)  # custom per-hackathon scoring rubric
    duration_hours = Column(Integer, nullable=True)  # hackathon duration from start_date
    banner_path = Column(String, nullable=True)  # uploaded banner image path/URL
    max_participants = Column(Integer, nullable=True)  # overall participant limit
    max_team_members = Column(Integer, nullable=True, default=6)  # max members per team
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    owner = relationship("User")
    problem_statements = relationship("ProblemStatement", back_populates="hackathon", cascade="all, delete-orphan")
    teams = relationship("Team", back_populates="hackathon", cascade="all, delete-orphan")


class ProblemStatement(Base):
    __tablename__ = "problem_statements"

    id = Column(Integer, primary_key=True, index=True)
    hackathon_id = Column(Integer, ForeignKey("hackathons.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    hackathon = relationship("Hackathon", back_populates="problem_statements")
    submissions = relationship("Submission", back_populates="problem_statement", cascade="all, delete-orphan")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    hackathon_id = Column(Integer, ForeignKey("hackathons.id"), nullable=False)
    name = Column(String, nullable=False)
    join_code = Column(String, nullable=True, unique=True)  # copyable team invite code
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    hackathon = relationship("Hackathon", back_populates="teams")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member")  # leader or member
    joined_at = Column(DateTime, default=dt.datetime.utcnow)

    team = relationship("Team", back_populates="members")
    user = relationship("User")

    @property
    def username(self) -> str | None:
        return self.user.username if self.user else None


class SubmissionType(str, enum.Enum):
    tech = "tech"
    non_tech = "non_tech"


class SubmissionStatus(str, enum.Enum):
    pending = "pending"
    evaluated = "evaluated"
    failed = "failed"
    not_assessable = "not_assessable"


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    problem_statement_id = Column(Integer, ForeignKey("problem_statements.id"), nullable=False)
    type = Column(Enum(SubmissionType), nullable=False)
    submission_url = Column(String, nullable=False)  # GitHub URL or uploaded file path/URL
    github_url = Column(String, nullable=True)     # optional GitHub for non-tech submissions
    ppt_url = Column(String, nullable=True)  # optional PPT for non-tech
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.pending)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    team = relationship("Team", back_populates="submissions")
    problem_statement = relationship("ProblemStatement", back_populates="submissions")
    evaluation = relationship("Evaluation", back_populates="submission", uselist=False, cascade="all, delete-orphan")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), unique=True, nullable=False)
    total_score = Column(Integer, nullable=False)
    percentage = Column(Float, nullable=False)
    verdict = Column(String, nullable=False)
    raw_score = Column(Integer, nullable=False)
    multiplier = Column(Float, nullable=False)
    authenticity_band = Column(String, nullable=False)
    category_scores = Column(JSON, default=dict)
    category_max_points = Column(JSON, default=dict)  # max points per rubric category
    category_explanations = Column(JSON, default=dict)  # per-rubric explanation text
    review_flags = Column(JSON, default=list)
    judge_questions = Column(JSON, default=list)  # suggested questions for the judging panel
    needs_review = Column(Boolean, default=False)
    evaluated_at = Column(DateTime, default=dt.datetime.utcnow)

    submission = relationship("Submission", back_populates="evaluation")
