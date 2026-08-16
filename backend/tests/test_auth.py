def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_and_login(client):
    r = client.post("/api/auth/register", json={
        "username": "alice",
        "email": "alice@example.com",
        "password": "Secret123!"
    })
    assert r.status_code == 201
    data = r.json()
    assert data["username"] == "alice"

    r = client.post("/api/auth/login", data={
        "username": "alice",
        "password": "Secret123!"
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
        "password": "Secret123!"
    })
    r = client.post("/api/auth/login", data={"username": "alice", "password": "wrong"})
    assert r.status_code == 400


def test_register_organizer_role(client):
    r = client.post("/api/auth/register", json={
        "username": "org1",
        "email": "org1@example.com",
        "password": "Secret123!",
        "role": "organizer"
    })
    assert r.status_code == 201
    assert r.json()["role"] == "organizer"


def test_register_admin_blocked(client):
    r = client.post("/api/auth/register", json={
        "username": "hacker",
        "email": "hacker@example.com",
        "password": "Secret123!",
        "role": "admin"
    })
    assert r.status_code == 422


def test_register_superadmin_blocked(client):
    r = client.post("/api/auth/register", json={
        "username": "superhacker",
        "email": "superhacker@example.com",
        "password": "Secret123!",
        "role": "superadmin"
    })
    assert r.status_code == 422


def test_superadmin_can_access_stats(superadmin_client):
    r = superadmin_client.get("/api/auth/admin/stats")
    assert r.status_code == 200
    data = r.json()
    assert "users" in data
    assert "hackathons" in data


def test_admin_cannot_access_stats(admin_client):
    r = admin_client.get("/api/auth/admin/stats")
    assert r.status_code == 403


def test_superadmin_can_create_admin(superadmin_client):
    r = superadmin_client.post("/api/auth/admin/users", json={
        "username": "newadmin",
        "email": "newadmin@example.com",
        "password": "Secret123!",
        "role": "admin"
    })
    assert r.status_code == 201
    assert r.json()["role"] == "admin"


def test_admin_cannot_create_superadmin(admin_client):
    r = admin_client.post("/api/auth/admin/users", json={
        "username": "attemptedsuper",
        "email": "attemptedsuper@example.com",
        "password": "Secret123!",
        "role": "superadmin"
    })
    assert r.status_code == 403


def test_admin_cannot_promote_user_to_superadmin(admin_client, db):
    # create a participant user via regular registration
    r = admin_client.post("/api/auth/register", json={
        "username": "promoteme",
        "email": "promoteme@example.com",
        "password": "Secret123!"
    })
    assert r.status_code == 201
    user_id = r.json()["id"]
    r = admin_client.put(f"/api/auth/users/{user_id}/role", json={"role": "superadmin"})
    assert r.status_code == 403


def test_superadmin_can_manage_admin_role(superadmin_client, admin_client, db):
    # admin_client is an admin user; superadmin demotes them to organizer
    r = superadmin_client.get("/api/auth/me")
    super_id = r.json()["id"]
    r = admin_client.get("/api/auth/me")
    admin_id = r.json()["id"]
    r = superadmin_client.put(f"/api/auth/users/{admin_id}/role", json={"role": "organizer"})
    assert r.status_code == 200
    assert r.json()["role"] == "organizer"
