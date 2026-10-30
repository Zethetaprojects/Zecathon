"""Resolving review flags, GitHub-only repository links, and letting a team resubmit."""
import pytest

from app.models import UserRole
from app.services.scoring import llm_client
from app.services.scoring import tech_evaluator
from tests.conftest import _make_authenticated_client


@pytest.fixture
def judge_client(db):
    return _make_authenticated_client(db, "judge9", "judge9@example.com", UserRole.judge)


@pytest.fixture
def scored(monkeypatch):
    def _complete(self, prompt, temperature=0.2, categories=None, **kwargs):
        # Low score, so the evaluation is flagged for review.
        return {"total_score": 300, "category_scores": {"Test": 300}, "red_flags": ["Thin README"], "_source": "gemini"}
    monkeypatch.setattr(llm_client.LLMClient, "complete_json", _complete)
    monkeypatch.setattr(tech_evaluator, "summarize_repo", lambda url: {
        "valid": True, "owner": "o", "repo": "r", "files": ["README.md"], "readme": "x",
        "snippets": {}, "total_commits": 3, "unique_commit_dates": ["2026-01-01"], "active_days": 1,
    })


def _setup(owner, participant):
    hid = owner.post("/api/hackathons", json={"name": "Review Hack"}).json()["id"]
    ps_id = owner.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "PS"}).json()["id"]
    team_id = participant.post("/api/teams", json={"hackathon_id": hid, "name": "Reviewed"}).json()["id"]
    return hid, ps_id, team_id


def _tech(client, team_id, ps_id, url):
    return client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": url,
    })


def test_resolving_a_review_clears_the_flag_and_stays_internal(auth_client, participant_client, judge_client, scored):
    hid, ps_id, team_id = _setup(auth_client, participant_client)
    sid = _tech(participant_client, team_id, ps_id, "https://github.com/o/r").json()["id"]
    ev = auth_client.post(f"/api/evaluate/tech/{sid}").json()
    assert ev["needs_review"] is True

    assert participant_client.put(f"/api/submissions/{sid}/review", json={"note": "fine"}).status_code == 403
    assert judge_client.put(f"/api/submissions/{sid}/review", json={"note": "  "}).status_code == 422
    r = judge_client.put(f"/api/submissions/{sid}/review", json={"note": "Checked the repo; the low score is fair."})
    assert r.status_code == 200, r.text
    assert r.json()["needs_review"] is False and r.json()["reviewed_by"] == "judge9"

    entry = auth_client.get(f"/api/reports/{hid}").json()["team_entries"][0]
    assert entry["needs_review"] is False and entry["review_note"].startswith("Checked the repo")
    pdf = auth_client.get(f"/api/reports/submission/{sid}/pdf")
    assert pdf.status_code == 200

    # The team never sees the note, even after results are published.
    auth_client.put(f"/api/hackathons/{hid}/rounds/1", json={"results_published": True})
    team_view = participant_client.get(f"/api/submissions/{sid}").json()["evaluation"]
    assert team_view["total_score"] == ev["total_score"] and team_view["review_note"] is None

    # Reopening puts the flag back.
    r = auth_client.delete(f"/api/submissions/{sid}/review")
    assert r.json()["needs_review"] is True and r.json()["review_note"] is None


def test_review_needs_an_evaluation(auth_client, participant_client):
    _, ps_id, team_id = _setup(auth_client, participant_client)
    sid = _tech(participant_client, team_id, ps_id, "https://github.com/o/r").json()["id"]
    assert auth_client.put(f"/api/submissions/{sid}/review", json={"note": "looked"}).status_code == 400


@pytest.mark.parametrize("url", [
    "https://drive.google.com/drive/folders/abc123",
    "https://docs.google.com/document/d/xyz",
    "https://github.com/onlyowner",
    "not a link",
])
def test_only_github_repositories_are_accepted(auth_client, participant_client, url):
    _, ps_id, team_id = _setup(auth_client, participant_client)
    r = _tech(participant_client, team_id, ps_id, url)
    assert r.status_code == 400 and "GitHub" in r.json()["detail"]
    r = participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "non_tech", "github_url": url,
    }, files={"submission_file": ("report.txt", b"Our report " * 50, "text/plain")})
    assert r.status_code == 400 and "Supporting GitHub link" in r.json()["detail"]


def test_github_links_are_normalised(auth_client, participant_client):
    _, ps_id, team_id = _setup(auth_client, participant_client)
    r = _tech(participant_client, team_id, ps_id, "github.com/Team/Project.git/tree/main?tab=readme")
    assert r.status_code == 201, r.text
    assert r.json()["submission_url"] == "https://github.com/Team/Project"


def test_organiser_can_let_a_team_resubmit(auth_client, participant_client, judge_client):
    _, ps_id, team_id = _setup(auth_client, participant_client)
    sid = _tech(participant_client, team_id, ps_id, "https://github.com/o/first").json()["id"]
    assert _tech(participant_client, team_id, ps_id, "https://github.com/o/second").status_code == 400
    assert participant_client.delete(f"/api/submissions/{sid}").status_code == 403
    assert judge_client.delete(f"/api/submissions/{sid}").status_code == 403
    assert auth_client.delete(f"/api/submissions/{sid}").status_code == 204
    r = _tech(participant_client, team_id, ps_id, "https://github.com/o/second")
    assert r.status_code == 201
