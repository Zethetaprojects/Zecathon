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
- [x] ZECATHON landing page at `/` with hero, stats, features, how-it-works, CTA, footer
- [x] Dark space/pixel theme across all screens
- [x] Shared `SpaceBackground`, `Navbar`, `PageLayout`, `ErrorBoundary`, `Footer`
- [x] Modern SaaS-style glass pill navbar with centered Features dropdown
- [x] Procedural space/chiptune music with navbar toggle
- [x] Auth-aware UI: logged-in-only features hidden from guests in navbar, landing page, and footer
- [x] Custom purple cursor from `pngegg.png` with trail and hover/click feedback
- [x] Micro-interactions (lift, pop, glow, tilt, shift, scroll reveal) across pages
- [x] Build passes (`npm run build`)
- [x] Full-flow validation passes (`validate_flow.py`)
- [x] Update `AGENT_CONFIG` state and todo
- [x] Commit

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
- [ ] User adds GEMINI_API_KEY to backend/.env for real evaluations
- [ ] Promote existing users to organizer/judge via set_role script or admin endpoint
- [ ] Optional S3 storage migration
- [ ] User review of new theme in browser (hard-refresh localhost:5173)
- [ ] Optional real LLM endpoint configuration
- [ ] Optional mobile hamburger menu refinement
