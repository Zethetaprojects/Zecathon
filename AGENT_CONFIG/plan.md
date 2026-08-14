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
- Implement `GET /api/hackathons/{id}/leaderboard`.
- Apply anti-clustering logic across all evaluated submissions for a hackathon.
- Frontend leaderboard page with sorting, verdict badges, review flags.
- Validate: create multiple submissions, evaluate, confirm leaderboard shows distinct scores and correct ordering.
- Commit: `feat: leaderboard with discrete scoring`

## Phase 8 — Integration, E2E smoke tests, polish
- Add a `docker-compose.yml` or `run.sh` for one-command startup.
- E2E smoke test script creates a hackathon, uploads a problem statement, submits a tech and non-tech project, evaluates both, and prints the leaderboard.
- README with setup instructions, env vars, API docs.
- Final review and commit: `release: MVP hackathon evaluation platform`

## Phase 9 — UI/UX theme & landing page (ZECATHON)
- Add public landing page at `/` with ZECATHON branding and Zetheta Algorithms tagline.
- Apply dark space/pixel theme (navy background, starfield, neon pink/cyan/purple accents, pixel-style fonts) across Login, Register, Dashboard, Hackathons, Create, Detail, Teams, Submit, and Leaderboard.
- Build shared components: `SpaceBackground`, `Navbar`, `PageLayout`, `ErrorBoundary`.
- Fix blank-page causes: wrap app in `ErrorBoundary`, ensure token is stored before `/auth/me`, render themed loading/error fallbacks on every screen.
- Validate: `npm run build` and `validate_flow.py` pass.
- Commit: `feat: ZECATHON landing page and space/pixel theme`

## Commit cadence
A commit is required at the end of every phase. If a phase is large, split it into intermediate commits (e.g. backend work first, frontend work second). Each commit message must be clear and phase-tagged.
