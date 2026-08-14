# Hackathon Evaluation Platform — Requirements & Context

## User's Goal
Build a web application for running hackathons where:
- Users can log in and create hackathons.
- Each hackathon can have one or more problem statements uploaded by the organiser.
- Teams submit projects per problem statement.
- A submission is either:
  - **Tech** → requires a GitHub repository link.
  - **Non-tech** → requires a project document (PDF/DOCX/PPTX/XLSX/etc.).
- Teams can optionally upload a supporting PPT for evaluation.
- Two evaluation APIs decide the score:
  - `POST /api/evaluate/tech/{submission_id}`
  - `POST /api/evaluate/non-tech/{submission_id}`
- Every hackathon has a live leaderboard.
- Scores must be **discrete** (not clustered on the same value) and differentiate teams.
- **RBAC** is enforced across the API:
  - Roles: `admin`, `organizer`, `judge`, `participant`.
  - New registrations default to `participant`.
  - Only `organizer` or `admin` can create hackathons and upload problem statements.
  - Only `judge`, `organizer`, or `admin` can evaluate submissions.
  - All authenticated users can create/join teams and submit projects.
  - Admins can change roles via `PUT /api/auth/users/{id}/role` or the `set_role` script.
- **LLM evaluator** uses Google Gemini 2.5 Flash when `GEMINI_API_KEY` is provided, otherwise falls back to a generic `AI_BACKEND_URL`, then a deterministic mock.

## Input contract for the evaluator APIs
Payload must contain at minimum:
- `team_name` (string)
- `problem_statement` (string)
- `submission` (GitHub URL for tech, document URL for non-tech)
- Optional: `ppt` (document URL) — included in non-tech evaluation when provided

The evaluation should be **hackathon-oriented**, using rubrics adapted from the Zetheta tool but simplified for hackathon submissions.

## Reference tool context (Zetheta WorkBridge)
The existing tool has two production routes:
- `POST /api/v2/zetheta/analyze/technical` — GitHub repo against a problem statement.
- `POST /api/v2/zetheta/analyze/document` — uploaded document against a problem statement.

Key patterns to reuse:
1. **Admissibility gate** — reject empty, wrong, or template-only submissions before scoring.
2. **Competence scoring** — 7 (non-tech) / 8 (tech) categories totalling 1000 points.
3. **Authenticity gate** — multiplier that penalises AI-heavy or template-driven submissions.
4. **Server-side score reconciliation** — clamping, anti-averaging, and discrete final scores.
5. **Review flags** — submissions needing human review are flagged, not silently rejected.
6. **Verdict bands**:
   - 850–1000 → OUTSTANDING
   - 700–849 → EXCELLENT
   - 500–699 → SATISFACTORY
   - 0–499 → NEEDS WORK
   - Gate reject → NOT ASSESSABLE

### Adapted hackathon rubrics (to be implemented)

#### Tech rubric (8 categories, 1000 points)
1. **Problem Understanding** — 150 — Does the code address the specific problem statement?
2. **Implementation Completeness** — 200 — Features built, endpoints working, data models present.
3. **Code Quality & Architecture** — 150 — Structure, tests, docs, clean practices.
4. **Innovation & Creativity** — 150 — Novel features, not plain CRUD.
5. **Technical Feasibility** — 100 — Can it actually run/deploy?
6. **Documentation** — 100 — README, setup instructions, API docs.
7. **Commit Authenticity / Effort** — 100 — Spread of commits, not single-day bulk.
8. **Presentation / Demo** — 50 — Screenshots, video, or PPT quality.

#### Non-tech rubric (7 categories, 1000 points)
1. **Problem-Specific Grounding** — 150 — Engagement with this exact problem.
2. **Solution Effectiveness** — 200 — How well the proposed solution solves it.
3. **Research & Evidence** — 150 — Data, methodology, validation.
4. **Feasibility & Practicality** — 150 — Realistic plan, budget, rollout.
5. **Communication & Clarity** — 100 — Logical structure, easy to follow.
6. **Innovation & Creativity** — 150 — Originality and insight.
7. **Presentation Quality** — 100 — Use of PPT/document formatting for impact.

Both paths use an **authenticity multiplier**:
- HIGH_HUMAN_INPUT → 1.00
- MIXED → 0.85
- PREDOMINANTLY_ASSISTED → 0.60
- NO_DISCERNIBLE_HUMAN_INPUT → 0.40

### Required anti-clustering rule
After computing the raw score, apply a **jitter / reconciliation step** so that teams with different submissions do not end up on identical scores. The rule:
- If two teams in the same hackathon have the same final rounded score, add/subtract a small deterministic delta based on `team_id` (or hash) and a scoring seed.
- The delta is small enough to preserve ordering but large enough to be visible on the leaderboard (e.g. ±1–5 points within the same verdict band).
- This is documented in the API and UI so organisers know it is intentional.

## Stack choice
- **Backend**: FastAPI + SQLAlchemy + SQLite + Pydantic + python-jose (JWT) + passlib.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Router.
- **Document parsing**: python-docx, PyPDF2, python-pptx, openpyxl.
- **GitHub access**: `requests` against GitHub API (tree + commits), with optional `GITHUB_TOKEN`.
- **LLM interface**: configurable `AI_BACKEND_URL` / `GENAI_URL` with a simple HTTP JSON adapter. Defaults to a local GENAI backend at `http://localhost:5000`.

## Directory structure (planned)
```
AGENT_CONFIG/
  context.md
  plan.md
  state.md
  todo.md
backend/
  app/
    __init__.py
    main.py
    config.py
    database.py
    models.py
    schemas.py
    auth.py
    routers/
      auth.py
      hackathons.py
      problem_statements.py
      teams.py
      submissions.py
      evaluate.py
      leaderboard.py
    services/
      github_client.py
      document_extractor.py
      llm_client.py
      scoring/
        tech_evaluator.py
        non_tech_evaluator.py
        admissibility.py
        authenticity.py
        reconciliation.py
  requirements.txt
  run.py
  tests/
frontend/
  src/
    components/
    pages/
    api/
    App.tsx
  package.json
  vite.config.ts
README.md
```

## Non-functional requirements
- Self-contained repo (can run locally with one backend + one frontend command).
- Unit tests for scoring/reconciliation and API smoke tests.
- Each build phase is tested, validated, and committed.
- Git history should be a clear trail of milestones.

## Open questions / leftovers
- Exact LLM payload format is environment-dependent; keep it configurable.
- S3/local storage for uploads is out of scope for MVP; store files on local filesystem and expose via `/uploads/{filename}`.
- No payment, no email, no real-time notifications for the MVP.
