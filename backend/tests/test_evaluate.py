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
        "overall_assessment": "A clear plan with validated demand.",
        "key_strengths": ["Interviews with real users", "  "],
        "areas_for_improvement": ["Quantify the savings ₹ per term"],
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
    # the scorer's written feedback is kept for the report (blank items dropped)
    assert report["evaluation"]["overall_assessment"] == "A clear plan with validated demand."
    assert report["evaluation"]["key_strengths"] == ["Interviews with real users"]
    assert report["evaluation"]["areas_for_improvement"] == ["Quantify the savings ₹ per term"]

    # PDF report should be downloadable and return a valid PDF byte stream
    r = auth_client.get(f"/api/reports/submission/{sub_id}/pdf")
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type") == "application/pdf"
    assert len(r.content) > 0
    assert r.content[:4] == b"%PDF"
    assert len(r.content) > 5000  # a laid-out report, not an empty page



def test_other_organizer_cannot_evaluate(auth_client, client, participant_client, fake_repo, fake_llm):
    r = auth_client.post("/api/hackathons", json={"name": "Eval Scope Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Build a chatbot"},
    )
    ps_id = r.json()["id"]
    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Eval Team"})
    team_id = r.json()["id"]
    r = participant_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/owner/repo"},
    )
    sub_id = r.json()["id"]

    # another organizer cannot evaluate
    r = client.post("/api/auth/register", json={"username": "evalother", "email": "evalother@example.com", "password": "Secret123!", "role": "organizer"})
    assert r.status_code == 201
    r = client.post("/api/auth/login", data={"username": "evalother", "password": "Secret123!"})
    other_token = r.json()["access_token"]

    r = client.post(f"/api/evaluate/tech/{sub_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403


def test_concurrent_evaluation_returns_saved_score(auth_client, participant_client, monkeypatch):
    """Two bulk runs scoring the same submission at once: the slower one gets the saved score, not a 500."""
    from app.models import Evaluation
    from app.routers import evaluate as evaluate_router

    hid = auth_client.post("/api/hackathons", json={"name": "Race Hack"}).json()["id"]
    ps_id = auth_client.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "PS"}).json()["id"]
    team_id = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "Racers"}).json()["id"]
    sub_id = participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    }).json()["id"]

    def _racing_evaluator(db, submission, problem_text):
        fields = dict(percentage=70.0, verdict="EXCELLENT", raw_score=700, multiplier=1.0,
                      authenticity_band="HIGH_HUMAN_INPUT", category_scores={}, review_flags=[], llm_source="gemini")
        # The other run saves first...
        db.add(Evaluation(submission_id=submission.id, total_score=700, **fields))
        db.commit()
        # ...then this run tries to save its own score for the same submission.
        db.add(Evaluation(submission_id=submission.id, total_score=555, **fields))
        db.commit()

    monkeypatch.setattr(evaluate_router, "evaluate_tech", _racing_evaluator)
    r = auth_client.post(f"/api/evaluate/tech/{sub_id}")
    assert r.status_code == 200, r.text
    assert r.json()["total_score"] == 700


def test_reports_sorted_by_score_with_problem_statement_pdf(auth_client, participant_client, client, fake_repo, fake_llm):
    hid = auth_client.post("/api/hackathons", json={"name": "Sorted Hack"}).json()["id"]
    ps = auth_client.post(f"/api/hackathons/{hid}/problem-statements", data={
        "title": "Detect fraud in UPI payments",
        "description": "Build a model that flags fraudulent UPI transactions — with ₹ amounts and explainable alerts.",
    }).json()

    def make_team(c, name, url):
        team_id = c.post("/api/teams", json={"hackathon_id": hid, "name": name}).json()["id"]
        return c.post("/api/submissions", data={
            "team_id": team_id, "problem_statement_id": ps["id"], "type": "tech", "submission_url": url,
        }).json()["id"]

    first = make_team(participant_client, "Alpha", "https://github.com/o/a")
    for username in ("bravo_user", "charlie_user"):
        client.post("/api/auth/register", json={"username": username, "email": f"{username}@example.com", "password": "Secret123!"})
    other = []
    for username, team in (("bravo_user", "Bravo"), ("charlie_user", "Charlie")):
        token = client.post("/api/auth/login", data={"username": username, "password": "Secret123!"}).json()["access_token"]
        client.headers["Authorization"] = f"Bearer {token}"
        other.append(make_team(client, team, f"https://github.com/o/{team.lower()}"))
    for sid in (first, other[0]):
        assert auth_client.post(f"/api/evaluate/tech/{sid}").status_code == 200

    entries = auth_client.get(f"/api/reports/{hid}").json()["team_entries"]
    scores = [e["total_score"] for e in entries]
    assert scores[-1] is None  # the unscored team comes last
    assert scores[:-1] == sorted(scores[:-1], reverse=True)

    # The team report carries the statement text, and its PDF includes it.
    report = auth_client.get(f"/api/reports/submission/{first}").json()
    assert report["problem_statement_description"].startswith("Build a model")
    r = auth_client.get(f"/api/reports/problem-statement/{ps['id']}/pdf")
    assert r.status_code == 200 and r.content[:4] == b"%PDF"
    assert "attachment" in r.headers["content-disposition"]
    # Participants cannot read reports.
    assert participant_client.get(f"/api/reports/problem-statement/{ps['id']}/pdf").status_code == 403
    assert auth_client.get("/api/reports/problem-statement/999999/pdf").status_code == 404
