"""Problem statements stay hidden, and submissions closed, until the hackathon starts."""
from datetime import datetime, timedelta, timezone

from app.models import UserRole


def _iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat()


def _setup(owner, participant, start: datetime):
    hid = owner.post("/api/hackathons", json={"name": "Gate", "start_date": _iso(start), "duration_hours": 24}).json()["id"]
    ps_id = owner.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "Secret PS", "description": "Top secret"}).json()["id"]
    team_id = participant.post("/api/teams", json={"hackathon_id": hid, "name": "Early Birds"}).json()["id"]
    return hid, ps_id, team_id


def _judge_headers(client, db):
    client.post("/api/auth/register", json={"username": "judgey", "email": "judgey@example.com", "password": "Secret123!"})
    from app.models import User
    user = db.query(User).filter(User.username == "judgey").first()
    user.role = UserRole.judge
    db.commit()
    token = client.post("/api/auth/login", data={"username": "judgey", "password": "Secret123!"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _submit(client, team_id, ps_id):
    return client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    })


def test_participants_cannot_see_statements_before_start(auth_client, participant_client, client, db):
    hid, ps_id, _ = _setup(auth_client, participant_client, datetime.utcnow() + timedelta(hours=3))

    detail = participant_client.get(f"/api/hackathons/{hid}").json()
    assert detail["problem_statements"] == []
    assert detail["problem_statements_hidden"] is True
    assert detail["problem_statement_count"] == 1
    assert participant_client.get(f"/api/problem-statements/{ps_id}").status_code == 403
    # The list still shows how many statements there are.
    listed = [h for h in participant_client.get("/api/hackathons").json() if h["id"] == hid][0]
    assert listed["problem_statement_count"] == 1

    # Organisers and judges can prepare in advance.
    assert len(auth_client.get(f"/api/hackathons/{hid}").json()["problem_statements"]) == 1
    judge = _judge_headers(client, db)
    assert len(client.get(f"/api/hackathons/{hid}", headers=judge).json()["problem_statements"]) == 1


def test_statements_visible_once_started(auth_client, participant_client):
    hid, ps_id, _ = _setup(auth_client, participant_client, datetime.utcnow() - timedelta(minutes=1))
    detail = participant_client.get(f"/api/hackathons/{hid}").json()
    assert [p["title"] for p in detail["problem_statements"]] == ["Secret PS"]
    assert detail["problem_statements_hidden"] is False
    assert participant_client.get(f"/api/problem-statements/{ps_id}").status_code == 200


def test_participants_cannot_submit_before_start(auth_client, participant_client):
    _, ps_id, team_id = _setup(auth_client, participant_client, datetime.utcnow() + timedelta(hours=3))
    r = _submit(participant_client, team_id, ps_id)
    assert r.status_code == 403
    assert "starts" in r.json()["detail"]


def test_organiser_can_submit_before_start_for_a_dry_run(auth_client, participant_client):
    _, ps_id, team_id = _setup(auth_client, participant_client, datetime.utcnow() + timedelta(hours=3))
    assert _submit(auth_client, team_id, ps_id).status_code == 201


def test_participants_can_submit_after_start(auth_client, participant_client):
    _, ps_id, team_id = _setup(auth_client, participant_client, datetime.utcnow() - timedelta(minutes=1))
    assert _submit(participant_client, team_id, ps_id).status_code == 201
