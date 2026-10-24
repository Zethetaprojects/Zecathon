"""Submission deadlines and UTC timestamp handling."""
from datetime import datetime, timedelta, timezone


def _iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat()


def _setup(owner, participant, deadline: datetime, start: datetime | None = None):
    start = start or deadline - timedelta(days=1)
    hid = owner.post("/api/hackathons", json={
        "name": "Deadline Hack", "start_date": _iso(start), "duration_hours": 48,
        "submission_deadline": _iso(deadline),
    }).json()["id"]
    ps_id = owner.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "PS"}).json()["id"]
    team_id = participant.post("/api/teams", json={"hackathon_id": hid, "name": "T"}).json()["id"]
    return hid, ps_id, team_id


def _submit(client, team_id, ps_id):
    return client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech",
        "submission_url": "https://github.com/o/r",
    })


def test_participant_can_submit_before_deadline(auth_client, participant_client):
    _, ps_id, team_id = _setup(auth_client, participant_client, datetime.utcnow() + timedelta(hours=2))
    assert _submit(participant_client, team_id, ps_id).status_code == 201


def test_participant_cannot_submit_after_deadline(auth_client, participant_client):
    _, ps_id, team_id = _setup(auth_client, participant_client, datetime.utcnow() - timedelta(minutes=5))
    r = _submit(participant_client, team_id, ps_id)
    assert r.status_code == 403
    assert "closed" in r.json()["detail"]


def test_organiser_can_still_submit_after_deadline(auth_client, participant_client):
    _, ps_id, team_id = _setup(auth_client, participant_client, datetime.utcnow() - timedelta(minutes=5))
    assert _submit(auth_client, team_id, ps_id).status_code == 201


def test_deadline_must_be_after_start(auth_client):
    start = datetime.utcnow() + timedelta(days=2)
    r = auth_client.post("/api/hackathons", json={
        "name": "Bad", "start_date": _iso(start), "duration_hours": 24,
        "submission_deadline": _iso(start - timedelta(hours=1)),
    })
    assert r.status_code == 400


def test_deadline_can_be_changed_and_cleared(auth_client, participant_client):
    hid, ps_id, team_id = _setup(auth_client, participant_client, datetime.utcnow() - timedelta(minutes=5))
    assert _submit(participant_client, team_id, ps_id).status_code == 403
    r = auth_client.put(f"/api/hackathons/{hid}", json={"submission_deadline": None})
    assert r.status_code == 200
    assert r.json()["submission_deadline"] is None
    assert _submit(participant_client, team_id, ps_id).status_code == 201


def test_timestamps_are_utc_with_z_and_offsets_are_converted(auth_client):
    # 10:00 in India (+05:30) is 04:30 UTC.
    hid = auth_client.post("/api/hackathons", json={
        "name": "TZ", "start_date": "2026-11-20T10:00:00+05:30", "duration_hours": 2,
        "submission_deadline": "2026-11-20T11:30:00+05:30",
    }).json()["id"]
    data = auth_client.get(f"/api/hackathons/{hid}").json()
    assert data["start_date"] == "2026-11-20T04:30:00Z"
    assert data["end_date"] == "2026-11-20T06:30:00Z"
    assert data["submission_deadline"] == "2026-11-20T06:00:00Z"
    assert data["created_at"].endswith("Z")
