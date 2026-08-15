import pytest

from app.services.scoring import tech_evaluator as tech_mod
from app.services.scoring import non_tech_evaluator as nontech_mod
from app.services.scoring import llm_client


def _llm_response(raw_score: int):
    return {
        "total_score": raw_score,
        "percentage": raw_score / 10.0,
        "verdict": "SATISFACTORY",
        "category_scores": {"Test": raw_score},
        "authenticity_band": "MIXED",
        "authenticity_multiplier": 0.85,
        "overall_assessment": "Test",
        "key_strengths": [],
        "areas_for_improvement": [],
        "red_flags": [],
        "recommendation": "Test",
    }


@pytest.fixture
def fake_repo(monkeypatch):
    def _fake(url: str):
        return {
            "valid": True,
            "owner": "owner",
            "repo": "repo",
            "files": ["README.md", "src/main.py", "tests/test.py", "docs/api.md"],
            "readme": "# Project\nThis solves the problem.",
            "snippets": {"src/main.py": "print('hello')"},
            "total_commits": 10,
            "unique_commit_dates": ["2026-08-01", "2026-08-02", "2026-08-03"],
            "active_days": 3,
        }
    monkeypatch.setattr(tech_mod, "summarize_repo", _fake)


@pytest.fixture
def fake_llm(monkeypatch):
    def _complete(self, prompt, temperature=0.2, categories=None, **kwargs):
        return _llm_response(650)
    monkeypatch.setattr(llm_client.LLMClient, "complete_json", _complete)


def test_evaluate_tech(auth_client, participant_client, client, fake_repo, fake_llm):
    r = auth_client.post("/api/hackathons", json={"name": "Tech Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Build a chatbot"},
    )
    ps_id = r.json()["id"]
    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Team A"})
    team_a_id = r.json()["id"]
    r = participant_client.post(
        "/api/submissions",
        data={"team_id": team_a_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/owner/repo"},
    )
    sub_a_id = r.json()["id"]

    r = auth_client.post(f"/api/evaluate/tech/{sub_a_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["total_score"] > 0
    assert data["verdict"]
    score_a = data["total_score"]

    # second team with same raw score must get a discrete score
    r = client.post("/api/auth/register", json={"username": "bob", "email": "bob@example.com", "password": "Secret123!"})
    assert r.status_code == 201
    r = client.post("/api/auth/login", data={"username": "bob", "password": "Secret123!"})
    token = r.json()["access_token"]
    r = client.post(
        "/api/teams",
        json={"hackathon_id": hackathon_id, "name": "Team B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    team_b_id = r.json()["id"]
    r = client.post(
        "/api/submissions",
        data={"team_id": team_b_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/owner/repo2"},
        headers={"Authorization": f"Bearer {token}"},
    )
    sub_b_id = r.json()["id"]
    r = client.post(f"/api/evaluate/tech/{sub_b_id}", headers=auth_client.headers)
    assert r.status_code == 200
    score_b = r.json()["total_score"]
    assert score_b != score_a

    # Leaderboard should list both, sorted, with distinct scores
    r = auth_client.get(f"/api/leaderboard/{hackathon_id}")
    assert r.status_code == 200
    board = r.json()
    assert len(board) == 2
    assert board[0]["total_score"] >= board[1]["total_score"]
    assert board[0]["total_score"] != board[1]["total_score"]


def test_evaluate_non_tech(auth_client, participant_client, fake_llm):
    r = auth_client.post("/api/hackathons", json={"name": "Doc Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Reduce campus food waste", "description": "Design a mobile app that helps students reduce food waste in campus cafeterias."},
    )
    ps_id = r.json()["id"]
    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Doc Team"})
    team_id = r.json()["id"]

    document = (
        "Our project solves the problem by building a mobile application that helps students track and reduce food waste in campus cafeterias. "
        "We researched the market by interviewing twenty students and three cafeteria managers to identify the biggest pain points. "
        "The main issues are over-portioning, lack of awareness about leftovers, and no feedback channel to kitchen staff. "
        "Our solution is a gamified app where students log their plate waste, receive personalized tips, and earn rewards for improvement. "
        "The cafeteria dashboard gives managers real-time data to adjust portion sizes and menu planning. "
        "We validated the concept with a clickable prototype and five user testing sessions. "
        "The implementation plan uses React Native for the frontend, a Python backend, and a PostgreSQL database. "
        "We have a realistic budget, a twelve-week timeline, and a clear rollout plan across campus. "
        "This approach is original because it combines behavioral nudges with operational analytics in one integrated platform. "
        "We are confident this solution can significantly reduce food waste and save money for the university."
    )
    r = participant_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "non_tech"},
        files={"submission_file": ("report.txt", document.encode(), "text/plain")},
    )
    sub_id = r.json()["id"]

    r = auth_client.post(f"/api/evaluate/non-tech/{sub_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["total_score"] > 0
    assert data["verdict"]

    # printable per-team report should be reachable for organisers/admins
    r = auth_client.get(f"/api/reports/submission/{sub_id}")
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["team_name"] == "Doc Team"
    assert report["problem_statement_title"] == "Reduce campus food waste"
    assert report["evaluation"]["total_score"] == data["total_score"]

    # PDF report should be downloadable and return a valid PDF byte stream
    r = auth_client.get(f"/api/reports/submission/{sub_id}/pdf")
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type") == "application/pdf"
    assert len(r.content) > 0
    assert r.content[:4] == b"%PDF"
