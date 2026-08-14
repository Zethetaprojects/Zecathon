"""Start the full stack and validate every user flow.

This is a browserless smoke test: it brings up the backend and Vite dev server,
then calls the same APIs the React UI uses, including file uploads and evaluation.
It uses a real public GitHub repo for the tech evaluation and the built-in fallback
LLM evaluator, so it does not require a configured AI backend.
"""
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
TEST_DB = BASE_DIR / "_validate_flow.db"
UPLOAD_DIR = BASE_DIR / "_validate_uploads"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["UPLOAD_DIR"] = str(UPLOAD_DIR.resolve())
os.environ["SECRET_KEY"] = "validation-secret"
os.environ["AI_BACKEND_URL"] = ""  # force deterministic fallback evaluator

TECH_REPO = "https://github.com/octocat/Spoon-Knife"


def wait_for(url, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url, timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def start_process(cmd, cwd, shell=False):
    return subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=shell,
    )


def _register_and_login(base, username, email, password):
    r = requests.post(f"{base}/auth/register", json={"username": username, "email": email, "password": password})
    assert r.status_code == 201, r.text
    r = requests.post(f"{base}/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _set_role(username: str, role: str):
    con = sqlite3.connect(str(TEST_DB))
    con.execute("UPDATE users SET role = ? WHERE username = ?", (role, username))
    con.commit()
    con.close()


def main():
    # Clean up any previous run artefacts
    TEST_DB.unlink(missing_ok=True)
    shutil.rmtree(UPLOAD_DIR, ignore_errors=True)

    backend_cmd = [str(BACKEND_DIR / "venv/Scripts/python"), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"]
    frontend_cmd = "npm run dev"

    print("Starting backend...")
    backend = start_process(backend_cmd, BACKEND_DIR)
    print("Starting frontend...")
    frontend = start_process(frontend_cmd, FRONTEND_DIR, shell=True)

    try:
        print("\nWaiting for backend health...")
        if not wait_for("http://127.0.0.1:8000/api/health", timeout=30):
            print("Backend did not start in time")
            print(backend.stdout.read(2000))
            sys.exit(1)
        print("Backend OK")

        print("Waiting for frontend dev server...")
        if not wait_for("http://localhost:5173", timeout=60):
            print("Frontend did not start in time")
            print(frontend.stdout.read(2000))
            sys.exit(1)
        print("Frontend OK")

        base = "http://127.0.0.1:8000/api"
        steps = []

        # 1. Register organiser
        token_a = _register_and_login(base, "flowuser", "flow@example.com", "secret123")
        _set_role("flowuser", "organizer")
        headers_a = {"Authorization": f"Bearer {token_a}"}
        steps.append(("POST /auth/register + login (organiser)", 200, "OK"))

        # 2. Create hackathon
        r = requests.post(f"{base}/hackathons", json={"name": "Flow Validation Hack", "description": "Testing all flows"}, headers=headers_a)
        steps.append(("POST /hackathons", r.status_code, r.text[:200]))
        assert r.status_code == 201, r.text
        hackathon_id = r.json()["id"]

        # 3. Upload problem statement
        r = requests.post(
            f"{base}/hackathons/{hackathon_id}/problem-statements",
            data={"title": "Reduce food waste", "description": "Build a campus food waste reduction app."},
            files={"file": ("ps.txt", b"Detailed problem statement content goes here.", "text/plain")},
            headers=headers_a,
        )
        steps.append(("POST /hackathons/{id}/problem-statements", r.status_code, r.text[:200]))
        assert r.status_code == 201, r.text
        ps_id = r.json()["id"]

        # 4. Tech team + submission
        r = requests.post(f"{base}/teams", json={"hackathon_id": hackathon_id, "name": "Tech Titans"}, headers=headers_a)
        steps.append(("POST /teams (tech)", r.status_code, r.text[:200]))
        assert r.status_code == 201, r.text
        team_tech_id = r.json()["id"]

        r = requests.post(
            f"{base}/submissions",
            data={"team_id": team_tech_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": TECH_REPO},
            headers=headers_a,
        )
        steps.append(("POST /submissions (tech)", r.status_code, r.text[:200]))
        assert r.status_code == 201, r.text
        tech_sub_id = r.json()["id"]

        r = requests.post(f"{base}/evaluate/tech/{tech_sub_id}", headers=headers_a)
        steps.append((f"POST /evaluate/tech/{tech_sub_id}", r.status_code, r.text[:200]))
        assert r.status_code == 200, r.text
        tech_score = r.json()["total_score"]

        # 5. Non-tech team + submission (needs a second user because one user = one team per hackathon)
        token_b = _register_and_login(base, "flowuser2", "flow2@example.com", "secret123")
        _set_role("flowuser2", "participant")
        headers_b = {"Authorization": f"Bearer {token_b}"}
        steps.append(("POST /auth/register + login (second user)", 200, "OK"))

        r = requests.post(f"{base}/teams", json={"hackathon_id": hackathon_id, "name": "Doc Dynamos"}, headers=headers_b)
        steps.append(("POST /teams (non-tech)", r.status_code, r.text[:200]))
        assert r.status_code == 201, r.text
        team_doc_id = r.json()["id"]

        doc = (
            "Our project solves the food waste problem by building a mobile app for campus cafeterias. "
            "We interviewed students and staff to understand the problem and designed a gamified tracking solution. "
            "The implementation plan includes a realistic budget, timeline, and rollout strategy. "
            "We validated the concept with user testing and this is an original approach."
        ).encode()
        r = requests.post(
            f"{base}/submissions",
            data={"team_id": team_doc_id, "problem_statement_id": ps_id, "type": "non_tech"},
            files={"submission_file": ("report.txt", doc, "text/plain")},
            headers=headers_b,
        )
        steps.append(("POST /submissions (non-tech)", r.status_code, r.text[:200]))
        assert r.status_code == 201, r.text
        non_tech_sub_id = r.json()["id"]

        r = requests.post(f"{base}/evaluate/non-tech/{non_tech_sub_id}", headers=headers_a)
        steps.append((f"POST /evaluate/non-tech/{non_tech_sub_id}", r.status_code, r.text[:200]))
        assert r.status_code == 200, r.text
        non_tech_score = r.json()["total_score"]

        # 6. Leaderboard
        r = requests.get(f"{base}/leaderboard/{hackathon_id}", headers=headers_a)
        steps.append((f"GET /leaderboard/{hackathon_id}", r.status_code, r.text[:300]))
        assert r.status_code == 200, r.text
        board = r.json()

        print("\n=== Frontend ===")
        print("GET http://localhost:5173/ -> 200 OK (Vite dev server is serving the app)")
        print("\n=== API flow results ===")
        for name, status, snippet in steps:
            print(f"{name}: HTTP {status} — {snippet}")
        print(f"\nTech score:      {tech_score} / 1000")
        print(f"Non-tech score:  {non_tech_score} / 1000")
        print(f"\nLeaderboard entries: {len(board)}")
        for row in board:
            print(f"  - {row['team_name']} | {row['type']} | {row['total_score']} pts | {row['verdict']}")

        assert len(board) == 2, "Leaderboard should have 2 entries"
        assert board[0]["total_score"] != board[1]["total_score"], "Scores must be discrete"
        print("\nAll flows passed.")

    finally:
        print("\nStopping servers...")
        backend.terminate()
        frontend.terminate()
        try:
            backend.wait(timeout=5)
        except subprocess.TimeoutExpired:
            backend.kill()
        try:
            frontend.wait(timeout=5)
        except subprocess.TimeoutExpired:
            frontend.kill()


if __name__ == "__main__":
    main()
