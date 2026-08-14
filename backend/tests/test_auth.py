def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_and_login(client):
    r = client.post("/api/auth/register", json={
        "username": "alice",
        "email": "alice@example.com",
        "password": "secret123"
    })
    assert r.status_code == 201
    data = r.json()
    assert data["username"] == "alice"

    r = client.post("/api/auth/login", data={
        "username": "alice",
        "password": "secret123"
    })
    assert r.status_code == 200
    token = r.json()["access_token"]
    assert token

    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "alice@example.com"


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "username": "alice",
        "email": "alice@example.com",
        "password": "secret123"
    })
    r = client.post("/api/auth/login", data={"username": "alice", "password": "wrong"})
    assert r.status_code == 400
