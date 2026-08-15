import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.routers import auth, hackathons, problem_statements, teams, submissions, evaluate, leaderboard, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield


app = FastAPI(
    title="Hackathon Evaluation Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(hackathons.router, prefix="/api/hackathons", tags=["hackathons"])
app.include_router(problem_statements.router, prefix="/api/problem-statements", tags=["problem-statements"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])
app.include_router(evaluate.router, prefix="/api/evaluate", tags=["evaluate"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
