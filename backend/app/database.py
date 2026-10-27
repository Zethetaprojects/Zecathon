import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # Postgres allows 100 connections by default; with up to 8 gunicorn workers,
    # 5 + 5 per worker stays under that. pre_ping drops connections Postgres closed.
    **({} if _is_sqlite else {"pool_size": 5, "max_overflow": 5, "pool_pre_ping": True, "pool_recycle": 1800}),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


MIGRATION_SPECS = {
    "hackathons": [
        ("rubric", "JSON"),
        ("duration_hours", "INTEGER"),
        ("banner_path", "VARCHAR"),
        ("max_participants", "INTEGER"),
        ("max_team_members", "INTEGER"),
        ("submission_deadline", "TIMESTAMP"),
        ("submission_guidelines", "TEXT"),
        ("one_statement_per_team", "BOOLEAN"),
        ("partner_name", "VARCHAR"),
        ("partner_slug", "VARCHAR"),
        ("partner_number", "INTEGER"),
        ("partner_logo_path", "VARCHAR"),
        ("partner_website", "VARCHAR"),
    ],
    "problem_statements": [
        ("rubric", "JSON"),
    ],
    "teams": [
        ("join_code", "VARCHAR"),
    ],
    "submissions": [
        ("github_url", "VARCHAR"),
        ("ppt_url", "VARCHAR"),
    ],
    "evaluations": [
        ("category_max_points", "JSON"),
        ("category_explanations", "JSON"),
        ("judge_questions", "JSON"),
        ("llm_source", "VARCHAR"),
    ],
}

# Before llm_source existed, a failed LLM call silently stored the mock scorer's
# output. Those rows have no category explanations and the fallback judge questions.
_MOCK_FINGERPRINT = "%biggest trade-off you made%"


def _sql_type(dialect: str, logical_type: str) -> str:
    """Map a logical column type to a concrete DDL type for SQLite or PostgreSQL."""
    if dialect == "sqlite":
        return {"JSON": "TEXT", "BOOLEAN": "INTEGER", "VARCHAR": "VARCHAR", "INTEGER": "INTEGER"}.get(
            logical_type, logical_type
        )
    return {"JSON": "JSONB"}.get(logical_type, logical_type)


def ensure_columns(engine):
    """Lightweight migration: add missing columns to existing tables.

    Works for both SQLite and PostgreSQL. Only additive changes are supported.
    """
    inspector = inspect(engine)
    dialect = engine.dialect.name
    for table, columns in MIGRATION_SPECS.items():
        try:
            existing = {c["name"] for c in inspector.get_columns(table)}
        except Exception:
            continue
        for col_name, col_type in columns:
            if col_name not in existing:
                with engine.begin() as conn:
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {col_name} {_sql_type(dialect, col_type)}")
                    )

    _flag_legacy_mock_evaluations(engine)

    # Each partner's hackathons are numbered 1, 2, 3... with no duplicates.
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_hackathons_partner ON hackathons(partner_slug, partner_number)"
            ))
    except Exception:
        logging.getLogger(__name__).exception("Could not create the partner URL index")

    # Ensure unique index on team join codes (existing NULLs are allowed by most DBs).
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code)"))
    except Exception:
        pass


def _flag_legacy_mock_evaluations(engine):
    """Mark legacy evaluations that look like silent mock fallbacks so organisers can re-run them."""
    try:
        if "evaluations" not in inspect(engine).get_table_names():
            return
        cast = "::text" if engine.dialect.name == "postgresql" else ""
        with engine.begin() as conn:
            conn.execute(
                text(
                    f"""
                    UPDATE evaluations
                    SET llm_source = 'suspected_mock', needs_review = :true
                    WHERE llm_source IS NULL
                      AND verdict <> 'NOT ASSESSABLE'
                      AND judge_questions{cast} LIKE :fingerprint
                      AND (category_explanations IS NULL OR category_explanations{cast} IN ('{{}}', 'null'))
                    """
                ),
                {"fingerprint": _MOCK_FINGERPRINT, "true": True},
            )
    except Exception:
        logging.getLogger(__name__).exception("Could not flag legacy mock evaluations")


def _add_user_role_column():
    """Lightweight migration: add role column to users if it doesn't exist."""
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.connect() as conn:
        tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
        if "users" not in tables:
            return
        columns = [row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
        if "role" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'participant'"))
            conn.commit()


def _ensure_user_role_enum():
    """Lightweight migration: ensure the PostgreSQL user role enum includes 'superadmin'."""
    if not settings.database_url.startswith("postgresql"):
        return
    try:
        with engine.begin() as conn:
            # Discover the enum type backing the users.role column and add superadmin if missing.
            row = conn.execute(
                text(
                    """
                    SELECT t.typname
                    FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    JOIN pg_attribute a ON a.atttypid = t.oid
                    JOIN pg_class c ON c.oid = a.attrelid
                    WHERE c.relname = 'users' AND a.attname = 'role'
                    LIMIT 1
                    """
                )
            ).fetchone()
            if row:
                enum_name = row[0]
                conn.execute(text(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS 'superadmin'"))
    except Exception:
        pass


_add_user_role_column()
_ensure_user_role_enum()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
