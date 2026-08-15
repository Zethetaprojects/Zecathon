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
- **Docker/GCP**: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx/default.conf`, `docker-compose.yml`, `gcp/README.md`.

## Frontend (completed)
- **New routes**: `/admin` (admin-only), `/public/leaderboard/:id` (shareable).
- **New components**: `AdminDashboard`, `AdminRoute`, `EvaluationReport`, `PublicLeaderboard`, `EasterEggOverlay`, `EasterEggProvider`, global `Footer` in `PageLayout`.
- **Role-aware UI**: dashboard cards adapt to admin/organizer/judge/participant; admin link in navbar; registration role selector (Student / Organizer).
- **CreateHackathon**: rubric editor for tech/non-tech categories.
- **Submit**: optional supporting GitHub URL for non-tech submissions.
- **Leaderboard**: copy share link button; judges can retry an evaluation from the teams page.
- **Easter eggs**: click-based only now — Star Catcher, Logo Fanatic, Controller Hunter, Logo Watcher, Stat Nerd, social footer icons, Teddy Spotter, Fine Print Reader, Captain on Deck, Mascot Friend, Sound Seeker. Keyboard/typing eggs and the secret-code panel removed. The global Egg Hunt is a large centered modal with a scrollable grid.
- **Custom cursor**: simplified to a single hardware-accelerated image with no trailing image and no `requestAnimationFrame` loop, so it should no longer hang or lag.
- **Gemini key**: the `GEMINI_API_KEY` currently in `backend/.env` is set but **invalid** (Generative Language API returns `API_KEY_INVALID`). Replace it with a real key from Google AI Studio for live LLM evaluations; the deterministic fallback still produces reports and passes all tests.
- **Theme**: dark space/pixel styling preserved.

## Validation
- `pytest backend/tests` ✅ 12 passed
- `validate_flow.py` ✅ all flows passed, generated reports and leaderboards shown
- `npm run build` ✅ production build succeeded
- Dev servers should be started with `start-dev.sh` / `start-dev.ps1` (backend on `http://127.0.0.1:8000`, frontend on `http://localhost:5173`)

## Default test account (local dev DB)
- `admin1` / `TestPass1!` (role promoted to `admin` in the current dev DB).
- New registrations must use a password with ≥8 chars, one letter, one digit, and one symbol.

## Next action
- User review in browser; hard-refresh `localhost:5173` after starting `start-dev.sh`.
- Add a valid `GEMINI_API_KEY` (starts with `AIza...`) to `backend/.env` for real LLM evaluations; until then the deterministic fallback produces plausible reports.

## Blockers
- None.

## Leftovers / future improvements
- Swap SQLite for PostgreSQL (Cloud SQL) for production multi-instance scaling.
- Move uploads to Cloud Storage.
- Add mobile hamburger menu refinement.
- Add real-time notifications for score updates (optional).
