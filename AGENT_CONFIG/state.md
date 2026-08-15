# Current State

- **Date**: 2026-08-15
- **Repo**: full-stack hackathon evaluation platform (ZECATHON) with RBAC, Gemini integration, dynamic rubrics, judge questions, evaluation retry, easter eggs, and GCP deployment artifacts.
- **AGENT_CONFIG**: created; context, plan, state, and todo maintained.

## Backend (completed)
- **Models**: `Hackathon.rubric` (JSON), `Submission.github_url`, `Evaluation.judge_questions`.
- **Schemas**: `UserCreate` password validator (8 chars, letter, digit, symbol), role validator (only `participant` or `organizer` allowed at registration), `HackathonCreate` rubric, `SubmissionCreate` github_url, `EvaluationOut` judge_questions.
- **Auth**: bcrypt rounds 12, sliding-window rate limiter on `/api/auth/register` and `/api/auth/login`, admin user list endpoint `GET /api/auth/admin/users`.
- **Registration**: new users can register as **Student (participant)** or **Organizer**; `admin` and `judge` are not selectable at registration.
- **Submissions**: non-tech submissions accept a document file, a submission URL, or an optional GitHub URL.
- **Evaluators**: tech and non-tech prompts request `judge_questions`, use per-hackathon custom rubrics (or defaults), and store suggested questions in the evaluation.
- **Evaluation retry**: `POST /api/evaluate/tech/{id}/retry` and `POST /api/evaluate/non-tech/{id}/retry` delete the old evaluation and re-run it.
- **Leaderboard**: public, unauthenticated endpoint `GET /api/leaderboard/public/{hackathon_id}`.
- **Reports**: new router `backend/app/routers/reports.py` with `GET /api/reports` and `GET /api/reports/{hackathon_id}`; schemas `HackathonReportSummary`, `HackathonReportDetail`, `TeamReportEntry`; protected to organisers and admins; admin sees all hackathons, organiser sees only their own.
- **Docker/GCP**: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx/default.conf`, `docker-compose.yml`, `gcp/README.md`.

## Frontend (completed)
- **New routes**: `/admin` (admin-only), `/public/leaderboard/:id` (shareable), `/reports` (organiser/admin only).
- **New components**: `AdminDashboard`, `AdminRoute`, `OrganizerRoute`, `EvaluationReport`, `PublicLeaderboard`, `EasterEggOverlay`, `EasterEggProvider`, global `Footer` in `PageLayout`, `ReportsPage`.
- **Role-aware UI**: dashboard cards adapt to admin/organizer/judge/participant; admin and reports links in navbar for the appropriate roles; registration role selector (Student / Organizer).
- **Navbar cleanup**: removed the non-functional **Features** dropdown and the **Leaderboards** top-level link; kept Hackathons, Dashboard, Admin (admin), Reports (organizer/admin).
- **Dashboard cleanup**: removed redundant `Join a Team` and `Evaluate Projects` cards that duplicated the Hackathons link; kept Browse Hackathons, Host Hackathon, Reports, Admin Panel.
- **Reports page**: summary cards for each hackathon with team/submission/evaluation stats; expandable detail with verdict breakdown, submission-type breakdown, and a team-level table.
- **CreateHackathon**: rubric editor for tech/non-tech categories.
- **Submit**: optional supporting GitHub URL for non-tech submissions.
- **Leaderboard**: copy share link button; judges can retry an evaluation from the teams page.
- **Easter eggs**: click-based only; the Egg Hunt modal is now a large centered dialog rendered via a React portal so it sits above the navbar and is fully clickable/scrollable.
- **Custom cursor**: simplified to a single hardware-accelerated image with no trailing image and no `requestAnimationFrame` loop, so it should no longer hang or lag.
- **Sound system**: `MusicProvider` now has a master `enabled` toggle; the navbar speaker icon toggles both ambient music and all UI click effects; a `ClickEngine` plays a short synthesized click on every button, link, input, label, and `role="button"` interaction.
- **Gemini key**: the key is **valid**. The configured model `gemini-2.5-flash` is no longer available for new users on `generateContent`. The backend now defaults to and falls back through `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-3.7-flash`, and `gemini-flash-latest`. `validate_flow.py` returns real Gemini-generated scores and judge questions.
- **Footer resources**: real pages exist for `/docs` (How it Works), `/api-docs`, `/rubrics`, and `/support` with on-theme content.
- **README**: includes Mermaid architecture, auth, hackathon lifecycle, evaluation pipeline, and RBAC matrix diagrams; updated env var docs for Gemini.
- **Theme**: dark space/pixel styling preserved.

## Validation
- `pytest backend/tests` ✅ 12 passed
- `validate_flow.py` ✅ all flows passed, generated reports and leaderboards shown
- `npm run build` ✅ production build succeeded
- Reports endpoints `GET /api/reports` and `GET /api/reports/{id}` verified with an admin/organizer token; a live report was generated from the validated hackathon
- Dev servers should be started with `start-dev.sh` / `start-dev.ps1` (backend on `http://127.0.0.1:8002`, frontend on `http://localhost:5173`)

## Dev workflow
- Dev backend port moved to `8002` (`start-dev.sh`, `start-dev.ps1`, `frontend/vite.config.ts`, `README.md`) because the previous `8000` socket was orphaned by an old uvicorn process and could not be reclaimed.
- Fixed `start-dev.ps1` to use `$PSScriptRoot` so the `Start-Job` blocks start in the project root directory instead of the default `Documents` folder.
- Added `seed_dev.py` to create a demo hackathon (`ZECATHON Demo Hack`), two teams, one tech and one non-tech submission, and evaluate both using the deterministic fallback. After seeding, the `/reports` page shows a live report.
- Demo account: `demoorganizer` / `DemoPass1!` (role `organizer`).
- `admin1` / `TestPass1!` (role promoted to `admin`).
- `flowuser` / `FlowPass1!` (role `organizer`, created by `validate_flow.py`).
- `flowuser2` / `FlowPass1!` (role `participant`, created by `validate_flow.py`).
- New registrations must use a password with ≥8 chars, one letter, one digit, and one symbol.

## Sample generated report (from `Flow Validation Hack`)
- **Problem statements**: 1
- **Teams**: 2
- **Submissions**: 2
- **Evaluated**: 2
- **Average score**: 153.0
- **Top team**: `Doc Dynamos` — 192 pts
- **Verdict breakdown**: 2 × NEEDS WORK
- **Type breakdown**: 1 tech, 1 non-tech
- **Team entries**:
  - Tech Titans — tech — 114 pts — NEEDS WORK — needs review
  - Doc Dynamos — non-tech — 192 pts — NEEDS WORK — needs review
- **Access**: the `/reports` page and `/api/reports/*` endpoints are visible only to `admin`/`organizer`; `participant` accounts are blocked and only see leaderboards.

## Repository
- Pushed to `https://github.com/Zethetaprojects/Zecathon.git` branch `main`.
- SSH was unavailable, so the remote URL was switched to HTTPS; the push succeeded using existing Git credentials.
- No new author metadata was added; commits retain the existing `user.name`/`user.email` from the global git config.

## Next action
- User review in browser; hard-refresh `localhost:5173` after starting `start-dev.sh` / `start-dev.ps1`. The dev backend now runs on port `8002` to avoid the orphaned `8000` socket from earlier test runs.
- Add a valid `GEMINI_API_KEY` (starts with `AIza...`) to `backend/.env` for real LLM evaluations; until then the deterministic fallback produces plausible reports.

## Blockers
- None.

## Leftovers / future improvements
- Swap SQLite for PostgreSQL (Cloud SQL) for production multi-instance scaling.
- Move uploads to Cloud Storage.
- Add mobile hamburger menu refinement.
- Add real-time notifications for score updates (optional).
