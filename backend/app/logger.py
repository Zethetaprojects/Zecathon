import logging
import logging.config
import os
from pathlib import Path
from typing import Optional

from app.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / "logs"
LOG_FILE = LOG_DIR / "app.log"
MAX_BYTES = 10 * 1024 * 1024  # 10 MB
BACKUP_COUNT = 5

DEFAULT_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "jsonish": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
            "datefmt": "%Y-%m-%dT%H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "level": "INFO",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "standard",
            "level": "INFO",
            "filename": str(LOG_FILE),
            "maxBytes": MAX_BYTES,
            "backupCount": BACKUP_COUNT,
            "encoding": "utf-8",
        },
    },
    "loggers": {
        "": {"handlers": ["console", "file"], "level": "INFO", "propagate": False},
        "uvicorn": {"handlers": ["console", "file"], "level": "INFO", "propagate": False},
        "uvicorn.access": {"handlers": ["console", "file"], "level": "INFO", "propagate": False},
    },
}


def _ensure_log_dir() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def _cleanup_old_rotated_logs() -> None:
    """Delete rotated logs beyond the configured backup count."""
    if not LOG_DIR.exists():
        return
    prefix = LOG_FILE.name + "."
    for path in LOG_DIR.iterdir():
        if path.is_file() and path.name.startswith(prefix):
            suffix = path.name[len(prefix) :]
            try:
                index = int(suffix)
            except ValueError:
                continue
            if index > BACKUP_COUNT:
                try:
                    path.unlink()
                except OSError:
                    pass


def setup_logging() -> None:
    """Configure logging with console and rotating file handlers."""
    _ensure_log_dir()
    _cleanup_old_rotated_logs()
    logging.config.dictConfig(DEFAULT_CONFIG)
    logger = logging.getLogger(__name__)
    logger.info("Logging configured: file=%s, max_bytes=%d, backup_count=%d", LOG_FILE, MAX_BYTES, BACKUP_COUNT)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    return logging.getLogger(name)
