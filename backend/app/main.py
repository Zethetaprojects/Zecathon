import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base, ensure_columns, _ensure_user_role_enum
from app.logger import setup_logging
from app.routers import auth, hackathons, problem_statements, teams, submissions, evaluate, leaderboard, reports, rounds


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    settings.validate_production()
    Base.metadata.create_all(bind=engine)
    ensure_columns(engine)
    _ensure_user_role_enum()
    os.makedirs(settings.upload_dir, exist_ok=True)
    logger = logging.getLogger("app.main")
    logger.info("ZECKATHON backend startup complete (environment=%s)", settings.environment)
    yield
    logger.info("ZECKATHON backend shutdown")


app = FastAPI(
    title="Hackathon Evaluation Platform",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.disable_api_docs else "/api/docs",
    redoc_url=None if settings.disable_api_docs else "/api/redoc",
    openapi_url=None if settings.disable_api_docs else "/api/openapi.json",
)

_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File types a browser could execute as a page if opened directly.
_ACTIVE_UPLOAD_SUFFIXES = (".svg", ".html", ".htm", ".xml", ".xhtml")


@app.middleware("http")
async def upload_security_headers(request: Request, call_next):
    """Uploaded files are user content served from the app's own origin, so make
    sure the browser never runs scripts from them (they could read the login token)."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/uploads/"):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "script-src 'none'; base-uri 'none'; form-action 'none'"
        if path.lower().endswith(_ACTIVE_UPLOAD_SUFFIXES):
            response.headers["Content-Disposition"] = "attachment"
    return response


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(hackathons.router, prefix="/api/hackathons", tags=["hackathons"])
app.include_router(rounds.router, prefix="/api/hackathons", tags=["rounds"])
app.include_router(problem_statements.router, prefix="/api/problem-statements", tags=["problem-statements"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(rounds.judge_router, prefix="/api/submissions", tags=["rounds"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])
app.include_router(evaluate.router, prefix="/api/evaluate", tags=["evaluate"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}
