from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


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


_add_user_role_column()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
