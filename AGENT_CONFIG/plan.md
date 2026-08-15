# Build Plan — Phase-wise, Tested, Validated, Committed

## Phase 0 — Project scaffolding & repo setup
- Create `backend/`, `frontend/`, and shared config files.
- Initialise `.gitignore`, `README.md`, and `AGENT_CONFIG/` tracking docs.
- Validate: `python -c "import fastapi"` works, `npm --version` works.
- Commit: `chore: project scaffolding`

## Phase 1 — Backend skeleton, DB, auth
- Implement FastAPI app entry, config, SQLite + SQLAlchemy models, Alembic-free auto-create.
- Implement JWT login/register (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`).
- Password hashing with bcrypt.
- Add pytest tests for auth and DB.
- Validate: `pytest backend/tests` passes; login flow works with curl.
- Commit: `feat: backend auth and database models`

## Phase 2 — Frontend foundation
- Bootstrap React + TypeScript + Vite + Tailwind + React Router.
- Build pages: Login, Register, Dashboard shell.
- Wire auth API with localStorage token and axios/fetch wrapper.
- Validate: `npm run dev` starts, login page hits backend, routes render.
- Commit: `feat: frontend scaffold and auth pages`

## Phase 3 — Hackathons & problem statements
- Backend: CRUD routers for hackathons (`/api/hackathons`) and problem statements (`/api/hackathons/{id}/problem-statements`).
- Upload problem statement PDF/DOCX files and store metadata + local path.
- Frontend: list, create, detail pages for hackathons; upload problem statement.
- Validate: create hackathon via UI, upload problem statement, verify API returns list.
- Commit: `feat: hackathon and problem statement management`

## Phase 4 — Teams & submissions
- Backend: team creation/joining per hackathon; submissions with type `tech` or `non-tech`.
- Submission stores GitHub URL or document path, optional PPT path.
- Frontend: team list, create/join, submission form, upload documents.
- Validate: full submission cycle via curl and UI.
- Commit: `feat: teams and project submissions`

## Phase 5 — Tech evaluation API
- Implement `POST /api/evaluate/tech/{submission_id}`.
- GitHub client fetches repo tree, README, file contents, commit history (capped).
- Prompt builder adapted to hackathon tech rubric (8 categories).
- Admissibility gate: empty/template, README-only, unrelated → `NOT ASSESSABLE`.
- Authenticity multiplier applied, then `reconciliation` to produce discrete final score.
- Validate with sample GitHub repos and unit tests; ensure score distribution is not flat.
- Commit: `feat: tech evaluation API`

## Phase 6 — Non-tech evaluation API
- Implement `POST /api/evaluate/non-tech/{submission_id}`.
- Document extractor for PDF, DOCX, PPTX, XLSX; optional PPT merged into text.
- Prompt builder adapted to hackathon non-tech rubric (7 categories).
- Admissibility gate: empty, CV, unrelated, restated problem statement → `NOT ASSESSABLE`.
- Authenticity multiplier + discrete score reconciliation.
- Validate with sample documents and unit tests.
- Commit: `feat: non-tech evaluation API`

## Phase 7 — Leaderboard & discrete scoring
- Implement `GET /api/leaderboard/{id}`.
- Apply anti-clustering logic across all evaluated submissions for a hackathon.
- Frontend leaderboard page with sorting, verdict badges, review flags.
- Validate: create multiple submissions, evaluate, confirm leaderboard shows distinct scores and correct ordering.
- Commit: `feat: leaderboard with discrete scoring`

## Phase 8 — Integration, E2E smoke tests, polish
- Add `docker-compose.yml` and `start-dev.sh`/`start-dev.ps1` for one-command startup.
- E2E smoke test script creates a hackathon, uploads a problem statement, submits a tech and non-tech project, evaluates both, and prints the leaderboard.
- README with setup instructions, env vars, API docs.
- Final review and commit: `release: MVP hackathon evaluation platform`

## Phase 9 — UI/UX theme & landing page (ZECATHON)
- Add public landing page at `/` with ZECATHON branding and Zetheta Algorithms tagline.
- Apply dark space/pixel theme (navy background, starfield, neon pink/cyan/purple accents, pixel-style fonts) across all pages.
- Build shared components: `SpaceBackground`, `Navbar`, `PageLayout`, `ErrorBoundary`, `Footer`.
- Fix blank-page causes: wrap app in `ErrorBoundary`, ensure token is stored before `/auth/me`, render themed loading/error fallbacks on every screen.
- Validate: `npm run build` and `validate_flow.py` pass.
- Commit: `feat: ZECATHON landing page and space/pixel theme`

## Phase 10 — RBAC throughout API + Gemini 2.5 Flash evaluator
- Add `role` column to `users` with enum (`admin`, `organizer`, `judge`, `participant`); default new registrations to `participant`.
- Lightweight migration for existing SQLite databases.
- Add RBAC dependencies (`require_admin`, `require_organizer`, `require_judge`) and protect routers.
- Admin endpoint and CLI script to assign roles.
- Integrate Google Gemini 2.5 Flash REST API in `LLMClient` with `GEMINI_API_KEY`/`GEMINI_MODEL` env vars; keep generic backend and deterministic mock fallbacks.
- Frontend role-aware UI.
- Validate: `pytest`, `validate_flow.py`, `npm run build` pass.
- Commit: `feat: RBAC throughout API and Gemini 2.5 Flash integration`

## Phase 11 — Deployment-ready platform hardening
- **Admin / super-admin views**: dedicated admin dashboard, admin-only user management, role-specific dashboard cards for participant/organizer/judge/admin.
- **Registration role selector**: register as Student (participant) or Organizer; admin/judge roles are not selectable at signup.
- **Dynamic rubrics**: per-hackathon custom rubrics with sensible defaults; tech and non-tech categories can be overridden, backend falls back to defaults when absent.
- **Rich evaluation reports**: scoring metrics + suggested judge questions derived from the project content by the LLM.
- **Evaluation retry**: backend retry endpoints and frontend Retry button for judges.
- **Non-tech GitHub support**: non-tech submissions may optionally include a supporting GitHub URL for deeper analysis.
- **Secure login**: stronger password policy, bcrypt rounds, and rate limiting on auth endpoints.
- **Shareable live leaderboards**: public, unauthenticated leaderboard link that stays live as scores are updated.
- **Easter eggs**: hidden interactions throughout the app (Konami code, secret words, clickable stars, hidden controller/teddy, rapid logo clicks, social icon secrets, dashboard/login surprises, etc.).
- **GCP deployment**: Dockerfiles, Cloud Run config, frontend static hosting guidance, and deployment docs.
- **Full end-to-end validation**: create a hackathon, add problem statements, submit tech and non-tech projects, evaluate with real LLM or deterministic fallback, and inspect the generated reports and leaderboard.
- Validate: `pytest backend/tests`, `validate_flow.py`, `npm run build`, and API smoke tests all pass.
- Commit: `release: production-ready ZECATHON platform`

## Phase 16 — Reports, global sound system, README diagrams, and push
- Create `backend/app/routers/reports.py` with `GET /api/reports` and `GET /api/reports/{hackathon_id}` protected to organisers/admins.
- Add `HackathonReportSummary`, `HackathonReportDetail`, `TeamReportEntry` schemas.
- Wire `/reports` route in `frontend/src/App.tsx` behind a new `OrganizerRoute` guard.
- Add "Reports" card to `Dashboard.tsx` and nav link for organisers/admins.
- Build `ReportsPage.tsx` with summary grid and detail breakdown.
- Extend `MusicProvider` with a master `enabled` toggle and a `ClickEngine` that plays a short click on every button/link/role=button interaction.
- Make the navbar speaker icon toggle the entire sound system (music + effects).
- Add Mermaid architecture/auth/lifecycle/evaluation/RBAC diagrams to `README.md` and update env var docs for Gemini.
- Validate: `npm run build` ✅, `pytest backend/tests` ✅ 12 passed, `validate_flow.py` ✅ all flows passed, reports endpoints verified.
- Commit and push to `https://github.com/Zethetaprojects/Zecathon.git` branch `main` without adding any new author metadata.

## Leftovers / next steps
- User adds a valid `GEMINI_API_KEY` (starts with `AIza...`) to `backend/.env` for real LLM evaluations.
- Promote existing users to organizer/judge via admin endpoint or set_role script.
- Deploy backend to Cloud Run and frontend to Firebase Hosting (see `gcp/README.md`).
- Optional: migrate SQLite to Cloud SQL and local uploads to Cloud Storage for production scaling.
- Optional: mobile hamburger menu refinement.

## Commit cadence
A commit is required at the end of every phase. If a phase is large, split it into intermediate commits (e.g. backend work first, frontend work second). Each commit message must be clear and phase-tagged.
