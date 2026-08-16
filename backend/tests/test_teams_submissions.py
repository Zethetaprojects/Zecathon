def test_create_team_and_submit(auth_client, participant_client, client):
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

    # create team as participant
    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Neural Ninjas"})
    assert r.status_code == 201
    team = r.json()
    assert team["name"] == "Neural Ninjas"
    assert team["members"][0]["role"] == "leader"
    assert team["join_code"] and len(team["join_code"]) == 8
    team_id = team["id"]

    # list teams
    r = participant_client.get("/api/teams", params={"hackathon_id": hackathon_id})
    assert r.status_code == 200
    assert len(r.json()) == 1

    # tech submission
    r = participant_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/example/repo"},
    )
    assert r.status_code == 201
    sub = r.json()
    assert sub["type"] == "tech"
    assert sub["submission_url"] == "https://github.com/example/repo"

    # non-tech submission should fail because duplicate exists
    r = participant_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "non_tech"},
        files={"submission_file": ("doc.pdf", b"PDF", "application/pdf")},
    )
    assert r.status_code == 400

    # organiser/admin can also create teams and submit on behalf of a team
    r = auth_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Organiser Team"})
    assert r.status_code == 201
    organiser_team_id = r.json()["id"]

    r = auth_client.post(
        "/api/submissions",
        data={"team_id": organiser_team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/example/admin-repo"},
    )
    assert r.status_code == 201
    assert r.json()["type"] == "tech"


def test_join_team_by_code(auth_client, participant_client, client):
    r = auth_client.post("/api/hackathons", json={"name": "Join Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Build a chatbot", "description": "..."},
    )
    assert r.status_code == 201
    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Open Team"})
    join_code = r.json()["join_code"]
    team_id = r.json()["id"]
    assert join_code

    # register another user
    r = client.post("/api/auth/register", json={"username": "bob", "email": "bob@example.com", "password": "Secret123!"})
    assert r.status_code == 201
    r = client.post("/api/auth/login", data={"username": "bob", "password": "Secret123!"})
    token = r.json()["access_token"]

    r = client.post("/api/teams/join-by-code", json={"code": join_code}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    assert len(r.json()["members"]) == 2
    assert r.json()["id"] == team_id


def test_add_team_member(auth_client, participant_client, client):
    r = auth_client.post("/api/hackathons", json={"name": "Add Member Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Build a chatbot"},
    )
    assert r.status_code == 201

    # participant creates a team and is the leader
    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Leader Team"})
    team_id = r.json()["id"]

    # register a new user to add
    r = client.post("/api/auth/register", json={"username": "carol", "email": "carol@example.com", "password": "Secret123!"})
    assert r.status_code == 201

    r = participant_client.post(f"/api/teams/{team_id}/members", json={"username": "carol"})
    assert r.status_code == 200, r.text
    members = r.json()["members"]
    assert len(members) == 2
    assert any(m["username"] == "carol" and m["role"] == "member" for m in members)


def test_non_tech_submission(auth_client, participant_client):
    r = auth_client.post("/api/hackathons", json={"name": "Doc Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Write a report"},
    )
    ps_id = r.json()["id"]
    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Doc Squad"})
    team_id = r.json()["id"]

    r = participant_client.post(
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


def test_delete_team_and_hackathon(auth_client, participant_client):
    r = auth_client.post("/api/hackathons", json={"name": "Delete Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Problem"},
    )
    ps_id = r.json()["id"]
    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Deletables"})
    team_id = r.json()["id"]
    r = participant_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/example/repo"},
    )
    assert r.status_code == 201

    # delete team
    r = auth_client.delete(f"/api/teams/{team_id}")
    assert r.status_code == 204

    r = participant_client.get("/api/teams", params={"hackathon_id": hackathon_id})
    assert r.status_code == 200
    assert len(r.json()) == 0

    # delete hackathon
    r = auth_client.delete(f"/api/hackathons/{hackathon_id}")
    assert r.status_code == 204
    r = auth_client.get(f"/api/hackathons/{hackathon_id}")
    assert r.status_code == 404


def test_other_organizer_cannot_access_teams_or_submissions(auth_client, client, admin_client):
    r = auth_client.post("/api/hackathons", json={"name": "Scoped Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Problem"},
    )
    ps_id = r.json()["id"]

    # create a team as the owner
    r = auth_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Scoped Team"})
    team_id = r.json()["id"]
    r = auth_client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/example/repo"},
    )
    assert r.status_code == 201
    sub_id = r.json()["id"]

    # another organizer cannot list teams, view submissions, or submit on behalf of the team
    r = client.post("/api/auth/register", json={"username": "scopedother", "email": "scopedother@example.com", "password": "Secret123!", "role": "organizer"})
    assert r.status_code == 201
    r = client.post("/api/auth/login", data={"username": "scopedother", "password": "Secret123!"})
    other_token = r.json()["access_token"]

    r = client.get("/api/teams", params={"hackathon_id": hackathon_id}, headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403

    r = client.get(f"/api/teams/{team_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403

    r = client.get(f"/api/submissions/{sub_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403

    r = client.post(
        "/api/submissions",
        data={"team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/example/other-repo"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert r.status_code == 403

    # admin can access the hackathon and its submissions
    r = admin_client.get("/api/teams", params={"hackathon_id": hackathon_id})
    assert r.status_code == 200
    r = admin_client.get(f"/api/submissions/{sub_id}")
    assert r.status_code == 200


def test_manage_team_members_and_change_leader(auth_client, participant_client, client):
    r = auth_client.post("/api/hackathons", json={"name": "Member Mgmt Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Problem"},
    )
    assert r.status_code == 201

    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Leaders"})
    assert r.status_code == 201
    team = r.json()
    team_id = team["id"]
    original_leader_member_id = team["members"][0]["id"]

    # add a new member
    r = client.post("/api/auth/register", json={"username": "bob", "email": "bob@example.com", "password": "Secret123!"})
    assert r.status_code == 201
    r = auth_client.post(f"/api/teams/{team_id}/members", json={"username": "bob"})
    assert r.status_code == 200
    team = r.json()
    bob_member = next(m for m in team["members"] if m["username"] == "bob")
    assert bob_member["role"] == "member"

    # promote bob to leader (original leader becomes member)
    r = auth_client.patch(f"/api/teams/{team_id}/members/{bob_member['id']}", json={"role": "leader"})
    assert r.status_code == 200
    team = r.json()
    assert any(m["username"] == "bob" and m["role"] == "leader" for m in team["members"])
    assert any(m["id"] == original_leader_member_id and m["role"] == "member" for m in team["members"])

    # remove the original leader (now a member)
    r = auth_client.delete(f"/api/teams/{team_id}/members/{original_leader_member_id}")
    assert r.status_code == 200
    team = r.json()
    assert not any(m["id"] == original_leader_member_id for m in team["members"])

    # cannot demote the only leader
    r = auth_client.patch(f"/api/teams/{team_id}/members/{bob_member['id']}", json={"role": "member"})
    assert r.status_code == 400


def test_team_leader_can_change_leader_and_remove_member(auth_client, participant_client, client):
    r = auth_client.post("/api/hackathons", json={"name": "Leader Mgmt Hack", "description": "x"})
    hackathon_id = r.json()["id"]
    r = auth_client.post(f"/api/hackathons/{hackathon_id}/problem-statements", data={"title": "Problem"})
    assert r.status_code == 201

    r = participant_client.post("/api/teams", json={"hackathon_id": hackathon_id, "name": "Squad"})
    team = r.json()
    team_id = team["id"]

    r = client.post("/api/auth/register", json={"username": "carol", "email": "carol@example.com", "password": "Secret123!"})
    assert r.status_code == 201
    r = participant_client.post(f"/api/teams/{team_id}/members", json={"username": "carol"})
    assert r.status_code == 200
    carol_member_id = next(m["id"] for m in r.json()["members"] if m["username"] == "carol")

    # team leader removes the member
    r = participant_client.delete(f"/api/teams/{team_id}/members/{carol_member_id}")
    assert r.status_code == 200
    team = r.json()
    assert not any(m["username"] == "carol" for m in team["members"])
