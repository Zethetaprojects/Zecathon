from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    database_url: str = "sqlite:///./hackathon.db"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    ai_backend_url: str = "http://localhost:5000"
    ai_backend_token: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"
    github_token: str = ""
    upload_dir: str = "uploads"
    max_upload_size: int = 20 * 1024 * 1024  # 20 MB

    class Config:
        env_file = BASE_DIR / ".env"
        env_file_encoding = "utf-8"


settings = Settings()
