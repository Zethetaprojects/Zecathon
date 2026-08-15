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

## Phase 9 — UI/UX theme pass (ZECATHON landing page)
- [x] ZECATHON landing page with hero, stats, features, how-it-works, CTA, footer
- [x] Dark space/pixel theme across all screens
- [x] Shared `SpaceBackground`, `Navbar`, `PageLayout`, `ErrorBoundary`, `Footer`
- [x] Custom purple cursor from `pngegg.png` with trail and hover/click feedback
- [x] Micro-interactions and scroll reveal
- [x] Easter-egg controller on landing page
- [x] Dashboard cleaned up — Leaderboards card removed
- [x] Build passes
- [x] Full-flow validation passes
- [x] Commit

## Phase 10 — RBAC + Gemini 2.5 Flash
- [x] Add UserRole enum and role column
- [x] RBAC dependencies and route protection
- [x] Admin endpoint + set_role script
- [x] Gemini REST API client integration
- [x] GEMINI_API_KEY / GEMINI_MODEL env config
- [x] Frontend role-aware UI
- [x] pytest and validate_flow.py pass
- [x] Commit

## Phase 11 — Deployment-ready hardening
- [x] Admin dashboard and role-specific UI
- [x] Registration role selector (Student / Organizer only; no admin)
- [x] Dynamic per-hackathon rubrics (default + editable)
- [x] Judge questions in evaluation reports
- [x] Non-tech optional GitHub URL
- [x] Evaluation retry endpoint + UI button
- [x] Stronger login security (password policy, bcrypt rounds, rate limiting)
- [x] Shareable public leaderboard link
- [x] Easter eggs throughout the app
- [x] GCP deployment artifacts (Dockerfiles, docker-compose, README)
- [x] Full E2E validation with generated reports
- [x] Commit

## Phase 12 — Visible Easter Egg Hunt + Gemini key check
- [x] Verify `GEMINI_API_KEY` in `backend/.env` (key is present but invalid; report to user).
- [x] Build global `EasterEggHunt` panel in navbar with hints, progress, secret codes, and reset.
- [x] Add floating `EggMascot` (Z-bot) and make the controller button global in `PageLayout`.
- [x] Wire into `Navbar` and `LandingPage`, add Tailwind animations for bob/wobble/slide/shake.
- [x] Validate: `npm run build` ✅, `pytest backend/tests` ✅ 12 passed, `validate_flow.py` ✅ all flows passed.
- [x] Commit.

## Phase 13 — Usability fixes: panel size, no typing eggs, cursor performance
- [x] Redesign `EasterEggHunt` as a large centered modal (`max-w-2xl`, `max-h-[85vh]`) with a scrollable two-column grid.
- [x] Remove all typing/keyboard eggs from hints and triggers (Konami, secret words, username hacker, shortcut M, secret-code panel).
- [x] Add click-based `sound-toggle` egg on the navbar music button.
- [x] Fix `CustomCursor`: remove trailing image and `requestAnimationFrame` loop, use direct transform updates via refs.
- [x] Validate: `npm run build` ✅, `pytest backend/tests` ✅ 12 passed, `validate_flow.py` ✅ all flows passed.
- [x] Commit.

## Leftovers / next steps
- [ ] User adds a valid `GEMINI_API_KEY` (starts with `AIza...`) to `backend/.env` for real LLM evaluations
- [ ] Promote existing users to organizer/judge via admin endpoint or set_role script
- [ ] Deploy backend to Cloud Run and frontend to Firebase Hosting (see `gcp/README.md`)
- [ ] Optional: migrate SQLite to Cloud SQL and local uploads to Cloud Storage for production scaling
- [ ] Optional: mobile hamburger menu refinement
