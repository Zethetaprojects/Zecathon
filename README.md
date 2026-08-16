# Hackathon Evaluation Platform

A web app for organising hackathons, collecting project submissions, and evaluating them with AI-powered scoring.

## Features
- User registration and login (JWT).
- Create hackathons with a start date/time + duration, live countdown, and optional banner image. Organisers and admins can edit hackathon settings and replace the banner at any time.
- Public landing page showing upcoming hackathons and live platform stats.
- Upload problem statements (PDF, DOCX, PPTX, XLSX, TXT, MD).
- Create teams with a unique copyable join code; participants join by code, while team leaders and managers can add, remove, or promote members and change the team leader.
- Submit projects per problem statement.
- Two evaluator APIs:
  - **Tech**: evaluates a GitHub repository against a problem statement.
  - **Non-tech**: evaluates a project document, with an optional supporting PPT.
- Hackathon-oriented rubrics with admissibility gate, authenticity multiplier, and server-side score reconciliation.
- Live leaderboard with discrete, non-clustered scores and a public shareable link.
- Organiser/admin reports with verdict and submission-type breakdowns, plus per-team printable PDF reports.

## System overview

```mermaid
flowchart LR
    subgraph Users
        P[Participant / Student]
        O[Organiser]
        J[Judge]
        A[Admin]
    end

    subgraph Frontend
        R[React + Vite + Tailwind]
    end

    subgraph Backend
        F[FastAPI]
        Auth[JWT Auth]
        Eval[Evaluators]
        DB[(PostgreSQL)]
        FS[Uploads]
    end

    subgraph AI
        G[Gemini API]
    end

    P -->|register / login| R
    O -->|create hackathon| R
    R -->|/api/*| F
    F --> Auth --> DB
    F --> FS
    Eval -->|tech / non-tech| G
    Eval --> DB
```

### Authentication flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as React Frontend
    participant B as FastAPI
    participant DB as PostgreSQL

    U->>F: register / login
    F->>B: POST /api/auth/register or /login
    B->>DB: create user / verify hash
    B-->>F: access_token (JWT)
    F->>F: store token, fetch /api/auth/me
    F-->>U: role-aware UI
```

### Hackathon lifecycle

```mermaid
flowchart LR
    A[Organiser creates<br/>hackathon + rubric] --> B[Upload problem<br/>statements]
    B --> C[Participants create<br/>/ join teams]
    C --> D[Submit GitHub repo<br/>or document + PPT]
    D --> E[Judge / organiser<br/>evaluates]
    E --> F[Discrete scoring +<br/>judge questions]
    F --> G[Live leaderboard]
    F --> H[Reports]
```

### Evaluation pipeline

```mermaid
flowchart LR
    A[Submission] --> B[Extract text / repo]
    B --> C{Admissibility gate}
    C -->|reject| D[NOT ASSESSABLE]
    C -->|pass| E[Rubric scoring]
    E --> F[Authenticity multiplier]
    F --> G[Reconciliation +<br/>anti-clustering]
    G --> H[Verdict + judge<br/>questions]
```

### RBAC matrix

| Action | Admin | Organiser | Judge | Participant |
|---|---|---|---|---|
| Create hackathon | ✅ | ✅ | ❌ | ❌ |
| Edit hackathon settings / replace banner | ✅ | ✅ (own hackathons) | ❌ | ❌ |
| Upload problem statement | ✅ | ✅ (own hackathons) | ❌ | ❌ |
| Delete hackathon / team | ✅ | ✅ (own hackathons) | ❌ | ❌ |
| Create team | ✅ | ✅ (own hackathons) | ❌ | ✅ |
| Join team by invite code | ❌ | ❌ | ❌ | ✅ |
| Add member to team | ✅ | ✅ (own hackathons) | ❌ | ✅ (team leader) |
| Remove member from team | ✅ | ✅ (own hackathons) | ❌ | ✅ (team leader) |
| Change team leader | ✅ | ✅ (own hackathons) | ❌ | ✅ (team leader) |
| Submit project | ✅ | ✅ (own hackathons) | ❌ | ✅ (team member) |
| Evaluate submission | ✅ | ✅ (own hackathons) | ✅ | ❌ |
| View per-team evaluation report | ✅ | ✅ (own hackathons) | ❌ | ❌ |
| View authenticated leaderboard | ✅ | ✅ (own hackathons) | ✅ | ✅ |
| View public leaderboard / upcoming hackathons | ✅ | ✅ | ✅ | ✅ |

## Tech stack
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL (via Docker Compose), Pydantic.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS.
- **Deployment**: Docker, Docker Compose, nginx, GCP Cloud Run / Firebase Hosting.
- **LLM**: Google Gemini REST API (`GEMINI_API_KEY`, `GEMINI_MODEL`) with automatic model fallbacks. If no key is set, a deterministic fallback evaluator is used for demo/testing.

## Quick start

### Option A — Docker Compose (recommended)

This is the fastest way to run the full stack with PostgreSQL and a production-like setup:

```bash
cp backend/.env.example backend/.env   # optional: set GEMINI_API_KEY, SECRET_KEY, etc.
docker compose up --build
```

- Backend API docs: http://localhost:8000/docs
- Frontend: http://localhost
- PostgreSQL: localhost:5432 (user `zecathon`, password `zecathon_secret`, database `zecathon`)

### Option B — Local venv + Vite

For pure backend/frontend development without Docker:

### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # edit with your secret key / LLM endpoint
uvicorn app.main:app --reload --port 8002
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. One-command local start (optional)

From the project root you can start both backend and frontend dev servers at once:

```bash
# Git Bash / WSL / Linux / macOS
./start-dev.sh

# Windows PowerShell
.\start-dev.ps1
```

This starts the backend on `http://127.0.0.1:8002` and the Vite dev server on `http://localhost:5173`. Run `seed_dev.py` first if you want demo data in the reports page.

## Environment variables
Create `backend/.env` from `.env.example`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database connection. Default: `sqlite:///./hackathon.db`. Docker Compose uses `postgresql+psycopg2://zecathon:zecathon_secret@postgres:5432/zecathon`. |
| `SECRET_KEY` | JWT signing secret |
| `GEMINI_API_KEY` | Google Gemini API key (starts with `AIza...`). Optional — if absent, a deterministic fallback evaluator is used. |
| `GEMINI_MODEL` | Gemini model to use. Default: `gemini-3.5-flash-lite`. Fallbacks include `gemini-flash-latest`, `gemini-3.5-flash`, `gemini-3.7-flash`. |
| `GITHUB_TOKEN` | Optional: higher GitHub API rate limits. Public repos work without it. |
| `UPLOAD_DIR` | Directory for uploaded files (default: `uploads`) |
| `MAX_UPLOAD_SIZE` | Max upload bytes (default: 20 MB) |
| `AI_BACKEND_URL` | Optional legacy LLM endpoint fallback. |
| `AI_BACKEND_TOKEN` | Optional Bearer token for the legacy LLM endpoint. |

## API overview

FastAPI auto-generated docs: [http://localhost:8002/docs](http://localhost:8002/docs)

Key endpoints:
- `POST /api/auth/register` — create account (Student or Organiser only)
- `POST /api/auth/login` — get JWT token
- `GET /api/auth/admin/users` — admin user list
- `PUT /api/auth/users/{id}/role` — admin role update
- `GET /api/hackathons/public` — public upcoming hackathons (unauthenticated)
- `GET /api/hackathons/public/stats` — public platform stats (unauthenticated)
- `POST /api/hackathons` — create hackathon (organiser/admin)
- `PUT /api/hackathons/{id}` — edit hackathon settings and custom rubric (organiser/admin)
- `DELETE /api/hackathons/{id}` — delete hackathon and all data (organiser/admin)
- `POST /api/hackathons/{id}/problem-statements` — upload problem statement (organiser/admin)
- `POST /api/hackathons/{id}/banner` — upload hackathon banner image (organiser/admin)
- `POST /api/teams` — create team (participant; organiser/admin can create on behalf of their hackathons)
- `POST /api/teams/join-by-code` — join a team using its invite code (participant only)
- `POST /api/teams/{team_id}/members` — add a user to a team by username (team leader / organiser of owner hackathon / admin)
- `PATCH /api/teams/{team_id}/members/{member_id}` — change a member's role or promote a new leader (team leader / organiser of owner hackathon / admin)
- `DELETE /api/teams/{team_id}/members/{member_id}` — remove a member from a team (team leader / organiser of owner hackathon / admin)
- `POST /api/teams/{id}/join` — join a team by ID (legacy participant endpoint)
- `DELETE /api/teams/{id}` — delete team and submissions (organiser of owner hackathon / admin)
- `POST /api/submissions` — submit a project (participant; organiser/admin can submit on behalf of their hackathons)
- `POST /api/evaluate/tech/{submission_id}` — evaluate a tech submission (judge/organiser of owner hackathon/admin)
- `POST /api/evaluate/non-tech/{submission_id}` — evaluate a non-tech submission (judge/organiser of owner hackathon/admin)
- `POST /api/evaluate/tech/{id}/retry` — retry tech evaluation
- `POST /api/evaluate/non-tech/{id}/retry` — retry non-tech evaluation
- `GET /api/leaderboard/{hackathon_id}` — authenticated leaderboard
- `GET /api/leaderboard/public/{hackathon_id}` — public shareable leaderboard
- `GET /api/reports` — list reports for organisers/admins
- `GET /api/reports/{hackathon_id}` — detailed hackathon report
- `GET /api/reports/submission/{submission_id}` — printable per-team evaluation report (organiser/admin)
- `GET /api/reports/submission/{submission_id}/pdf` — download the per-team report as a PDF (organiser/admin)

## Hackathon scheduling and team join flow

When creating a hackathon, organisers pick a **start date/time** and a **duration in hours**. The backend computes `end_date = start_date + duration_hours` and the frontend shows a live countdown on the hackathon card and detail page (time remaining until start or until end, depending on status).

Organisers can upload a **banner image** (`POST /api/hackathons/{id}/banner`). Banners are displayed on the public landing page, the hackathon list, and the hackathon detail page. Hackathon settings and banners can be updated from the dedicated **Edit hackathon** page at any time.

Each team gets a unique **8-character invite code** when it is created. The code is shown to the team leader and to hackathon managers in a copyable format. Participants join teams by pasting the code into the **Join by code** box. Managers and team leaders can also add members directly by username (`POST /api/teams/{team_id}/members`).

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

## Running the validation harness

A browserless full-stack flow test is included at the repo root:

```bash
cd backend
venv\Scripts\activate
venv\Scripts\python ../validate_flow.py
```

It starts the backend and Vite dev server, verifies the frontend loads, then walks through:
register → login → create hackathon → upload problem statement → create team → submit tech repo → evaluate tech → create second team → submit non-tech document → evaluate non-tech → view leaderboard.

## Production notes
- Use Docker Compose or a managed PostgreSQL instance (e.g., Cloud SQL) for persistence. Set `DATABASE_URL` to a PostgreSQL connection string.
- The frontend nginx container proxies `/api` and `/uploads` to the backend service, so the SPA uses relative URLs in both development and production.
- The default storage is local filesystem. For production, replace `app/services/file_storage.py` with S3-compatible storage or mount a Cloud Storage bucket.
- Set a strong `SECRET_KEY` and configure the LLM endpoint for real evaluations.
- See `gcp/README.md` for Cloud Run + Firebase Hosting deployment steps.
