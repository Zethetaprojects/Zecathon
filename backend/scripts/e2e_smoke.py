"""End-to-end smoke test for the hackathon evaluation platform.

This script creates a hackathon, problem statement, two teams, a tech submission
and a non-tech submission, evaluates both, and prints the leaderboard.
It uses a local test SQLite database and mocks the GitHub/LLM integrations.
"""
import os
import sys

# Use a dedicated test database
os.environ["DATABASE_URL"] = "sqlite:///./e2e_smoke.db"

# Make sure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.database import Base, engine, get_db
from app.main import app


FAKE_REPO = {
    "valid": True,
    "owner": "demo",
    "repo": "demo-repo",
    "files": ["README.md", "src/main.py", "tests/test.py", "docs/api.md"],
    "readme": "# Demo project\nThis solves the hackathon problem.",
    "snippets": {"src/main.py": "print('hello hackathon')"},
    "total_commits": 12,
    "unique_commit_dates": ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"],
    "active_days": 4,
}


FAKE_LLM_RESPONSE = {
    "total_score": 650,
    "percentage": 65.0,
    "verdict": "SATISFACTORY",
    "category_scores": {"Demo": 650},
    "authenticity_band": "MIXED",
    "authenticity_multiplier": 0.85,
    "overall_assessment": "Demo assessment",
    "key_strengths": [],
    "areas_for_improvement": [],
    "red_flags": [],
    "recommendation": "Demo recommendation",
}


def _register_and_login(client: TestClient, username: str, email: str, password: str):
    r = client.post("/api/auth/register", json={"username": username, "email": email, "password": password})
    assert r.status_code == 201, r.text
    r = client.post("/api/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def main():
    # Reset test database
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with patch("app.services.scoring.tech_evaluator.summarize_repo", return_value=FAKE_REPO), \
         patch("app.services.scoring.llm_client.LLMClient.complete_json", return_value=FAKE_LLM_RESPONSE):

        client = TestClient(app)

        token = _register_and_login(client, "smoke_user", "smoke@example.com", "secret123")
        headers = {"Authorization": f"Bearer {token}"}

        # Create hackathon
        r = client.post("/api/hackathons", json={"name": "Smoke Hack", "description": "E2E smoke test"}, headers=headers)
        assert r.status_code == 201, r.text
        hackathon_id = r.json()["id"]

        # Upload problem statement
        r = client.post(
            f"/api/hackathons/{hackathon_id}/problem-statements",
            data={"title": "Reduce campus food waste", "description": "Build a solution that reduces food waste in campus cafeterias."},
            files={"file": ("ps.txt", b"Problem statement details", "text/plain")},
            headers=headers,
        )
        assert r.status_code == 201, r.text
        ps_id = r.json()["id"]

        # Team A - tech submission
        r = client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Tech Titans"}, headers=headers)
        assert r.status_code == 201, r.text
        team_a_id = r.json()["id"]

        r = client.post(
            "/api/submissions",
            data={"team_id": team_a_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/demo/demo-repo"},
            headers=headers,
        )
        assert r.status_code == 201, r.text
        tech_sub_id = r.json()["id"]

        # Team B - non-tech submission (needs a second user because one user cannot be in two teams)
        token_b = _register_and_login(client, "smoke_user_b", "smoke_b@example.com", "secret123")
        headers_b = {"Authorization": f"Bearer {token_b}"}
        r = client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Doc Dynamos"}, headers=headers_b)
        assert r.status_code == 201, r.text
        team_b_id = r.json()["id"]

        document = (
            "Our project is a mobile app that helps students track and reduce food waste in campus cafeterias. "
            "We interviewed cafeteria staff and students to understand the problem. "
            "The solution includes a gamified tracking interface, a dashboard for managers, and a reward system. "
            "We validated the concept with user testing and have a realistic implementation plan. "
            "This is an original approach that combines behavioral insights with operational analytics."
        )
        r = client.post(
            "/api/submissions",
            data={"team_id": team_b_id, "problem_statement_id": ps_id, "type": "non_tech"},
            files={"submission_file": ("report.txt", document.encode(), "text/plain")},
            headers=headers_b,
        )
        assert r.status_code == 201, r.text
        non_tech_sub_id = r.json()["id"]

        # Evaluate
        r = client.post(f"/api/evaluate/tech/{tech_sub_id}", headers=headers)
        assert r.status_code == 200, r.text
        tech_result = r.json()
        print(f"Tech score: {tech_result['total_score']} / 1000 ({tech_result['verdict']})")

        r = client.post(f"/api/evaluate/non-tech/{non_tech_sub_id}", headers=headers_b)
        assert r.status_code == 200, r.text
        non_tech_result = r.json()
        print(f"Non-tech score: {non_tech_result['total_score']} / 1000 ({non_tech_result['verdict']})")

        # Leaderboard
        r = client.get(f"/api/leaderboard/{hackathon_id}", headers=headers)
        assert r.status_code == 200, r.text
        board = r.json()
        print("\nLeaderboard")
        print("-" * 60)
        for idx, row in enumerate(board, start=1):
            print(f"{idx}. {row['team_name']} | {row['problem_statement_title']} | {row['type']} | "
                  f"{row['total_score']} pts | {row['verdict']}")
        print("-" * 60)
        assert len(board) == 2
        assert board[0]["total_score"] != board[1]["total_score"], "Scores should be discrete"

    print("\nSmoke test passed.")


if __name__ == "__main__":
    main()
