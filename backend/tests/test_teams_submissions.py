def test_create_team_and_submit(auth_client, client):
    # create hackathon
    r = auth_client.post("/api/hackathons", json={"name": "AI Hack", "description": "AI solutions"})
    assert r.status_code == 201
    hackathon_id = r.json()["id"]

    # upload problem statement
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Build a chatbot", "description": "..."},
        files={"file": ("ps.txt", b"Build a chatbot", "text/plain")},
    )
    assert r.status_code == 201
    ps_id = r.json()["id"]

    # create team
    r = auth_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Neural Ninjas"})
    assert r.status_code == 201
    team = r.json()
    assert team["name"] == "Neural Ninjas"
    assert team["members"][0]["role"] == "leader"
    team_id = team["id"]

    # list teams
    r = auth_client.get("/api/teams", params={"hackathon_id": hackathon_id})
    assert r.status_code == 200
    assert len(r.json()) == 1

    # tech submission
    r = auth_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/example/repo"},
    )
    assert r.status_code == 201
    sub = r.json()
    assert sub["type"] == "tech"
    assert sub["submission_url"] == "https://github.com/example/repo"

    # non-tech submission should fail because duplicate exists
    r = auth_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "non_tech"},
        files={"submission_file": ("doc.pdf", b"PDF", "application/pdf")},
    )
    assert r.status_code == 400


def test_join_team(auth_client, client):
    r = auth_client.post("/api/hackathons", json={"name": "Join Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Open Team"})
    team_id = r.json()["id"]

    # register another user
    r = client.post("/api/auth/register", json={"username": "bob", "email": "bob@example.com", "password": "secret123"})
    assert r.status_code == 201
    r = client.post("/api/auth/login", data={"username": "bob", "password": "secret123"})
    token = r.json()["access_token"]

    r = client.post(f"/api/teams/{team_id}/join", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert len(r.json()["members"]) == 2


def test_non_tech_submission(auth_client):
    r = auth_client.post("/api/hackathons", json={"name": "Doc Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Write a report"},
    )
    ps_id = r.json()["id"]
    r = auth_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Doc Squad"})
    team_id = r.json()["id"]

    r = auth_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "non_tech"},
        files={
            "submission_file": ("report.pdf", b"PDF", "application/pdf"),
            "ppt_file": ("slides.pptx", b"PPTX", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
        },
    )
    assert r.status_code == 201
    sub = r.json()
    assert sub["type"] == "non_tech"
    assert sub["submission_url"]
    assert sub["ppt_url"]
