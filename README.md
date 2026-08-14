# Hackathon Evaluation Platform

A web app for organising hackathons, collecting project submissions, and evaluating them with AI-powered scoring.

## Features
- User registration and login (JWT).
- Create hackathons and upload problem statements (PDF, DOCX, PPTX, XLSX, TXT, MD).
- Create teams and submit projects per problem statement.
- Two evaluator APIs:
  - **Tech**: evaluates a GitHub repository against a problem statement.
  - **Non-tech**: evaluates a project document, with an optional supporting PPT.
- Hackathon-oriented rubrics with admissibility gate, authenticity multiplier, and server-side score reconciliation.
- Live leaderboard with discrete, non-clustered scores.

## Tech stack
- **Backend**: FastAPI, SQLAlchemy, SQLite, Pydantic.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS.
- **LLM**: pluggable HTTP client (configure `AI_BACKEND_URL`). If no endpoint is set, a deterministic fallback evaluator is used for demo/testing.

## Quick start

### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # edit with your secret key / LLM endpoint
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in.

## Environment variables
Create `backend/.env` from `.env.example`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path (default: `sqlite:///./hackathon.db`) |
| `SECRET_KEY` | JWT signing secret |
| `AI_BACKEND_URL` | LLM endpoint, e.g. `http://localhost:5000` |
| `AI_BACKEND_TOKEN` | Bearer token for the LLM endpoint |
| `GITHUB_TOKEN` | GitHub token for higher API rate limits |
| `UPLOAD_DIR` | Directory for uploaded files (default: `uploads`) |
| `MAX_UPLOAD_SIZE` | Max upload bytes (default: 20 MB) |

## API overview

FastAPI auto-generated docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Key endpoints:
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — get JWT token
- `POST /api/hackathons` — create hackathon
- `POST /api/hackathons/{id}/problem-statements` — upload problem statement
- `POST /api/teams` — create team
- `POST /api/teams/{id}/join` — join a team
- `POST /api/submissions` — submit a project
- `POST /api/evaluate/tech/{submission_id}` — evaluate a tech submission
- `POST /api/evaluate/non-tech/{submission_id}` — evaluate a non-tech submission
- `GET /api/leaderboard/{hackathon_id}` — get leaderboard

## Evaluation details

Both evaluators return a score out of 1000 and a verdict:
- **850–1000**: OUTSTANDING
- **700–849**: EXCELLENT
- **500–699**: SATISFACTORY
- **0–499**: NEEDS WORK
- Gate reject: NOT ASSESSABLE

Tech rubric (8 categories):
1. Problem Understanding (150)
2. Implementation Completeness (200)
3. Code Quality & Architecture (150)
4. Innovation & Creativity (150)
5. Technical Feasibility (100)
6. Documentation (100)
7. Commit Authenticity / Effort (100)
8. Presentation / Demo (50)

Non-tech rubric (7 categories):
1. Problem-Specific Grounding (150)
2. Solution Effectiveness (200)
3. Research & Evidence (150)
4. Feasibility & Practicality (150)
5. Communication & Clarity (100)
6. Innovation & Creativity (150)
7. Presentation Quality (100)

The final score is the raw LLM score multiplied by an authenticity band (`HIGH_HUMAN_INPUT`, `MIXED`, `PREDOMINANTLY_ASSISTED`, `NO_DISCERNIBLE_HUMAN_INPUT`). The reconciliation step then applies a small deterministic jitter so that no two teams in the same hackathon end up with the exact same score, preserving ordering and verdict bands.

## Running tests

```bash
cd backend
venv\Scripts\pytest tests -v
```

The test suite covers auth, hackathons, problem statements, teams, submissions, tech/non-tech evaluation, and the discrete leaderboard.

## Production notes
- The default storage is local filesystem. For production, replace `app/services/file_storage.py` with S3-compatible storage.
- Set a strong `SECRET_KEY` and configure the LLM endpoint for real evaluations.
- Use a production database (PostgreSQL) by changing `DATABASE_URL`.
