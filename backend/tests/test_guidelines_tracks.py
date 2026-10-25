"""Submission guidelines, one problem statement per team, and per-statement rubrics."""
import json

from app.models import Hackathon, ProblemStatement, SubmissionType
from app.services.scoring import llm_client
from app.services.scoring import tech_evaluator as tech_mod
from app.services.scoring.constants import TECH_CATEGORIES, get_rubric

PS_RUBRIC = {"tech": {"Forecast accuracy": 500, "Calibration": 300, "Decision layer": 200}}
HACK_RUBRIC = {"tech": {"Overall": 1000}}


def _hackathon(client, **extra):
    return client.post("/api/hackathons", json={"name": "Quant Hack", **extra}).json()["id"]


def _statement(client, hid, title, rubric=None):
    data = {"title": title}
    if rubric is not None:
        data["rubric"] = json.dumps(rubric)
    return client.post(f"/api/hackathons/{hid}/problem-statements", data=data)


def _submit(client, team_id, ps_id):
    return client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    })


# --- guidelines ----------------------------------------------------------------

def test_guidelines_are_saved_shown_and_cleared(auth_client, participant_client):
    hid = _hackathon(auth_client, submission_guidelines="  Upload a PDF report.\nCite every source.  ")
    assert participant_client.get(f"/api/hackathons/{hid}").json()["submission_guidelines"] == "Upload a PDF report.\nCite every source."
    r = auth_client.put(f"/api/hackathons/{hid}", json={"submission_guidelines": None})
    assert r.json()["submission_guidelines"] is None


def test_guidelines_length_is_limited(auth_client):
    r = auth_client.post("/api/hackathons", json={"name": "x", "submission_guidelines": "a" * 10001})
    assert r.status_code == 422


# --- one problem statement per team --------------------------------------------

def test_one_statement_per_team_blocks_a_second_track(auth_client, participant_client):
    hid = _hackathon(auth_client, one_statement_per_team=True)
    ps1 = _statement(auth_client, hid, "PS1 Equity").json()["id"]
    ps2 = _statement(auth_client, hid, "PS2 Risk").json()["id"]
    team_id = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "T"}).json()["id"]
    assert _submit(participant_client, team_id, ps1).status_code == 201
    r = _submit(participant_client, team_id, ps2)
    assert r.status_code == 400
    assert "PS1 Equity" in r.json()["detail"]


def test_multiple_tracks_allowed_when_rule_is_off(auth_client, participant_client):
    hid = _hackathon(auth_client)
    assert auth_client.get(f"/api/hackathons/{hid}").json()["one_statement_per_team"] in (False, None)
    ps1 = _statement(auth_client, hid, "PS1").json()["id"]
    ps2 = _statement(auth_client, hid, "PS2").json()["id"]
    team_id = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "T"}).json()["id"]
    assert _submit(participant_client, team_id, ps1).status_code == 201
    assert _submit(participant_client, team_id, ps2).status_code == 201


def test_rule_can_be_toggled(auth_client):
    hid = _hackathon(auth_client)
    assert auth_client.put(f"/api/hackathons/{hid}", json={"one_statement_per_team": True}).json()["one_statement_per_team"] is True
    assert auth_client.put(f"/api/hackathons/{hid}", json={"one_statement_per_team": False}).json()["one_statement_per_team"] is False


# --- per-statement rubric ------------------------------------------------------

def test_statement_rubric_is_saved_validated_and_cleared(auth_client):
    hid = _hackathon(auth_client)
    r = _statement(auth_client, hid, "PS3", PS_RUBRIC)
    assert r.status_code == 201, r.text
    assert r.json()["rubric"] == PS_RUBRIC
    bad = _statement(auth_client, hid, "Bad", {"tech": {"A": 900}})
    assert bad.status_code == 400 and "1000" in bad.json()["detail"]
    r = auth_client.put(f"/api/problem-statements/{r.json()['id']}", data={"title": "PS3", "rubric": ""})
    assert r.status_code == 200 and r.json()["rubric"] is None


def test_rubric_precedence_statement_then_hackathon_then_default():
    hackathon = Hackathon(rubric=HACK_RUBRIC)
    statement = ProblemStatement(rubric=PS_RUBRIC)
    assert get_rubric(hackathon, SubmissionType.tech, statement) == PS_RUBRIC["tech"]
    assert get_rubric(hackathon, SubmissionType.tech, ProblemStatement(rubric=None)) == HACK_RUBRIC["tech"]
    assert get_rubric(Hackathon(rubric=None), SubmissionType.tech, ProblemStatement(rubric=None)) == TECH_CATEGORIES
    # A statement rubric that only covers non-tech falls back for tech submissions.
    assert get_rubric(hackathon, SubmissionType.tech, ProblemStatement(rubric={"non_tech": {"X": 1000}})) == HACK_RUBRIC["tech"]


def test_evaluation_scores_against_the_statement_rubric(auth_client, participant_client, monkeypatch):
    monkeypatch.setattr(tech_mod, "summarize_repo", lambda url: {
        "valid": True, "owner": "o", "repo": "r", "files": ["a.py", "b.py", "README.md"], "readme": "x",
        "snippets": {}, "total_commits": 5, "unique_commit_dates": ["2026-10-23"], "active_days": 1,
    })
    seen = {}

    def fake_llm(self, prompt, categories=None, **kw):
        seen["categories"] = categories
        return {"total_score": 600, "category_scores": {}, "judge_questions": ["Q?"], "_source": "gemini"}

    monkeypatch.setattr(llm_client.LLMClient, "complete_json", fake_llm)
    hid = _hackathon(auth_client, rubric=HACK_RUBRIC)
    ps_id = _statement(auth_client, hid, "PS3", PS_RUBRIC).json()["id"]
    team_id = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "T"}).json()["id"]
    sub_id = _submit(participant_client, team_id, ps_id).json()["id"]
    r = auth_client.post(f"/api/evaluate/tech/{sub_id}")
    assert r.status_code == 200, r.text
    assert seen["categories"] == PS_RUBRIC["tech"]
    assert r.json()["category_max_points"] == PS_RUBRIC["tech"]
