from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
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
    ],
}


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

    # Ensure unique index on team join codes (existing NULLs are allowed by most DBs).
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code)"))
    except Exception:
        pass


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
