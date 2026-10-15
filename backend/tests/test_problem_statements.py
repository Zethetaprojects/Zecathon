"""Editing/deleting problem statements and custom rubric validation."""

TECH_RUBRIC = {
    "Problem Understanding": 300,
    "Implementation": 400,
    "Presentation": 300,
}


def _hackathon_with_statement(client):
    hid = client.post("/api/hackathons", json={"name": "PS Hack"}).json()["id"]
    ps = client.post(
        f"/api/hackathons/{hid}/problem-statements",
        data={"title": "Original title", "description": "Original description"},
    ).json()
    return hid, ps


def test_problem_statement_reports_submission_count(auth_client):
    hid, ps = _hackathon_with_statement(auth_client)
    assert ps["submission_count"] == 0
    detail = auth_client.get(f"/api/hackathons/{hid}").json()
    assert detail["problem_statements"][0]["submission_count"] == 0


def test_organizer_can_edit_problem_statement_before_submissions(auth_client):
    _, ps = _hackathon_with_statement(auth_client)
    r = auth_client.put(
        f"/api/problem-statements/{ps['id']}",
        data={"title": "  New title  ", "description": "New description"},
        files={"file": ("brief.txt", b"Problem brief", "text/plain")},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"] == "New title"
    assert data["description"] == "New description"
    assert data["file_path"].startswith("/uploads/")

    r = auth_client.put(f"/api/problem-statements/{ps['id']}", data={"title": "New title", "remove_file": "true"})
    assert r.status_code == 200
    assert r.json()["file_path"] is None


def test_organizer_can_delete_problem_statement_before_submissions(auth_client):
    hid, ps = _hackathon_with_statement(auth_client)
    assert auth_client.delete(f"/api/problem-statements/{ps['id']}").status_code == 204
    assert auth_client.get(f"/api/hackathons/{hid}").json()["problem_statements"] == []


def test_problem_statement_locked_after_submission(auth_client, participant_client):
    hid, ps = _hackathon_with_statement(auth_client)
    team_id = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "T"}).json()["id"]
    r = participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps["id"], "type": "tech",
        "submission_url": "https://github.com/o/r",
    })
    assert r.status_code == 201, r.text

    r = auth_client.put(f"/api/problem-statements/{ps['id']}", data={"title": "Changed"})
    assert r.status_code == 409
    assert "submission" in r.json()["detail"]
    assert auth_client.delete(f"/api/problem-statements/{ps['id']}").status_code == 409
    assert auth_client.get(f"/api/problem-statements/{ps['id']}").json()["submission_count"] == 1


def test_participant_cannot_edit_or_delete_problem_statement(auth_client, participant_client):
    _, ps = _hackathon_with_statement(auth_client)
    assert participant_client.put(f"/api/problem-statements/{ps['id']}", data={"title": "x"}).status_code == 403
    assert participant_client.delete(f"/api/problem-statements/{ps['id']}").status_code == 403


def test_other_organizer_cannot_edit_problem_statement(auth_client, client):
    _, ps = _hackathon_with_statement(auth_client)
    client.post("/api/auth/register", json={
        "username": "otherorg", "email": "otherorg@example.com", "password": "Secret123!", "role": "organizer",
    })
    token = client.post("/api/auth/login", data={"username": "otherorg", "password": "Secret123!"}).json()["access_token"]
    r = client.put(f"/api/problem-statements/{ps['id']}", data={"title": "x"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_valid_custom_rubric_is_saved_and_can_be_reset(auth_client):
    hid = auth_client.post("/api/hackathons", json={"name": "Rubric Hack", "rubric": {"tech": TECH_RUBRIC}}).json()["id"]
    assert auth_client.get(f"/api/hackathons/{hid}").json()["rubric"] == {"tech": TECH_RUBRIC}

    r = auth_client.put(f"/api/hackathons/{hid}", json={"rubric": None})
    assert r.status_code == 200
    assert r.json()["rubric"] is None

    # Omitting rubric leaves it unchanged.
    auth_client.put(f"/api/hackathons/{hid}", json={"rubric": {"tech": TECH_RUBRIC}})
    auth_client.put(f"/api/hackathons/{hid}", json={"name": "Renamed"})
    assert auth_client.get(f"/api/hackathons/{hid}").json()["rubric"] == {"tech": TECH_RUBRIC}


def test_rubric_not_totalling_1000_is_rejected(auth_client):
    r = auth_client.post("/api/hackathons", json={"name": "Bad", "rubric": {"tech": {"A": 500, "B": 400}}})
    assert r.status_code == 422
    assert "1000" in r.text


def test_rubric_with_invalid_points_or_keys_is_rejected(auth_client):
    for rubric in (
        {"tech": {"A": 999.5, "B": 0.5}},
        {"tech": {"A": 1000, "B": 0}},
        {"tech": {}},
        {"design": {"A": 1000}},
    ):
        r = auth_client.post("/api/hackathons", json={"name": "Bad", "rubric": rubric})
        assert r.status_code == 422, rubric
