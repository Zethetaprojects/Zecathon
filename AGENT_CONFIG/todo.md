# TODO

## Phase 0 — Project scaffolding
- [x] Create `AGENT_CONFIG/` folder and docs
- [x] Repo `.gitignore`, `README.md`, backend/frontend skeleton
- [x] Validate toolchain
- [x] Commit: project scaffolding

## Phase 1 — Backend auth & DB
- [x] FastAPI + SQLAlchemy + SQLite models
- [x] JWT register/login/me
- [x] bcrypt password hashing
- [x] Tests + commit

## Phase 2 — Frontend foundation
- [x] React + TS + Vite + Tailwind + React Router
- [x] Login / Register / Dashboard pages
- [x] Auth API + localStorage token
- [x] Commit: frontend scaffold and auth pages

## Phase 3 — Hackathons & problem statements
- [x] Backend CRUD routers
- [x] Problem statement file upload
- [x] Frontend list / create / detail pages
- [x] Commit

## Phase 4 — Teams & submissions
- [x] Team create/join per hackathon
- [x] Tech (GitHub) and non-tech (document) submissions with optional PPT
- [x] Frontend team/submit pages
- [x] Commit

## Phase 5 — Tech evaluation API
- [x] GitHub client (tree, README, commits)
- [x] 8-category hackathon rubric
- [x] Admissibility + authenticity + discrete scoring
- [x] Commit

## Phase 6 — Non-tech evaluation API
- [x] Document extractor (PDF/DOCX/PPTX/XLSX)
- [x] 7-category rubric + optional PPT merge
- [x] Admissibility + authenticity + discrete scoring
- [x] Commit

## Phase 7 — Leaderboard & discrete scoring
- [x] `GET /api/leaderboard/{hackathon_id}`
- [x] Anti-clustering / deterministic jitter per team
- [x] Frontend leaderboard page
- [x] Commit

## Phase 8 — Integration, E2E, polish
- [x] One-command startup scripts (`start-dev.sh`, `start-dev.ps1`)
- [x] `validate_flow.py` browserless full-flow test
- [x] README setup + API docs
- [x] Commit

## UI/UX theme pass (current)
- [x] ZECATHON landing page at `/`
- [x] Space/pixel theme across all screens
- [x] Shared `SpaceBackground`, `Navbar`, `PageLayout`, `ErrorBoundary`
- [x] Fix blank-page causes (ErrorBoundary, explicit token storage, themed loading states)
- [x] Build passes (`npm run build`)
- [x] Full-flow validation passes (`validate_flow.py`)
- [x] Update `AGENT_CONFIG` state and todo

## Phase 10 — RBAC + Gemini 2.5 Flash
- [x] Add UserRole enum and role column
- [x] Lightweight migration for existing SQLite DBs
- [x] RBAC dependencies and route protection
- [x] Admin endpoint + set_role script
- [x] Gemini REST API client integration
- [x] GEMINI_API_KEY / GEMINI_MODEL env config
- [x] Frontend role-aware UI
- [x] pytest and validate_flow.py pass
- [x] Commit

## Leftovers / next steps
- [ ] User adds GEMINI_API_KEY to backend/.env
- [ ] Promote existing users to organizer/judge via set_role script or admin endpoint
- [ ] Optional S3 storage migration
- [ ] User review of new theme in browser
- [ ] Optional real LLM endpoint configuration
- [ ] Optional S3 storage migration
- [ ] Optional mobile hamburger menu refinement
- [ ] Commit the UI/UX pass once user approves
