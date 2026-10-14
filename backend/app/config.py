import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

DEFAULT_SECRET_KEY = "change-me-in-production"


class Settings(BaseSettings):
    # "production" turns on startup safety checks (see validate_production).
    environment: str = "development"
    database_url: str = "sqlite:///./hackathon.db"
    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    # Optional generic LLM endpoint; leave empty unless you run one.
    ai_backend_url: str = ""
    ai_backend_token: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    # Per-request timeout for LLM calls, in seconds. Keep below the gunicorn/nginx timeouts.
    llm_timeout_seconds: int = 60
    github_token: str = ""
    upload_dir: str = "uploads"
    max_upload_size: int = 20 * 1024 * 1024  # 20 MB
    disable_api_docs: bool = False
    # Comma-separated list of allowed CORS origins, or "*".
    cors_origins: str = "*"

    # ZECATHON_ENV_FILE points at a different (or nonexistent) .env file. Scripts use it to
    # ignore backend/.env, because on Windows an env var set to "" is dropped, not blanked.
    model_config = SettingsConfigDict(
        env_file=os.environ.get("ZECATHON_ENV_FILE", str(BASE_DIR / ".env")),
        env_file_encoding="utf-8",
    )

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    def validate_production(self) -> None:
        """Refuse to start a production server with unsafe defaults."""
        if not self.is_production:
            return
        if not self.secret_key or self.secret_key == DEFAULT_SECRET_KEY or len(self.secret_key) < 32:
            raise RuntimeError(
                "SECRET_KEY is missing, too short, or still the default. "
                "Set a random value of at least 32 characters before starting in production."
            )
        if self.database_url.startswith("sqlite"):
            raise RuntimeError("DATABASE_URL points to SQLite; production must use PostgreSQL.")


settings = Settings()
