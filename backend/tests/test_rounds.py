"""Multiple rounds: shortlists, round submissions, judges' marks and round leaderboards."""
from datetime import datetime, timedelta, timezone

import pytest

from app.models import UserRole
from app.services.scoring import llm_client
from tests.conftest import _make_authenticated_client


def _iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat()


@pytest.fixture
def fake_llm(monkeypatch):
    def _complete(self, prompt, temperature=0.2, categories=None, **kwargs):
        return {"total_score": 600, "category_scores": {"Test": 600}, "red_flags": [], "_source": "gemini"}
    monkeypatch.setattr(llm_client.LLMClient, "complete_json", _complete)


@pytest.fixture
def second_participant(db):
    return _make_authenticated_client(db, "participant2", "participant2@example.com")


@pytest.fixture
def judge_client(db):
    return _make_authenticated_client(db, "judge1", "judge1@example.com", UserRole.judge)


def _setup(owner, *participants):
    hid = owner.post("/api/hackathons", json={
        "name": "Round Hack", "start_date": _iso(datetime.utcnow() - timedelta(hours=1)), "duration_hours": 48,
    }).json()["id"]
    ps_id = owner.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "PS"}).json()["id"]
    team_ids = [
        p.post("/api/teams", json={"hackathon_id": hid, "name": f"Team {i}"}).json()["id"]
        for i, p in enumerate(participants, 1)
    ]
    return hid, ps_id, team_ids


def _submit(client, team_id, ps_id, round_number=None, url="https://github.com/o/r"):
    data = {"team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": url}
    if round_number:
        data["round_number"] = round_number
    return client.post("/api/submissions", data=data)


def test_single_round_hackathon_lists_round_one(auth_client, participant_client):
    hid, ps_id, (team_id,) = _setup(auth_client, participant_client)
    rounds = participant_client.get(f"/api/hackathons/{hid}/rounds").json()
    assert [r["number"] for r in rounds] == [1]
    assert rounds[0]["name"] == "Round 1" and rounds[0]["published"] is True
    r = _submit(participant_client, team_id, ps_id)
    assert r.status_code == 201 and r.json()["round_number"] == 1


def test_shortlisted_team_submits_to_round_two_after_publish(auth_client, participant_client, second_participant):
    hid, ps_id, (t1, t2) = _setup(auth_client, participant_client, second_participant)
    assert _submit(participant_client, t1, ps_id).status_code == 201

    r = auth_client.post(f"/api/hackathons/{hid}/rounds", json={
        "name": "Finals", "instructions": "Upload your pitch deck",
        "submission_deadline": _iso(datetime.utcnow() + timedelta(days=1)), "judge_weight": 50,
    })
    assert r.status_code == 201, r.text
    assert r.json()["number"] == 2 and r.json()["published"] is False

    # Publishing needs a shortlist.
    assert auth_client.put(f"/api/hackathons/{hid}/rounds/2", json={"published": True}).status_code == 400
    r = auth_client.put(f"/api/hackathons/{hid}/rounds/2/shortlist", json={"team_ids": [t1]})
    assert r.status_code == 200 and r.json()["shortlisted_team_ids"] == [t1]

    # Not open to participants until published, and the shortlist stays hidden.
    assert _submit(participant_client, t1, ps_id, 2).status_code == 403
    hidden = participant_client.get(f"/api/hackathons/{hid}/rounds").json()[1]
    assert hidden["shortlisted_team_ids"] is None

    assert auth_client.put(f"/api/hackathons/{hid}/rounds/2", json={"published": True}).status_code == 200
    shown = participant_client.get(f"/api/hackathons/{hid}/rounds").json()[1]
    assert shown["shortlisted_team_ids"] == [t1] and shown["name"] == "Finals"
    status = participant_client.get(f"/api/hackathons/{hid}/rounds/my-status").json()
    assert status["rounds"] == [{"number": 2, "name": "Finals", "shortlisted": True}]

    r = _submit(participant_client, t1, ps_id, 2)
    assert r.status_code == 201 and r.json()["round_number"] == 2
    # One submission per statement per round.
    assert _submit(participant_client, t1, ps_id, 2).status_code == 400
    # A team that did not advance is refused.
    r = _submit(second_participant, t2, ps_id, 2)
    assert r.status_code == 403 and "not shortlisted" in r.json()["detail"]
    # A round that does not exist.
    assert _submit(participant_client, t1, ps_id, 3).status_code == 404


def test_round_deadline_applies(auth_client, participant_client):
    hid, ps_id, (t1,) = _setup(auth_client, participant_client)
    auth_client.post(f"/api/hackathons/{hid}/rounds", json={"submission_deadline": _iso(datetime.utcnow() - timedelta(minutes=1))})
    auth_client.put(f"/api/hackathons/{hid}/rounds/2/shortlist", json={"team_ids": [t1]})
    auth_client.put(f"/api/hackathons/{hid}/rounds/2", json={"published": True})
    r = _submit(participant_client, t1, ps_id, 2)
    assert r.status_code == 403 and "closed" in r.json()["detail"]
    # Organisers can still submit on the team's behalf.
    assert _submit(auth_client, t1, ps_id, 2).status_code == 201


def test_shortlist_and_round_removal_guards(auth_client, participant_client, second_participant):
    hid, ps_id, (t1, t2) = _setup(auth_client, participant_client, second_participant)
    other_hid = auth_client.post("/api/hackathons", json={"name": "Other"}).json()["id"]
    auth_client.post(f"/api/hackathons/{hid}/rounds", json={})
    auth_client.post(f"/api/hackathons/{hid}/rounds", json={})

    assert auth_client.put(f"/api/hackathons/{hid}/rounds/1/shortlist", json={"team_ids": [t1]}).status_code == 400
    assert auth_client.put(f"/api/hackathons/{other_hid}/rounds/2/shortlist", json={"team_ids": [t1]}).status_code == 404
    assert participant_client.put(f"/api/hackathons/{hid}/rounds/2/shortlist", json={"team_ids": [t1]}).status_code == 403

    auth_client.put(f"/api/hackathons/{hid}/rounds/2/shortlist", json={"team_ids": [t1, t2]})
    auth_client.put(f"/api/hackathons/{hid}/rounds/2", json={"published": True})
    assert _submit(participant_client, t1, ps_id, 2).status_code == 201
    # A team that already submitted to the round cannot be dropped from it.
    r = auth_client.put(f"/api/hackathons/{hid}/rounds/2/shortlist", json={"team_ids": [t2]})
    assert r.status_code == 400 and "Team 1" in r.json()["detail"]

    # Only the last round can be removed, and only before anyone submits to it.
    assert auth_client.delete(f"/api/hackathons/{hid}/rounds/2").status_code == 400
    assert auth_client.delete(f"/api/hackathons/{hid}/rounds/1").status_code == 400
    assert auth_client.delete(f"/api/hackathons/{hid}/rounds/3").status_code == 204
    assert [r["number"] for r in auth_client.get(f"/api/hackathons/{hid}/rounds").json()] == [1, 2]
    assert auth_client.delete(f"/api/hackathons/{hid}/rounds/2").status_code == 400


def test_round_one_can_be_renamed_and_weighted(auth_client):
    hid, _, _ = _setup(auth_client)
    r = auth_client.put(f"/api/hackathons/{hid}/rounds/1", json={"name": "Online round", "judge_weight": 30})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Online round" and r.json()["judge_weight"] == 30
    assert auth_client.put(f"/api/hackathons/{hid}/rounds/1", json={"judge_weight": 120}).status_code == 422


def test_judge_marks_blend_into_round_leaderboard(auth_client, participant_client, second_participant, judge_client, fake_llm, monkeypatch):
    from app.services.scoring import tech_evaluator
    monkeypatch.setattr(tech_evaluator, "summarize_repo", lambda url: {
        "valid": True, "owner": "o", "repo": "r", "files": ["README.md", "main.py"], "readme": "x",
        "snippets": {}, "total_commits": 5, "unique_commit_dates": ["2026-01-01"], "active_days": 1,
    })
    hid, ps_id, (t1, t2) = _setup(auth_client, participant_client, second_participant)
    s1 = _submit(participant_client, t1, ps_id).json()["id"]
    s2 = _submit(second_participant, t2, ps_id).json()["id"]
    for sid in (s1, s2):
        assert auth_client.post(f"/api/evaluate/tech/{sid}").status_code == 200

    board = auth_client.get(f"/api/leaderboard/{hid}").json()
    assert {e["submission_id"] for e in board} == {s1, s2}
    ai = {e["submission_id"]: e["ai_score"] for e in board}

    # Round 2 is judged only by the panel.
    auth_client.post(f"/api/hackathons/{hid}/rounds", json={"name": "Finals", "judge_weight": 100})
    auth_client.put(f"/api/hackathons/{hid}/rounds/2/shortlist", json={"team_ids": [t1, t2]})
    auth_client.put(f"/api/hackathons/{hid}/rounds/2", json={"published": True})
    f1 = _submit(participant_client, t1, ps_id, 2, "https://github.com/o/final1").json()["id"]
    f2 = _submit(second_participant, t2, ps_id, 2, "https://github.com/o/final2").json()["id"]

    assert participant_client.put(f"/api/submissions/{f1}/judge-score", json={"score": 900}).status_code == 403
    assert judge_client.put(f"/api/submissions/{f1}/judge-score", json={"score": 1001}).status_code == 422
    assert judge_client.put(f"/api/submissions/{f1}/judge-score", json={"score": 700, "comment": "Solid demo"}).status_code == 200
    assert judge_client.put(f"/api/submissions/{f1}/judge-score", json={"score": 800}).status_code == 200  # replaces
    assert auth_client.put(f"/api/submissions/{f1}/judge-score", json={"score": 900}).status_code == 200
    assert judge_client.put(f"/api/submissions/{f2}/judge-score", json={"score": 950}).status_code == 200

    marks = auth_client.get(f"/api/submissions/{f1}/judge-scores").json()
    assert sorted(m["score"] for m in marks) == [800, 900]
    assert {m["judge_username"] for m in marks} == {"judge1", "testuser"}
    # Organisers see the marks in the submissions list; the team does not.
    staff = auth_client.get(f"/api/submissions/hackathon/{hid}").json()
    assert len(next(s for s in staff if s["id"] == f1)["judge_scores"]) == 2
    assert "judge_scores" not in participant_client.get(f"/api/submissions/{f1}").json()

    # The latest scored round is shown by default.
    final = auth_client.get(f"/api/leaderboard/{hid}").json()
    assert [e["submission_id"] for e in final] == [f2, f1]
    assert final[1]["total_score"] == 850 and final[1]["judge_count"] == 2 and final[1]["ai_score"] is None
    assert all(e["round_number"] == 2 for e in final)
    # Round 1 is still available.
    first = auth_client.get(f"/api/leaderboard/{hid}?round=1").json()
    assert {e["submission_id"] for e in first} == {s1, s2}

    # Round 1 blended 50/50 with one judge mark.
    auth_client.put(f"/api/hackathons/{hid}/rounds/1", json={"judge_weight": 50})
    judge_client.put(f"/api/submissions/{s1}/judge-score", json={"score": 1000})
    first = {e["submission_id"]: e for e in auth_client.get(f"/api/leaderboard/{hid}?round=1").json()}
    assert first[s1]["total_score"] == round(ai[s1] * 0.5 + 1000 * 0.5)
    assert first[s2]["awaiting_judges"] is True and first[s2]["total_score"] == ai[s2]

    # Teams and the public see nothing until the organiser publishes the results.
    for url in (f"/api/leaderboard/public/{hid}", f"/api/leaderboard/{hid}", f"/api/leaderboard/{hid}?round=1"):
        assert participant_client.get(url).json() == []
    assert participant_client.get(f"/api/submissions/{s1}").json()["evaluation"] is None
    assert auth_client.get(f"/api/submissions/{s1}").json()["evaluation"] is not None
    assert len(judge_client.get(f"/api/leaderboard/{hid}?round=1").json()) == 2

    r = auth_client.put(f"/api/hackathons/{hid}/rounds/1", json={"results_published": True})
    assert r.status_code == 200 and r.json()["results_published"] is True
    assert participant_client.put(f"/api/hackathons/{hid}/rounds/1", json={"results_published": False}).status_code == 403
    # Round 1 results are out; round 2 results are still private.
    assert {e["round_number"] for e in participant_client.get(f"/api/leaderboard/public/{hid}").json()} == {1}
    assert participant_client.get(f"/api/leaderboard/public/{hid}?round=2").json() == []
    assert participant_client.get(f"/api/submissions/{s1}").json()["evaluation"] is not None

    auth_client.put(f"/api/hackathons/{hid}/rounds/2", json={"results_published": True})
    assert len(participant_client.get(f"/api/leaderboard/{hid}").json()) == 2  # latest published round
    # Unpublishing hides them again.
    auth_client.put(f"/api/hackathons/{hid}/rounds/2", json={"results_published": False})
    assert participant_client.get(f"/api/leaderboard/public/{hid}?round=2").json() == []

    # Deleting the hackathon removes rounds, shortlists and marks with it.
    assert auth_client.delete(f"/api/hackathons/{hid}").status_code == 204


def test_judge_mark_can_be_withdrawn(auth_client, participant_client, judge_client):
    hid, ps_id, (t1,) = _setup(auth_client, participant_client)
    sid = _submit(participant_client, t1, ps_id).json()["id"]
    assert judge_client.delete(f"/api/submissions/{sid}/judge-score").status_code == 404
    judge_client.put(f"/api/submissions/{sid}/judge-score", json={"score": 500})
    assert judge_client.delete(f"/api/submissions/{sid}/judge-score").status_code == 204
    assert auth_client.get(f"/api/submissions/{sid}/judge-scores").json() == []
