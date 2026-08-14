# Hackathon Evaluation Platform

A web app for organising hackathons, collecting project submissions, and evaluating them with AI-powered scoring.

## Features
- User registration and login (JWT).
- Create hackathons and upload problem statements.
- Create teams and submit projects.
- Two evaluator APIs:
  - **Tech**: evaluates a GitHub repository against a problem statement.
  - **Non-tech**: evaluates a project document (PDF/DOCX/PPTX/XLSX) with optional PPT.
- Live leaderboard with discrete, non-clustered scores.

## Tech stack
- **Backend**: FastAPI, SQLAlchemy, SQLite, Pydantic.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS.
- **LLM**: pluggable HTTP client (configure `AI_BACKEND_URL`).

## Quick start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in.

## Environment variables
See `backend/.env.example`.

## API documentation
FastAPI auto-generated docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).
