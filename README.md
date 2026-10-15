# Hackathon Evaluation Platform

A web app for organising hackathons, collecting project submissions, and evaluating them with AI-powered scoring.

## Features
- User registration and login (JWT).
- Create hackathons with a start date/time + duration, live countdown, and optional banner image. Organisers and admins can edit hackathon settings and replace the banner at any time.
- Public landing page with a featured upcoming-hackathon banner, live platform stats, and a horizontal card carousel for browsing open arenas.
- Upload problem statements (PDF, DOCX, PPTX, XLSX, TXT, MD).
- Create teams with a unique copyable join code; participants join by code, while team leaders and managers can add, remove, or promote members and change the team leader.
- Submit projects per problem statement.
- Two evaluator APIs:
  - **Tech**: evaluates a GitHub repository against a problem statement.
  - **Non-tech**: evaluates a project document, with an optional supporting PPT.
- Hackathon-oriented rubrics with admissibility gate, authenticity multiplier, and server-side score reconciliation.
- Live leaderboard with discrete, non-clustered scores and a public shareable link.
- Organiser/admin reports with verdict and submission-type breakdowns, plus per-team printable PDF reports.
- Themed gaming-style loading screen (rocket, neon flame, animated progress bar) on all loading states.
- Hidden easter eggs throughout the site — click secrets, open the browser console, and use the Egg Hunt panel to track discoveries.

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

Defaults below. A **superadmin** can switch each feature on or off per role at `/admin/settings`; the backend enforces the toggles and the UI hides what the current user cannot do (`GET /api/auth/me/permissions`). Superadmins always keep every permission and have the same platform-wide access as admins. Organisers only ever see and manage hackathons they created.

| Action (toggle) | Admin / Superadmin | Organiser | Judge | Participant |
|---|---|---|---|---|
| Create hackathon (`create_hackathon`) | ✅ | ✅ | ❌ | ❌ |
| Edit hackathon / banner / rubric (`edit_hackathon`) | ✅ | ✅ (own) | ❌ | ❌ |
| Upload problem statement (`manage_problem_statements`) | ✅ | ✅ (own) | ❌ | ❌ |
| Delete hackathon (`delete_hackathon`) | ✅ | ✅ (own) | ❌ | ❌ |
| Delete team (`delete_team`) | ✅ | ✅ (own) | ❌ | ❌ |
| Create team (`create_team` + `participate`) | ✅ | ✅ (own) | ❌ | ✅ |
| Join team by invite code (`join_team` + `participate`) | ✅ | ✅ | ❌ | ✅ |
| Be added to a team (`participate`) | ✅ | ✅ | ❌ | ✅ |
| Add / remove members, change leader (`manage_team_members`) | ✅ | ✅ (own) | ❌ | ✅ (team leader) |
| Submit project (`submit_project`) | ✅ | ✅ (own) | ❌ | ✅ (team member) |
| Evaluate submission (`evaluate_submission`) | ✅ | ✅ (own) | ✅ | ❌ |
| View reports (`view_reports`) | ✅ | ✅ (own) | ✅ | ❌ |
| View authenticated leaderboard (`view_leaderboard`) | ✅ | ✅ (own) | ✅ | ✅ |
| Manage users (`manage_users`) / admin panel (`view_admin_panel`) | ✅ | ❌ | ❌ | ❌ |
| API reference page (`view_api_docs`) | Superadmin only | ❌ | ❌ | ❌ |
| Platform settings, platform stats, manage admin accounts | Superadmin only | ❌ | ❌ | ❌ |
| View public leaderboard / upcoming hackathons | ✅ | ✅ | ✅ | ✅ |

## Tech stack
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL (via Docker Compose), Pydantic.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS.
- **Deployment**: Docker, Docker Compose, nginx, GCP Cloud Run / Firebase Hosting.
- **LLM**: Google Gemini REST API (`GEMINI_API_KEY`, `GEMINI_MODEL`). If the configured model is unavailable it tries other aliases. If Gemini is down or rate-limited, the evaluation fails with HTTP 503 and nothing is stored; it is never replaced by a fake score. Without any LLM configured, development uses a deterministic offline scorer whose results are flagged "Fallback score" and marked for review; production refuses to score.

## Quick start

### Option A — Docker Compose (recommended)

This is the fastest way to run the full stack with PostgreSQL and a production-like setup:

```bash
cp backend/.env.example backend/.env   # optional: set GEMINI_API_KEY, SECRET_KEY, etc.
docker compose up --build
```

- Backend API docs: http://localhost:8000/api/docs
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
| `ENVIRONMENT` | `development` (default) or `production`. Production refuses to start with a weak/default `SECRET_KEY` or SQLite, and refuses offline mock scoring. |
| `DATABASE_URL` | Database connection. Default: `sqlite:///./hackathon.db`. Docker Compose uses `postgresql+psycopg2://zecathon:zecathon_secret@postgres:5432/zecathon`. |
| `SECRET_KEY` | JWT signing secret (production: at least 32 random characters) |
| `GEMINI_API_KEY` | Google Gemini API key from [AI Studio](https://aistudio.google.com/apikey). New keys are auth keys starting with `AQ.`; old `AIza...` standard keys are no longer accepted by Google. Needed for real evaluations. Check it with `python -m scripts.check_llm`. |
| `GEMINI_MODEL` | Gemini model to use. Default: `gemini-3.5-flash-lite`. If it returns 404, `gemini-flash-lite-latest`, `gemini-3.8-flash` and `gemini-flash-latest` are tried. |
| `LLM_TIMEOUT_SECONDS` | Timeout per LLM request (default 60). |
| `CORS_ORIGINS` | Comma-separated allowed origins (default `*`). |
| `GITHUB_TOKEN` | Optional: higher GitHub API rate limits. Public repos work without it. |
| `UPLOAD_DIR` | Directory for uploaded files (default: `uploads`) |
| `MAX_UPLOAD_SIZE` | Max upload bytes (default: 20 MB) |
| `AI_BACKEND_URL` | Optional generic LLM endpoint, used only when no Gemini key is set. |
| `AI_BACKEND_TOKEN` | Optional Bearer token for the legacy LLM endpoint. |

## API overview

FastAPI auto-generated docs: [http://localhost:8002/api/docs](http://localhost:8002/api/docs) (disabled in production with `DISABLE_API_DOCS=true`)

Key endpoints:
- `POST /api/auth/register` — create account (Student or Organiser only)
- `POST /api/auth/login` — get JWT token
- `GET /api/auth/me/permissions` — the current user's effective feature permissions
- `GET /api/auth/admin/users` — admin user list
- `PUT /api/auth/users/{id}/role` — admin role update (admin/superadmin accounts: superadmin only)
- `GET` / `PUT /api/auth/admin/settings` — registration switch and role permission matrix (superadmin)
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

The test suite covers auth, hackathons, problem statements, teams, submissions, tech/non-tech evaluation, the discrete leaderboard, and production hardening (`tests/test_hardening.py`: superadmin access, permission toggles, upload safety, rate limiting, LLM outage handling).

## Running the validation harness

A browserless full-stack flow test is included at the repo root:

```bash
cd backend
venv\Scripts\activate
venv\Scripts\python ../validate_flow.py
```

It ignores `backend/.env` and uses the deterministic offline scorer, so it needs no API key. It starts the backend and Vite dev server, verifies the frontend loads, then walks through:
register → login → create hackathon → upload problem statement → create team → submit tech repo → evaluate tech → create second team → submit non-tech document → evaluate non-tech → view leaderboard.

## Production notes
- Use Docker Compose or a managed PostgreSQL instance (e.g., Cloud SQL) for persistence. Set `DATABASE_URL` to a PostgreSQL connection string.
- The frontend nginx container proxies `/api` and `/uploads` to the backend service, so the SPA uses relative URLs in both development and production.
- The default storage is local filesystem. For production, replace `app/services/file_storage.py` with S3-compatible storage or mount a Cloud Storage bucket.
- Set `ENVIRONMENT=production`, a strong `SECRET_KEY`, and `GEMINI_API_KEY` for real evaluations.
- Uploaded files are served with `X-Content-Type-Options: nosniff` and a no-script CSP; SVG uploads are rejected because they can carry scripts.
- See `gcp/README.md` for the self-hosted VM path (`deploy-vm.sh` / `update-vm.sh`, disk sizing, uptime checks, backups) and for Cloud Run + Firebase Hosting.
