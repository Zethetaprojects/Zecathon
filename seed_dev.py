"""Seed the dev database with a demo hackathon, submissions, and evaluations.

Run this once before `start-dev.sh` / `start-dev.ps1` so the Reports page has data
and the public leaderboard is populated. It uses the deterministic LLM fallback so
it does not consume a Gemini API quota.
"""
import os
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"

os.environ.setdefault("AI_BACKEND_URL", "")  # use deterministic fallback evaluator

TECH_REPO = "https://github.com/octocat/Spoon-Knife"
API_BASE = "http://127.0.0.1:8002/api"
DEMO_HACKATHON_NAME = "ZECATHON Demo Hack"


def cleanup_demo_hackathons(db_path: str):
    """Remove previously seeded demo hackathons so the script is idempotent."""
    con = sqlite3.connect(db_path)
    try:
        con.execute("PRAGMA foreign_keys = OFF")
        cur = con.cursor()
        cur.execute("SELECT id FROM hackathons WHERE name = ?", (DEMO_HACKATHON_NAME,))
        ids = [row[0] for row in cur.fetchall()]
        for hid in ids:
            cur.execute(
                "DELETE FROM evaluations WHERE submission_id IN ("
                "SELECT id FROM submissions WHERE team_id IN ("
                "SELECT id FROM teams WHERE hackathon_id = ?))",
                (hid,),
            )
            cur.execute(
                "DELETE FROM submissions WHERE team_id IN (SELECT id FROM teams WHERE hackathon_id = ?)",
                (hid,),
            )
            cur.execute(
                "DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE hackathon_id = ?)",
                (hid,),
            )
            cur.execute("DELETE FROM teams WHERE hackathon_id = ?", (hid,))
            cur.execute("DELETE FROM problem_statements WHERE hackathon_id = ?", (hid,))
            cur.execute("DELETE FROM hackathons WHERE id = ?", (hid,))
        con.commit()
    finally:
        con.close()


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


def register_and_login(base, username, email, password):
    r = requests.post(f"{base}/auth/register", json={"username": username, "email": email, "password": password})
    if r.status_code != 201:
        # If the user already exists, just log in.
        r = requests.post(f"{base}/auth/login", data={"username": username, "password": password})
        assert r.status_code == 200, r.text
        return r.json()["access_token"]
    r = requests.post(f"{base}/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def main():
    backend_cmd = [str(BACKEND_DIR / "venv/Scripts/python"), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8002"]
    backend = subprocess.Popen(backend_cmd, cwd=BACKEND_DIR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    try:
        print("Waiting for backend...")
        if not wait_for(f"{API_BASE}/health", timeout=30):
            print(backend.stdout.read(2000))
            sys.exit(1)
        print("Backend OK")

        # Demo organiser
        db_path = str(BACKEND_DIR / "hackathon.db")
        cleanup_demo_hackathons(db_path)

        token = register_and_login(API_BASE, "demoorganizer", "demo@zetheta.com", "DemoPass1!")
        # Promote the demo user to organiser directly in the dev DB.
        con = sqlite3.connect(db_path)
        con.execute("UPDATE users SET role = 'organizer' WHERE username = ?", ("demoorganizer",))
        con.commit()
        con.close()

        headers = {"Authorization": f"Bearer {token}"}

        # Create hackathon
        r = requests.post(
            f"{API_BASE}/hackathons",
            json={
                "name": "ZECATHON Demo Hack",
                "description": "Demo hackathon seeded for the dashboard report.",
                "rubric": {
                    "non_tech": {
                        "Problem-Specific Grounding": 150,
                        "Solution Effectiveness": 200,
                        "Research & Evidence": 150,
                        "Feasibility & Practicality": 150,
                        "Communication & Clarity": 100,
                        "Innovation & Creativity": 150,
                        "Presentation Quality": 100,
                    }
                },
            },
            headers=headers,
        )
        assert r.status_code == 201, r.text
        hackathon_id = r.json()["id"]

        # Upload problem statement
        r = requests.post(
            f"{API_BASE}/hackathons/{hackathon_id}/problem-statements",
            data={"title": "Reduce food waste", "description": "Build a campus food waste reduction app."},
            files={"file": ("ps.txt", b"Detailed problem statement content goes here.", "text/plain")},
            headers=headers,
        )
        assert r.status_code == 201, r.text
        ps_id = r.json()["id"]

        # Tech team + submission
        r = requests.post(f"{API_BASE}/teams", json={"hackathon_id": hackathon_id, "name": "Tech Titans"}, headers=headers)
        assert r.status_code == 201, r.text
        team_tech_id = r.json()["id"]

        r = requests.post(
            f"{API_BASE}/submissions",
            data={"team_id": team_tech_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": TECH_REPO},
            headers=headers,
        )
        assert r.status_code == 201, r.text
        tech_sub_id = r.json()["id"]

        r = requests.post(f"{API_BASE}/evaluate/tech/{tech_sub_id}", headers=headers)
        assert r.status_code == 200, r.text
        tech_score = r.json()["total_score"]

        # Non-tech team + submission (needs a second user because one user = one team per hackathon)
        token2 = register_and_login(API_BASE, "demoparticipant", "demo2@zetheta.com", "DemoPass1!")
        headers2 = {"Authorization": f"Bearer {token2}"}

        r = requests.post(f"{API_BASE}/teams", json={"hackathon_id": hackathon_id, "name": "Doc Dynamos"}, headers=headers2)
        assert r.status_code == 201, r.text
        team_doc_id = r.json()["id"]

        doc = (
            "Our project solves the food waste problem by building a mobile app for campus cafeterias. "
            "We interviewed students and staff to understand the problem and designed a gamified tracking solution. "
            "The implementation plan includes a realistic budget, timeline, and rollout strategy. "
            "We validated the concept with user testing and this is an original approach."
        ).encode()
        r = requests.post(
            f"{API_BASE}/submissions",
            data={"team_id": team_doc_id, "problem_statement_id": ps_id, "type": "non_tech"},
            files={"submission_file": ("report.txt", doc, "text/plain")},
            headers=headers2,
        )
        assert r.status_code == 201, r.text
        non_tech_sub_id = r.json()["id"]

        r = requests.post(f"{API_BASE}/evaluate/non-tech/{non_tech_sub_id}", headers=headers)
        assert r.status_code == 200, r.text
        non_tech_data = r.json()

        # Public leaderboard
        r = requests.get(f"{API_BASE}/leaderboard/public/{hackathon_id}")
        assert r.status_code == 200, r.text
        board = r.json()

        print("\n=== Demo hackathon seeded ===")
        print(f"Hackathon: ZECATHON Demo Hack (id={hackathon_id})")
        print(f"Tech team score:    {tech_score} / 1000")
        print(f"Non-tech team score: {non_tech_data['total_score']} / 1000")
        print(f"Leaderboard entries: {len(board)}")
        for row in board:
            print(f"  - {row['team_name']} | {row['type']} | {row['total_score']} pts | {row['verdict']}")
        print("\nYou can now log in as 'demoorganizer' / 'DemoPass1!' and view the report at /reports")

    finally:
        backend.terminate()
        try:
            backend.wait(timeout=5)
        except subprocess.TimeoutExpired:
            backend.kill()


if __name__ == "__main__":
    main()
