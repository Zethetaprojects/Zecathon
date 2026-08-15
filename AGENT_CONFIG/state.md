# Current State

- **Date**: 2026-08-15
- **Repo**: full-stack hackathon evaluation platform (ZECATHON) with RBAC, Gemini integration, dynamic rubrics, judge questions, and GCP deployment artifacts.
- **AGENT_CONFIG**: created; context, plan, state, and todo maintained.

## Backend (completed)
- **Models**: `Hackathon.rubric` (JSON), `Submission.github_url`, `Evaluation.judge_questions`.
- **Schemas**: `UserCreate` password validator (8 chars, letter, digit, symbol), `HackathonCreate` rubric, `SubmissionCreate` github_url, `EvaluationOut` judge_questions.
- **Auth**: bcrypt rounds 12, sliding-window rate limiter on `/api/auth/register` and `/api/auth/login`, admin user list endpoint `GET /api/auth/admin/users`.
- **Submissions**: non-tech submissions now accept a document file, a submission URL, or an optional GitHub URL.
- **Evaluators**: tech and non-tech prompts request `judge_questions`, use per-hackathon custom rubrics (or defaults), and store suggested questions in the evaluation.
- **Leaderboard**: public, unauthenticated endpoint `GET /api/leaderboard/public/{hackathon_id}`.
- **Docker/GCP**: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx/default.conf`, `docker-compose.yml`, `gcp/README.md`.

## Frontend (completed by subagent)
- **New routes**: `/admin` (admin-only), `/public/leaderboard/:id` (shareable).
- **New components**: `AdminDashboard`, `AdminRoute`, `EvaluationReport`, `PublicLeaderboard`, global `Footer` in `PageLayout`.
- **Role-aware UI**: dashboard cards adapt to admin/organizer/judge/participant; admin link in navbar.
- **CreateHackathon**: rubric editor for tech/non-tech categories.
- **Submit**: optional supporting GitHub URL for non-tech submissions.
- **Leaderboard**: copy share link button.
- **Landing page**: ZECATHON hero, features, how-it-works, footer, Easter-egg controller, custom cursor, cinematic music toggle.
- **Theme**: dark space/pixel styling preserved.

## Validation
- `pytest backend/tests` ✅ 10 passed
- `validate_flow.py` ✅ all flows passed, generated reports and leaderboards shown
- `npm run build` ✅ production build succeeded
- Dev servers running on `http://127.0.0.1:8000` (backend) and `http://localhost:5173` (frontend)

## Default test account (local DB)
- `admin1` / `TestPass1!` (role promoted to `admin` in the current dev DB).
- New registrations must use a password with ≥8 chars, one letter, one digit, and one symbol.

## Next action
- Commit all backend and frontend changes with a clear release message.
- User should add a valid `GEMINI_API_KEY` (starts with `AIza...`) to `backend/.env` for real LLM evaluations; until then the deterministic fallback produces plausible reports.

## Blockers
- None.

## Leftovers / future improvements
- Swap SQLite for PostgreSQL (Cloud SQL) for production multi-instance scaling.
- Move uploads to Cloud Storage.
- Add mobile hamburger menu refinement.
- Add real-time notifications for score updates (optional).
