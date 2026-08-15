# Hackathon Evaluation Platform — Requirements & Context

## User's Goal
Build a web application for running hackathons where:
- Users can log in and create hackathons.
- Each hackathon can have one or more problem statements uploaded by the organiser.
- Teams submit projects per problem statement.
- A submission is either:
  - **Tech** → requires a GitHub repository link.
  - **Non-tech** → requires a project document (PDF/DOCX/PPTX/XLSX/etc.) and may optionally include a supporting GitHub URL.
- Teams can optionally upload a supporting PPT for evaluation.
- Two evaluation APIs decide the score:
  - `POST /api/evaluate/tech/{submission_id}`
  - `POST /api/evaluate/non-tech/{submission_id}`
- Every hackathon has a live, shareable, public leaderboard.
- Scores must be **discrete** (not clustered on the same value) and differentiate teams.
- **RBAC** is enforced across the API and UI:
  - Roles: `admin`, `organizer`, `judge`, `participant`.
  - New registrations default to `participant`.
  - Only `organizer` or `admin` can create hackathons and upload problem statements.
  - Only `judge`, `organizer`, or `admin` can evaluate submissions.
  - All authenticated users can create/join teams and submit projects.
  - Admins can list users and change roles via `GET /api/auth/admin/users` and `PUT /api/auth/users/{id}/role`.
- **Dynamic rubrics**: each hackathon can override the default tech/non-tech scoring rubrics. Defaults are used when no custom rubric is provided.
- **Judge questions**: evaluation reports include 3–5 suggested questions for the judging panel based on the submission.
- **Login security**: strong password policy, bcrypt rounds 12, and sliding-window rate limiting on auth endpoints.
- **LLM evaluator** uses Google Gemini 2.5 Flash when `GEMINI_API_KEY` is provided, otherwise falls back to a generic `AI_BACKEND_URL`, then a deterministic mock.

## Input contract for the evaluator APIs
Payload is implicit via the submission record:
- `team` (name, members)
- `problem_statement` (title, description, uploaded file text)
- `submission` (GitHub URL for tech, document URL for non-tech)
- Optional: `ppt` (document URL) and `github_url` (supporting repo for non-tech)

The evaluation is **hackathon-oriented**, using rubrics adapted from the Zetheta tool but simplified for hackathon submissions.

## Reference tool context (Zetheta WorkBridge)
The existing tool has two production routes:
- `POST /api/v2/zetheta/analyze/technical` — GitHub repo against a problem statement.
- `POST /api/v2/zetheta/analyze/document` — uploaded document against a problem statement.

Key patterns reused:
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

### Default rubrics

#### Tech rubric (8 categories, 1000 points)
1. **Problem Understanding** — 150
2. **Implementation Completeness** — 200
3. **Code Quality & Architecture** — 150
4. **Innovation & Creativity** — 150
5. **Technical Feasibility** — 100
6. **Documentation** — 100
7. **Commit Authenticity / Effort** — 100
8. **Presentation / Demo** — 50

#### Non-tech rubric (7 categories, 1000 points)
1. **Problem-Specific Grounding** — 150
2. **Solution Effectiveness** — 200
3. **Research & Evidence** — 150
4. **Feasibility & Practicality** — 150
5. **Communication & Clarity** — 100
6. **Innovation & Creativity** — 150
7. **Presentation Quality** — 100

### Authenticity multipliers
- HIGH_HUMAN_INPUT → 1.00
- MIXED → 0.85
- PREDOMINANTLY_ASSISTED → 0.60
- NO_DISCERNIBLE_HUMAN_INPUT → 0.40

### Anti-clustering rule
After applying the multiplier, a deterministic tie-breaker nudges the final score within the same verdict band so no two teams share the same score. This preserves ordering while keeping scores discrete and visible.

## Stack choice
- **Backend**: FastAPI + SQLAlchemy + SQLite + Pydantic + python-jose (JWT) + bcrypt.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Router + Axios.
- **Document parsing**: python-docx, PyPDF2, python-pptx, openpyxl.
- **GitHub access**: `requests` against GitHub API (tree + commits), with optional `GITHUB_TOKEN`.
- **LLM interface**: Gemini 2.5 Flash via REST; configurable fallback `AI_BACKEND_URL` and deterministic mock.

## Directory structure
```
AGENT_CONFIG/
  context.md
  plan.md
  state.md
  todo.md
backend/
  app/
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
      file_storage.py
      scoring/
        tech_evaluator.py
        non_tech_evaluator.py
        llm_client.py
        prompts.py
        admissibility.py
        authenticity.py
        reconciliation.py
        constants.py
  tests/
  Dockerfile
  .dockerignore
frontend/
  src/
    components/
    pages/
    api/
    hooks/
    utils/
  Dockerfile
  nginx/
  .dockerignore
gcp/
  README.md
README.md
validate_flow.py
docker-compose.yml
```

## Non-functional requirements
- Self-contained repo (can run locally with one backend + one frontend command).
- Unit tests for scoring/reconciliation and API smoke tests.
- Each build phase is tested, validated, and committed.
- Git history should be a clear trail of milestones.
- GCP deployment artifacts for Cloud Run + Firebase Hosting.

## Open questions / leftovers
- Exact LLM payload format is environment-dependent; keep it configurable.
- S3/Cloud Storage for uploads is out of scope for MVP; store files on local filesystem and expose via `/uploads/{filename}`.
- No payment, no email, no real-time notifications for the MVP.
