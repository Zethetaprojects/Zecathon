# Current State

- **Date**: 2026-08-15
- **Repo**: full-stack hackathon evaluation platform (ZECATHON) with RBAC, Gemini integration, dynamic rubrics, judge questions, evaluation retry, easter eggs, PWA baseline, mobile-friendly navigation, and GCP deployment artifacts.
- **AGENT_CONFIG**: created; context, plan, state, and todo maintained.

## Phase 22 — completed
- **Team member management**: admins, hackathon organisers (own hackathons), and team leaders can change a member's role, promote a new leader, or remove a member. Promoting a member to leader demotes the previous leader automatically; removing or demoting the only leader is rejected by the backend.
- **Edit hackathon page**: a dedicated `/hackathons/:id/edit` route lets organisers/admins update the name, description, start date/time, duration, and banner image, with a live preview of the banner.
- **Frontend integration**: an **Edit hackathon** button appears on the hackathon detail page for managers, and the team management page shows per-member role selectors and remove buttons for managers/team leaders.
- **Validation**: `pytest backend/tests` ✅ 22 passed, `npm run build` ✅, `seed_dev.py` ✅, `validate_flow.py` ✅ all flows passed.

## Phase 23 — completed
- **Themed loading screen**: reusable `LoadingScreen` component with retro rocket animation used across route guards and pages.
- **Console easter egg**: stylized ASCII art and secret message logged to the browser console on app startup.
- **More hidden eggs**: additional click-based easter egg triggers added to hero title, status badges, countdowns, empty states, and rubric toggle.
- **Validation**: `npm run build` ✅ and `pytest backend/tests` ✅ 22 passed.
- **Committed and pushed to `main`**.

## Phase 24 — completed
- **Goal**: ship a single-file GCP deployment script and fix the production Docker build.
- **Dockerfile fix**: `backend/Dockerfile` package list updated for the current `python:3.11-slim` (Debian trixie) base — `libgdk-pixbuf2.0-0` → `libgdk-pixbuf-2.0-0`, plus `libpangoft2-1.0-0` and `libharfbuzz0b` for WeasyPrint.
- **Docker Compose**: removed obsolete `version: "3.8"` from `docker-compose.yml`.
- **Deployment artifact**: created `gcp/deploy.sh` — one executable script that enables APIs, creates Artifact Registry, Cloud SQL PostgreSQL instance/database/user, Secret Manager secrets, builds/pushes the backend image, deploys the backend to Cloud Run, and deploys the frontend to Firebase Hosting with `/api` + `/uploads` rewrites.
- **CI/CD**: created `gcp/cloudbuild.yaml` for automated Cloud Build + Cloud Run + Firebase Hosting deploys on pushes to `main`.
- **Docs**: updated `gcp/README.md` with quick deploy and CI/CD sections.
- **Validation**: `bash -n gcp/deploy.sh` ✅, `npm run build` ✅, `pytest backend/tests` ✅ 22 passed. (Full Docker build could not be verified locally because the Docker Desktop engine was not running; the fix is based on the correct Debian trixie package names for WeasyPrint.)

## Phase 25 — completed
- **Goal**: self-hosted GCP VM deployment without managed services (no gcloud CLI, no Cloud Run, no Cloud SQL, no Firebase).
- **Gunicorn**: added `gunicorn` to `backend/requirements.txt` and created `backend/gunicorn.conf.py` for production FastAPI workers.
- **VM compose stack**: created `gcp/docker-compose.vm.yml` with PostgreSQL in Docker + backend in Docker using gunicorn/uvicorn workers, plus persistent volumes for DB, uploads, and logs.
- **Host nginx**: created `gcp/nginx-zecathon.conf` template that serves the built frontend SPA and proxies `/api` + `/uploads` to the backend container.
- **Deploy script**: created `gcp/deploy-vm.sh` for the GCP browser SSH terminal. It installs Docker, nginx, certbot, and Node.js; clones/updates the repo; builds the frontend; configures nginx and SSL (Let's Encrypt or self-signed); and creates a systemd `zecathon.service` to keep the Docker stack alive. **Updated**: script now accepts a bare external IP address (self-signed certificate) in addition to a domain name.
- **Docs**: updated `gcp/README.md` with the VM deployment path.
- **Validation**: `bash -n gcp/deploy-vm.sh` ✅, `npm run build` ✅, `pytest backend/tests` ✅ 22 passed.
- **Committed and pushed to `main`**.

## Phase 21 — completed
- **Scheduling**: hackathons now use a `start_date` + `duration_hours` model; `end_date` is computed server-side. Live countdowns appear on the hackathon list, detail, and landing pages.
- **Banners**: organisers/admins can upload hackathon banner images via `POST /api/hackathons/{id}/banner`. Banners render on cards, detail pages, and the public landing page.
- **Public homepage**: `/` now fetches upcoming hackathons and live platform stats from unauthenticated endpoints, replacing the hardcoded stat numbers.
- **Team join codes**: every team created gets a unique 8-character invite code. Participants join via `POST /api/teams/join-by-code`. Leaders and managers see a copyable code and can add members by username via `POST /api/teams/{team_id}/members`.
- **Database migrations**: `ensure_columns` in `app.database` automatically adds missing columns (including Phase 20 evaluation fields and Phase 21 fields) to existing SQLite/PostgreSQL databases.
- **Validation**: `pytest backend/tests` ✅ 20 passed, `npm run build` ✅, `seed_dev.py` ✅, `validate_flow.py` ✅ all flows passed.

## Backend (completed)
- **Phase 20.4 (organizer/admin scope hardening)**: added `backend/app/routers/common.py` with `can_access_hackathon`/`can_manage_hackathon`/`require_hackathon_access`; scoped `GET /api/hackathons`, `GET /api/hackathons/{id}`, `GET /api/problem-statements/{id}`, `GET /api/teams`, `GET /api/teams/{id}`, `POST /api/teams`, `POST /api/teams/{id}/join`, `GET /api/submissions`, `GET /api/submissions/{id}`, `POST /api/submissions`, `POST /api/evaluate/*`, and `GET /api/leaderboard/{id}` so admins/judges see everything, participants see everything, and organizers only see/control their own hackathons; removed the duplicate `/api/reports/submission/{id}` route; proxied `/uploads` in `frontend/vite.config.ts` and `frontend/nginx/default.conf`.
- **Phase 20.5 (deployment docs)**: updated `README.md` RBAC matrix and API docs; rewrote `gcp/README.md` for Cloud SQL, Artifact Registry, Cloud Load Balancing, and nginx `/api` + `/uploads` proxy; added backend healthchecks to `docker-compose.yml` and `docker-compose.prod.yml`.
- **Phase 20.6 (PWA / mobile polish)**: updated `frontend/public/manifest.json` with `id`, `scope`, and `categories`; added `<noscript>` fallback in `frontend/index.html`; improved mobile navbar with an always-visible hamburger menu, Escape-to-close, `aria-expanded`, and auth links for logged-out users; added an Escape key listener to close the report detail panel in `ReportsPage`.
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
- **New routes**: `/admin` (admin-only), `/public/leaderboard/:id` (shareable), `/reports` (organiser/admin only), `/reports/submission/:id` (printable per-team report), `/hackathons/:id/edit` (edit hackathon settings and banner).
- **New components**: `AdminDashboard`, `AdminRoute`, `OrganizerRoute`, `EvaluationReport`, `PublicLeaderboard`, `EasterEggOverlay`, `EasterEggProvider`, global `Footer` in `PageLayout`, `ReportsPage`, `TeamReportPage`, `BackButton`, `EditHackathon`.
- **Role-aware UI**: dashboard cards adapt to admin/organizer/judge/participant; admin and reports links in navbar for the appropriate roles; registration role selector (Student / Organizer).
- **Navigation**: Dashboard now appears before Hackathons in the navbar; a mobile hamburger menu exposes all role-aware links on small screens.
- **Back buttons**: every submenu page (`CreateHackathon`, `HackathonDetail`, `HackathonTeams`, `Submit`, `Leaderboard`, `ReportsPage`, `AdminDashboard`) has a consistent back button.
- **Hackathons page**: uses backend counts; organisers/admins can delete hackathons from the card.
- **Landing page**: public hero, live platform stats, a featured upcoming-hackathon banner with countdown/status, and a horizontal snap-scrolling card carousel for browsing open arenas. The carousel has previous/next buttons and is mobile-friendly.
- **Loading screen**: a themed gaming-style loader with a bobbing rocket, neon flame, and animated progress bar used on every route guard and page loading state.
- **Easter eggs**: click-based hunt now includes the console secret message, landing hero title, status badges, countdown timers, empty states, and the hackathon rubric toggle. New hints are shown in the Egg Hunt panel.
- **Team page**: participants can create/join/submit; organisers/admins can also create teams and submit on behalf of a team, delete teams, view per-team reports, add/remove members, and change the team leader. Team leaders can also manage their own team's members and leader.
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
- `pytest backend/tests` ✅ 22 passed (includes team member management and organizer/admin scope tests)
- `npm run build` ✅ production build succeeded
- `validate_flow.py` ✅ all flows passed with the new scoped access rules
- Team member role update/remove endpoints tested for organisers and team leaders
- Backend PDF endpoint returns a valid `%PDF` byte stream for evaluated submissions; WeasyPrint is the primary engine in Docker, fpdf2 fallback works on Windows dev without GTK.
- Docker Compose files updated for PostgreSQL; backend Dockerfile includes WeasyPrint and PostgreSQL dependencies.
- `seed_dev.py` ✅ idempotent; re-running creates a single demo hackathon with two evaluated submissions and a populated leaderboard
- Reports endpoints verified on a fresh backend process; per-team printable report accessible to organisers/admins
- Admin create-team/submit and member-management flows verified via API on a fresh backend process
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
- **Start**: scheduled demo start date/time + 24-hour duration
- **Average score**: ~168
- **Top team**: `Doc Dynamos` — ~252 pts
- **Verdict breakdown**: 2 × NEEDS WORK (deterministic fallback because no Gemini key is set)
- **Type breakdown**: 1 tech, 1 non-tech
- **Team entries**: Tech Titans (tech, ~84 pts) and Doc Dynamos (non-tech, ~252 pts)
- **Per-team report**: includes score breakdown, authenticity band, category scores, category explanations, strengths, weaknesses, review flags, and suggested judge questions.

## Repository
- Phase 22 changes will be committed and pushed to `https://github.com/Zethetaprojects/Zecathon.git` branch `main`.
- No new author metadata is added; commits retain the existing `user.name`/`user.email` from the global git config.

## Next action
- Phase 22 is complete and pushed to `main`.
- No further blockers; ready for user testing or deployment.

## Blockers
- None.

## Leftovers / future improvements
- Move uploads to Cloud Storage and update `app/services/file_storage.py` for S3-compatible storage.
- Add real-time notifications for score updates (optional).
- Add a Cloud Build / Cloud Deploy pipeline template if needed.
