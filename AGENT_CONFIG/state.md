# Current State

- **Date**: 2026-08-15
- **Repo**: full-stack hackathon evaluation platform (ZECATHON) with RBAC, Gemini integration, dynamic rubrics, judge questions, evaluation retry, easter eggs, PWA baseline, mobile-friendly navigation, and GCP deployment artifacts.
- **AGENT_CONFIG**: created; context, plan, state, and todo maintained.

## Backend (completed)
- **Phase 20.4 ( organizer/admin scope hardening)**: added `backend/app/routers/common.py` with `can_access_hackathon`/`can_manage_hackathon`/`require_hackathon_access`; scoped `GET /api/hackathons` (organizers only see their own), `GET /api/hackathons/{id}`, `GET /api/problem-statements/{id}`, `GET /api/teams`, `GET /api/teams/{id}`, `POST /api/teams`, `POST /api/teams/{id}/join`, `GET /api/submissions`, `GET /api/submissions/{id}`, `POST /api/submissions`, `POST /api/evaluate/*`, and `GET /api/leaderboard/{id}` so admins see everything, judges see everything, participants see everything, and organizers only see/control their own hackathons; removed the duplicate `/api/reports/submission/{id}` route definition; proxied `/uploads` in `frontend/vite.config.ts` and `frontend/nginx/default.conf` so uploaded problem-statement files and non-tech submissions are viewable in dev and production.
- **Models**: `Hackathon.rubric` (JSON), `Submission.github_url`, `Evaluation.judge_questions`; `Team.submissions` and `ProblemStatement.submissions` cascades configured.
- **Schemas**: `UserCreate` password validator (8 chars, letter, digit, symbol), role validator (only `participant` or `organizer` allowed at registration), `HackathonCreate` rubric, `SubmissionCreate` github_url, `EvaluationOut` judge_questions, `SubmissionReport` with team/problem/hackathon names.
- **Auth**: bcrypt rounds 12, sliding-window rate limiter on `/api/auth/register` and `/api/auth/login`, `require_participant` dependency added.
- **Registration**: new users can register as **Student (participant)** or **Organizer**; `admin` and `judge` are not selectable at registration.
- **Hackathons**: `GET /api/hackathons` returns `problem_statement_count` and `team_count`; `DELETE /api/hackathons/{id}` deletes all children (teams, submissions, evaluations, problem statements) for organisers/admins; `PUT /api/hackathons/{id}` supports custom rubrics.
- **Teams**: `POST /api/teams` allows `participant`, `organizer`, and `admin` roles (organizers/admins can create teams on behalf of a hackathon); `POST /api/teams/{id}/join` remains participant-only; `DELETE /api/teams/{id}` is organiser/admin-only.
- **Submissions**: `POST /api/submissions` allows `participant`, `organizer`, and `admin` roles; managers bypass the team-membership check so they can submit on behalf of any team. Non-tech submissions accept a document file, a submission URL, and an optional GitHub URL; optional PPT upload supported.
- **Evaluators**: tech and non-tech prompts request `judge_questions`, use per-hackathon custom rubrics (or defaults), and store suggested questions in the evaluation.
- **Evaluation retry**: `POST /api/evaluate/tech/{id}/retry` and `POST /api/evaluate/non-tech/{id}/retry` delete the old evaluation and re-run it.
- **Leaderboard**: public, unauthenticated endpoint `GET /api/leaderboard/public/{hackathon_id}`; scores are discrete after anti-clustering.
- **Reports**: route order fixed so `/api/reports/submission/{id}` is matched before `/{hackathon_id}`; added `EvaluationOut` import; test added for the printable per-team report. **NEW Phase 20.1**: added `category_explanations` and `category_max_points` to `Evaluation` model/schema; tech and non-tech prompts now request per-category explanations and judge questions grounded in both the problem statement and the submission; added `GET /api/reports/submission/{id}/pdf` which generates a real backend PDF using WeasyPrint (primary) or fpdf2 (fallback) from a Jinja2 HTML template.
- **PDF generator**: `backend/app/services/pdf_generator.py` with `templates/report.html` — professional report with ZECATHON header, score cards, rubric breakdown table with explanations, strengths/improvements/red flags, recommendation, and suggested judge questions.
- **Docker/GCP**: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx/default.conf`, `docker-compose.yml`, `docker-compose.prod.yml`, `gcp/README.md`. **NEW Phase 20.2**: `docker-compose.yml` now includes a `postgres` service with healthcheck and named volumes; backend connects to `postgresql+psycopg2://zecathon:zecathon_secret@postgres:5432/zecathon` by default in Docker. Added `docker-compose.prod.yml` for production with external PostgreSQL/Cloud SQL. Backend Dockerfile installs WeasyPrint system libraries and creates `/app/logs`.
- **Logging**: **NEW Phase 20.3** `backend/app/logger.py` configures console + rotating file logging (`logs/app.log`, 10 MB, 5 backups) with cleanup of stale rotated files. Wired into `main.py` lifespan startup/shutdown and key routers (`evaluate`, `hackathons`, `teams`, `submissions`). `logs/` is ignored by Git.

## Frontend (completed)
- **New routes**: `/admin` (admin-only), `/public/leaderboard/:id` (shareable), `/reports` (organiser/admin only), `/reports/submission/:id` (printable per-team report).
- **New components**: `AdminDashboard`, `AdminRoute`, `OrganizerRoute`, `EvaluationReport`, `PublicLeaderboard`, `EasterEggOverlay`, `EasterEggProvider`, global `Footer` in `PageLayout`, `ReportsPage`, `TeamReportPage`, `BackButton`.
- **Role-aware UI**: dashboard cards adapt to admin/organizer/judge/participant; admin and reports links in navbar for the appropriate roles; registration role selector (Student / Organizer).
- **Navigation**: Dashboard now appears before Hackathons in the navbar; a mobile hamburger menu exposes all role-aware links on small screens.
- **Back buttons**: every submenu page (`CreateHackathon`, `HackathonDetail`, `HackathonTeams`, `Submit`, `Leaderboard`, `ReportsPage`, `AdminDashboard`) has a consistent back button.
- **Hackathons page**: uses backend counts; organisers/admins can delete hackathons from the card.
- **Team page**: participants can create/join/submit; organisers/admins can also create teams and submit on behalf of a team, delete teams, and view per-team reports.
- **Submit page**: participants submit their own projects; organisers/admins can submit on behalf of the selected team.
- **PWA**: `manifest.json`, `sw.js`, registered service worker, theme-color / apple-mobile-web-app meta tags, and `viewport-fit=cover` viewport.
- **Reports page team entries**: each evaluated row now has a **View report** button that opens the printable per-team report.
- **EvaluationReport component**: displays category scores as a bar chart and now shows the per-category explanation text beneath each bar when available.
- **Printable report**: `TeamReportPage` renders evaluation details including judge questions; now has a **Download PDF** button that fetches the backend-generated PDF blob and triggers a real file download. The previous `window.print()` hack has been removed.
- **Admin dashboard**: role `<select>` uses `.neon-select` with a custom space-themed chevron and no awkward right padding.
- **CreateHackathon**: rubric editor for tech/non-tech categories.
- **Leaderboard**: copy share link button; judges can retry an evaluation from the teams page.
- **Easter eggs**: click-based only; the Egg Hunt modal is a large centered dialog rendered via a React portal.
- **Custom cursor**: simplified to a single hardware-accelerated image.
- **Sound system**: `MusicProvider` master `enabled` toggle; navbar speaker icon toggles both ambient music and UI click effects; `ClickEngine` plays on every interactive element.
- **Gemini key**: valid; backend defaults to `gemini-3.5-flash-lite` and falls back through `gemini-3.5-flash`, `gemini-3.7-flash`, and `gemini-flash-latest`.
- **Footer resources**: real pages exist for `/docs` (How it Works), `/api-docs`, `/rubrics`, and `/support` with on-theme content.
- **README**: includes Mermaid architecture, auth, hackathon lifecycle, evaluation pipeline, and RBAC matrix diagrams; updated env var docs and API docs port `8002`.
- **Theme**: dark space/pixel styling preserved.

## Validation
- Backend upload path fix: `save_upload` returns `/uploads/{filename}`; `document_extractor` resolves `/uploads/...` back to the local `upload_dir` before reading, so non-tech evaluations and problem-statement extraction work from public URLs and local tests.
- `pytest backend/tests` ✅ 17 passed (includes new organizer/admin scope tests)
- `npm run build` ✅ production build succeeded
- `validate_flow.py` ✅ all flows passed with the new scoped access rules
- Backend PDF endpoint returns a valid `%PDF` byte stream for evaluated submissions; WeasyPrint is the primary engine in Docker, fpdf2 fallback works on Windows dev without GTK.
- Docker Compose files updated for PostgreSQL; backend Dockerfile includes WeasyPrint and PostgreSQL dependencies.
- `seed_dev.py` ✅ idempotent; re-running creates a single demo hackathon with two evaluated submissions and a populated leaderboard
- `validate_flow.py` ✅ all flows passed with the new participant-only team/submission rules
- Reports endpoints verified on a fresh backend process; per-team printable report accessible to organisers/admins
- Admin create-team/submit flow verified via API on a fresh backend process
- Dev servers should be started with `start-dev.sh` / `start-dev.ps1` (backend on `http://127.0.0.1:8002`, frontend on `http://localhost:5173`)

## Dev workflow
- Dev backend port moved to `8002` (`start-dev.sh`, `start-dev.ps1`, `frontend/vite.config.ts`, `README.md`) to avoid orphaned `8000` sockets.
- `start-dev.ps1` uses `$PSScriptRoot` so `Start-Job` blocks start from the project root.
- `seed_dev.py` is idempotent and cleans up previous demo hackathons before re-seeding.
- `admin1` / `TestPass1!` (admin) and `demoorganizer` / `DemoPass1!` (organizer) can view reports, delete hackathons/teams, and now create teams and submit on behalf of teams.
- New registrations must use a password with ≥8 chars, one letter, one digit, and one symbol.

## Sample generated report (from `ZECATHON Demo Hack`)
- **Problem statements**: 1
- **Teams**: 2
- **Submissions**: 2
- **Evaluated**: 2
- **Average score**: ~149
- **Top team**: `Doc Dynamos` — ~178 pts
- **Verdict breakdown**: 2 × NEEDS WORK (deterministic fallback because no Gemini key is set)
- **Type breakdown**: 1 tech, 1 non-tech
- **Team entries**: Tech Titans (tech, 114 pts) and Doc Dynamos (non-tech, ~178 pts)
- **Per-team report**: includes score breakdown, authenticity band, category scores, strengths, weaknesses, review flags, and suggested judge questions.

## Repository
- Pushed to `https://github.com/Zethetaprojects/Zecathon.git` branch `main` in previous phases; this phase will add a new commit.
- No new author metadata is added; commits retain the existing `user.name`/`user.email` from the global git config.

## Next action
- Phase 20.4 committed to `main`.
- Proceed to Phase 20.5: deployment-ready Docker/nginx/GCP docs.

## Blockers
- None.

## Leftovers / future improvements
- Phase 20.5: deployment-ready Docker/nginx/GCP docs.
- Phase 20.6: PWA and mobile navbar polish.
- Phase 20.7: full validation and commits.
- Move uploads to Cloud Storage.
- Add real-time notifications for score updates (optional).
