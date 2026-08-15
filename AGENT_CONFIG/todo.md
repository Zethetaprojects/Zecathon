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

## Phase 14 — Gemini model fallback + real resource pages + portal fix
- [x] Verify the Gemini key is valid; the issue was the configured model `gemini-2.5-flash` is no longer available for new users on `generateContent`.
- [x] Add automatic model fallback in `LLMClient` to `gemini-flash-latest` / `gemini-3.5-flash` / `gemini-3.7-flash`.
- [x] Update default `GEMINI_MODEL` in `backend/.env.example` and `backend/app/config.py` to `gemini-flash-latest`.
- [x] Render the Easter Egg Hunt modal through a React portal to `document.body` so it is not clipped by the navbar.
- [x] Create real footer resource pages: `/docs`, `/api-docs`, `/rubrics`, `/support`, and update footer links.
- [x] Validate: `npm run build` ✅, `pytest backend/tests` ✅ 12 passed, `validate_flow.py` ✅ all flows passed with real Gemini output.
- [x] Commit.

## Phase 15 — Switch default Gemini model to gemini-3.5-flash-lite
- [x] Confirm `gemini-3.5-flash-lite` works for `generateContent` with the configured key.
- [x] Set `GEMINI_MODEL` default to `gemini-3.5-flash-lite` in `backend/app/config.py` and `backend/.env.example`.
- [x] Reorder `LLMClient` fallback list to prefer `gemini-3.5-flash-lite`.
- [x] Validate: `pytest backend/tests` ✅ 12 passed, real Gemini call ✅, `validate_flow.py` ✅ all flows passed.
- [x] Commit.

## Phase 16 — Reports, global sound system, README diagrams, and push
- [x] Create `backend/app/routers/reports.py` with `GET /api/reports` and `GET /api/reports/{hackathon_id}` protected to organisers/admins.
- [x] Add `HackathonReportSummary`, `HackathonReportDetail`, `TeamReportEntry` schemas.
- [x] Wire `/reports` route in `frontend/src/App.tsx` behind a new `OrganizerRoute` guard.
- [x] Add "Reports" card to `Dashboard.tsx` and nav link for organisers/admins.
- [x] Build `ReportsPage.tsx` with summary grid and detail breakdown.
- [x] Extend `MusicProvider` with a master `enabled` toggle and a `ClickEngine` that plays a short click on every button/link/role=button interaction.
- [x] Make the navbar speaker icon toggle the entire sound system (music + effects).
- [x] Add Mermaid architecture/auth/lifecycle/evaluation/RBAC diagrams to `README.md` and update env var docs for Gemini.
- [x] Validate: `npm run build` ✅, `pytest backend/tests` ✅ 12 passed, `validate_flow.py` ✅ all flows passed, reports endpoints verified.
- [x] Commit.
- [ ] Push to `https://github.com/Zethetaprojects/Zecathon.git` branch `main` (SSH failed; need a GitHub token or deploy key).

## Phase 18 — Counts, RBAC cleanup, deletions, per-team reports, UI polish, and upload path resolution
- [x] Backend counts on `GET /api/hackathons`
- [x] Role-based team/submission actions (participants + managers can create teams/submit on behalf of teams)
- [x] Delete hackathon and team endpoints with cascade
- [x] Per-team printable report (`/reports/submission/:id`) with judge questions
- [x] Admin role select arrow style fix
- [x] README RBAC/API updates and `seed_dev.py` idempotency
- [x] Upload path fix: `save_upload` → `/uploads/{filename}`; `document_extractor` resolves `/uploads/...` back to local `upload_dir`
- [x] `pytest backend/tests` ✅ 13 passed
- [x] `npm run build` ✅
- [x] `seed_dev.py` idempotency ✅
- [x] Commit and push

## Phase 19 — Reports availability, admin team management, navigation, and PWA polish
- [x] Identify stale backend processes hiding the `/api/reports/submission/{id}` route
- [x] Allow admins/organizers to create teams and submit on behalf of teams (backend + frontend)
- [x] Reorder navbar: Dashboard before Hackathons
- [x] Add mobile hamburger menu
- [x] Add `BackButton` component and back buttons to all submenu pages
- [x] Add PWA manifest, service worker, and mobile-friendly meta tags
- [x] `pytest backend/tests` ✅ 13 passed
- [x] `npm run build` ✅
- [x] Admin create-team/submit and reports verified via API on a fresh backend process
- [x] Commit and push
- [ ] User fully restarts the dev stack to clear stale port 8002 processes

## Phase 20 — Production hardening

- [x] 20.1 Backend PDF reports + category explanations + frontend download (committed)
- [x] 20.2 PostgreSQL in Docker Compose (committed)
- [x] 20.3 Structured logging with rotation (committed)
- [x] 20.4 Harden organizer/admin scope
- [ ] 20.5 Deployment-ready Docker/nginx/GCP docs
- [ ] 20.6 PWA and mobile navbar polish
- [ ] 20.7 Tests, validation, and commits
