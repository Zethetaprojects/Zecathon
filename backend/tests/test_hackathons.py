from datetime import datetime


def test_create_and_list_hackathon(auth_client):
    r = auth_client.post(
        "/api/hackathons",
        json={
            "name": "HealthHack 2026",
            "description": "Build health tech solutions",
            "start_date": datetime(2026, 9, 1).isoformat(),
            "end_date": datetime(2026, 9, 3).isoformat(),
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "HealthHack 2026"

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
