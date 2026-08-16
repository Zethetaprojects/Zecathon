from datetime import datetime, timedelta


def test_create_and_list_hackathon(auth_client):
    start = datetime(2026, 9, 1, 9, 0, 0)
    r = auth_client.post(
        "/api/hackathons",
        json={
            "name": "HealthHack 2026",
            "description": "Build health tech solutions",
            "start_date": start.isoformat(),
            "duration_hours": 48,
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["name"] == "HealthHack 2026"
    assert data["duration_hours"] == 48
    expected_end = start + timedelta(hours=48)
    assert data["end_date"] is not None
    assert datetime.fromisoformat(data["end_date"]).replace(tzinfo=None) == expected_end

    r = auth_client.get("/api/hackathons")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_upload_problem_statement(auth_client):
    r = auth_client.post(
        "/api/hackathons",
        json={"name": "EcoHack", "description": "Sustainability"},
    )
    hackathon_id = r.json()["id"]

    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/problem-statements",
        data={"title": "Reduce plastic waste", "description": "..."},
        files={"file": ("ps.txt", b"This is the problem statement text", "text/plain")},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Reduce plastic waste"
    assert data["file_path"]

    r = auth_client.get(f"/api/hackathons/{hackathon_id}")
    assert r.status_code == 200
    assert len(r.json()["problem_statements"]) == 1


def test_upload_hackathon_banner(auth_client):
    r = auth_client.post("/api/hackathons", json={"name": "Banner Hack", "description": "x"})
    hackathon_id = r.json()["id"]

    r = auth_client.post(
        f"/api/hackathons/{hackathon_id}/banner",
        files={"file": ("banner.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["banner_path"] and "/uploads/" in data["banner_path"]


def test_public_hackathons_and_stats(client, auth_client):
    r = auth_client.post(
        "/api/hackathons",
        json={"name": "Public Hack", "description": "public", "duration_hours": 24},
    )
    assert r.status_code == 201

    r = client.get("/api/hackathons/public")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert any(h["name"] == "Public Hack" for h in data)
    assert "banner_path" in data[0]
    assert "team_count" in data[0]

    r = client.get("/api/hackathons/public/stats")
    assert r.status_code == 200
    stats = r.json()
    assert stats["total_hackathons"] >= 1
    assert "total_teams" in stats


def test_organizer_scope_and_admin_access(auth_client, client, admin_client):
    # auth_client creates a hackathon
    r = auth_client.post("/api/hackathons", json={"name": "Owned Hack", "description": "x"})
    assert r.status_code == 201
    owned_id = r.json()["id"]

    # create another organizer
    r = client.post("/api/auth/register", json={"username": "otherorg", "email": "other@example.com", "password": "Secret123!", "role": "organizer"})
    assert r.status_code == 201
    r = client.post("/api/auth/login", data={"username": "otherorg", "password": "Secret123!"})
    assert r.status_code == 200
    other_token = r.json()["access_token"]

    # other organizer cannot see the hackathon in list or get
    r = client.get("/api/hackathons", headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 200
    assert all(h["id"] != owned_id for h in r.json())

    r = client.get(f"/api/hackathons/{owned_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403

    # admin can see all hackathons
    r = admin_client.get("/api/hackathons")
    assert r.status_code == 200
    assert any(h["id"] == owned_id for h in r.json())

    r = admin_client.get(f"/api/hackathons/{owned_id}")
    assert r.status_code == 200


def test_organizer_cannot_manage_other_hackathon(auth_client, client):
    r = auth_client.post("/api/hackathons", json={"name": "Owned Hack 2", "description": "x"})
    owned_id = r.json()["id"]

    r = client.post("/api/auth/register", json={"username": "otherorg2", "email": "other2@example.com", "password": "Secret123!", "role": "organizer"})
    assert r.status_code == 201
    r = client.post("/api/auth/login", data={"username": "otherorg2", "password": "Secret123!"})
    other_token = r.json()["access_token"]

    # other organizer cannot update or delete
    r = client.put(f"/api/hackathons/{owned_id}", json={"name": "Stolen"}, headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403

    r = client.delete(f"/api/hackathons/{owned_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403
