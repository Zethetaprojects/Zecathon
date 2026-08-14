#!/usr/bin/env bash
set -e

# Start the backend and frontend in development mode.
# Intended for Git Bash / WSL / Linux / macOS.

cd backend
source venv/Scripts/activate 2>/dev/null || source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Open http://localhost:5173"

wait $BACKEND_PID
wait $FRONTEND_PID
