"""Tests for the production-hardening fixes: superadmin access, permission
matrix consistency, upload safety, rate limiting, and evaluation integrity."""
import pytest

from app.config import Settings
from app.models import GlobalSettings, Submission, SubmissionStatus, User, UserRole
from app.services.scoring import llm_client
from app.services.scoring import tech_evaluator as tech_mod
from app.services.scoring.llm_client import LLMUnavailableError, MOCK_REVIEW_FLAG


def _register(client, username, role=None, db=None):
    r = client.post("/api/auth/register", json={
        "username": username, "email": f"{username}@example.com", "password": "Secret123!",
    })
    assert r.status_code == 201, r.text
    if role:
        user = db.query(User).filter(User.username == username).first()
        user.role = role
        db.commit()
    r = client.post("/api/auth/login", data={"username": username, "password": "Secret123!"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _hackathon_with_team(owner_client, participant_client):
    hid = owner_client.post("/api/hackathons", json={"name": "H", "duration_hours": 24}).json()["id"]
    ps_id = owner_client.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "Build a thing"}).json()["id"]
    team_id = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "Team"}).json()["id"]
    return hid, ps_id, team_id


@pytest.fixture
def fake_repo(monkeypatch):
    monkeypatch.setattr(tech_mod, "summarize_repo", lambda url: {
        "valid": True, "owner": "o", "repo": "r",
        "files": ["README.md", "src/main.py", "tests/test.py", "docs/api.md"],
        "readme": "# Project\nThis solves the problem.", "snippets": {"src/main.py": "print(1)"},
        "total_commits": 10, "unique_commit_dates": ["2026-08-01", "2026-08-02", "2026-08-03"], "active_days": 3,
    })


def _llm_result(source):
    return {
        "total_score": 650, "category_scores": {"Test": 650}, "red_flags": [],
        "judge_questions": ["Q?"], "category_explanations": {"Test": "ok"}, "_source": source,
    }


# --- Superadmin access -------------------------------------------------------

def test_superadmin_can_manage_any_hackathon(superadmin_client, admin_client, participant_client):
    hid, ps_id, team_id = _hackathon_with_team(admin_client, participant_client)
    sa = superadmin_client
    assert sa.get(f"/api/hackathons/{hid}").status_code == 200
    assert sa.put(f"/api/hackathons/{hid}", json={"name": "Renamed"}).status_code == 200
    assert sa.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "Second"}).status_code == 201
    assert sa.get(f"/api/teams?hackathon_id={hid}").status_code == 200
    assert sa.get(f"/api/leaderboard/{hid}").status_code == 200
    assert sa.get(f"/api/reports/{hid}").status_code == 200
    assert any(r["id"] == hid for r in sa.get("/api/reports").json())
    r = sa.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    })
    assert r.status_code == 201, r.text
    assert sa.get(f"/api/submissions?team_id={team_id}").status_code == 200
    assert sa.delete(f"/api/teams/{team_id}").status_code == 204
    assert sa.delete(f"/api/hackathons/{hid}").status_code == 204


def test_superadmin_can_evaluate(superadmin_client, admin_client, participant_client, fake_repo, monkeypatch):
    monkeypatch.setattr(llm_client.LLMClient, "complete_json", lambda self, prompt, **kw: _llm_result("gemini"))
    hid, ps_id, team_id = _hackathon_with_team(admin_client, participant_client)
    sub_id = participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    }).json()["id"]
    r = superadmin_client.post(f"/api/evaluate/tech/{sub_id}")
    assert r.status_code == 200, r.text
    assert r.json()["llm_source"] == "gemini"


# --- Permission matrix ---------------------------------------------------------

def test_my_permissions_reflects_toggles(superadmin_client, participant_client, auth_client):
    perms = participant_client.get("/api/auth/me/permissions").json()
    assert perms["role"] == "participant"
    assert perms["permissions"]["create_team"] is True
    assert perms["permissions"]["create_hackathon"] is False

    settings = superadmin_client.get("/api/auth/admin/settings").json()
    settings["role_permissions"]["participant"]["create_team"] = False
    r = superadmin_client.put("/api/auth/admin/settings", json={"role_permissions": settings["role_permissions"]})
    assert r.status_code == 200, r.text

    assert participant_client.get("/api/auth/me/permissions").json()["permissions"]["create_team"] is False
    hid = auth_client.post("/api/hackathons", json={"name": "H"}).json()["id"]
    r = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "T"})
    assert r.status_code == 403


def test_superadmin_cannot_be_locked_out(superadmin_client):
    settings = superadmin_client.get("/api/auth/admin/settings").json()
    settings["role_permissions"]["superadmin"] = {k: False for k in settings["role_permissions"]["superadmin"]}
    r = superadmin_client.put("/api/auth/admin/settings", json={"role_permissions": settings["role_permissions"]})
    assert all(r.json()["role_permissions"]["superadmin"].values())


def test_stored_settings_missing_new_features_use_defaults(db, participant_client):
    # Simulate a database created before `delete_team` existed and with the removed `manage_settings` key.
    db.query(GlobalSettings).delete()
    db.add(GlobalSettings(registration_open=True, role_permissions={
        "participant": {"create_team": True, "manage_settings": True},
    }))
    db.commit()
    perms = participant_client.get("/api/auth/me/permissions").json()["permissions"]
    assert perms["delete_team"] is False
    assert perms["view_leaderboard"] is True
    assert "manage_settings" not in perms


def test_delete_team_uses_its_own_permission(auth_client, participant_client):
    hid, _, team_id = _hackathon_with_team(auth_client, participant_client)
    assert participant_client.delete(f"/api/teams/{team_id}").status_code == 403
    assert auth_client.delete(f"/api/teams/{team_id}").status_code == 204


def test_judge_can_view_reports_participant_cannot(client, db, auth_client, participant_client):
    hid, _, _ = _hackathon_with_team(auth_client, participant_client)
    judge = _register(client, "judgy", UserRole.judge, db)
    assert client.get(f"/api/reports/{hid}", headers=judge).status_code == 200
    assert participant_client.get(f"/api/reports/{hid}").status_code == 403


def test_judge_cannot_be_added_to_team(client, db, auth_client, participant_client):
    _register(client, "judge2", UserRole.judge, db)
    hid, _, team_id = _hackathon_with_team(auth_client, participant_client)
    r = participant_client.post(f"/api/teams/{team_id}/members", json={"username": "judge2"})
    assert r.status_code == 403


def test_admin_cannot_reset_superadmin_password(admin_client, superadmin_client):
    sa_id = superadmin_client.get("/api/auth/me").json()["id"]
    r = admin_client.put(f"/api/auth/admin/users/{sa_id}/password", json={"password": "Hijack123!"})
    assert r.status_code == 403


def test_inactive_user_cannot_log_in(client, db):
    _register(client, "sleepy")
    user = db.query(User).filter(User.username == "sleepy").first()
    user.is_active = False
    db.commit()
    r = client.post("/api/auth/login", data={"username": "sleepy", "password": "Secret123!"})
    assert r.status_code == 403


def test_hackathon_limits_can_be_cleared(auth_client):
    hid = auth_client.post("/api/hackathons", json={"name": "H", "max_participants": 10}).json()["id"]
    r = auth_client.put(f"/api/hackathons/{hid}", json={"max_participants": None})
    assert r.status_code == 200
    assert r.json()["max_participants"] is None


# --- Uploads and rate limiting ------------------------------------------------

def test_svg_upload_rejected(auth_client):
    hid = auth_client.post("/api/hackathons", json={"name": "H"}).json()["id"]
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    r = auth_client.post(f"/api/hackathons/{hid}/banner", files={"file": ("x.svg", svg, "image/svg+xml")})
    assert r.status_code == 400


def test_uploads_served_with_safe_headers(auth_client):
    hid = auth_client.post("/api/hackathons", json={"name": "H"}).json()["id"]
    r = auth_client.post(f"/api/hackathons/{hid}/banner", files={"file": ("b.png", b"\x89PNG\r\n\x1a\n", "image/png")})
    path = r.json()["banner_path"]
    r = auth_client.get(path)
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "script-src 'none'" in r.headers["content-security-policy"]


def test_forwarded_for_spoofing_does_not_bypass_login_limit(client):
    for i in range(10):
        client.post("/api/auth/login", data={"username": "x", "password": "y"},
                    headers={"X-Forwarded-For": f"10.0.0.{i}"})
    r = client.post("/api/auth/login", data={"username": "x", "password": "y"},
                    headers={"X-Forwarded-For": "10.0.0.99"})
    assert r.status_code == 429


def test_rate_limit_is_per_real_ip(client):
    for _ in range(10):
        client.post("/api/auth/login", data={"username": "x", "password": "y"}, headers={"X-Real-IP": "1.1.1.1"})
    r = client.post("/api/auth/login", data={"username": "x", "password": "y"}, headers={"X-Real-IP": "2.2.2.2"})
    assert r.status_code == 400  # wrong password, but not rate limited


# --- Evaluation integrity -----------------------------------------------------

def test_mock_scores_are_flagged(auth_client, participant_client, fake_repo, monkeypatch):
    monkeypatch.setattr(llm_client.LLMClient, "complete_json", lambda self, prompt, **kw: _llm_result("mock"))
    hid, ps_id, team_id = _hackathon_with_team(auth_client, participant_client)
    sub_id = participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    }).json()["id"]
    data = auth_client.post(f"/api/evaluate/tech/{sub_id}").json()
    assert data["llm_source"] == "mock"
    assert data["needs_review"] is True
    assert MOCK_REVIEW_FLAG in data["review_flags"]


def test_llm_outage_returns_503_and_stores_nothing(db, auth_client, participant_client, fake_repo, monkeypatch):
    def _down(self, prompt, **kw):
        raise LLMUnavailableError("Gemini returned HTTP 429")
    monkeypatch.setattr(llm_client.LLMClient, "complete_json", _down)
    hid, ps_id, team_id = _hackathon_with_team(auth_client, participant_client)
    sub_id = participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    }).json()["id"]
    r = auth_client.post(f"/api/evaluate/tech/{sub_id}")
    assert r.status_code == 503
    sub = db.query(Submission).filter(Submission.id == sub_id).one()
    assert sub.evaluation is None
    assert sub.status == SubmissionStatus.pending


def test_failed_retry_keeps_previous_evaluation(db, auth_client, participant_client, fake_repo, monkeypatch):
    monkeypatch.setattr(llm_client.LLMClient, "complete_json", lambda self, prompt, **kw: _llm_result("gemini"))
    hid, ps_id, team_id = _hackathon_with_team(auth_client, participant_client)
    sub_id = participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    }).json()["id"]
    first = auth_client.post(f"/api/evaluate/tech/{sub_id}").json()

    def _down(self, prompt, **kw):
        raise LLMUnavailableError("Gemini returned HTTP 429")
    monkeypatch.setattr(llm_client.LLMClient, "complete_json", _down)
    assert auth_client.post(f"/api/evaluate/tech/{sub_id}/retry").status_code == 503

    report = auth_client.get(f"/api/reports/submission/{sub_id}").json()
    assert report["evaluation"]["id"] == first["id"]
    assert report["evaluation"]["total_score"] == first["total_score"]


def test_llm_client_refuses_mock_in_production(monkeypatch):
    monkeypatch.setattr(llm_client, "settings", Settings(_env_file=None, environment="production", secret_key="x" * 40,
                                                          database_url="postgresql://u:p@h/d"))
    with pytest.raises(LLMUnavailableError):
        llm_client.LLMClient().complete_json("prompt")


def test_llm_client_uses_mock_in_development(monkeypatch):
    monkeypatch.setattr(llm_client, "settings", Settings(_env_file=None))
    assert llm_client.LLMClient().complete_json("prompt")["_source"] == "mock"


# --- Production startup checks ------------------------------------------------

@pytest.mark.parametrize("secret,db_url", [
    ("change-me-in-production", "postgresql://u:p@h/d"),
    ("", "postgresql://u:p@h/d"),
    ("short", "postgresql://u:p@h/d"),
    ("x" * 40, "sqlite:///./x.db"),
])
def test_production_refuses_unsafe_config(secret, db_url):
    s = Settings(_env_file=None, environment="production", secret_key=secret, database_url=db_url)
    with pytest.raises(RuntimeError):
        s.validate_production()


def test_production_accepts_safe_config():
    Settings(_env_file=None, environment="production", secret_key="x" * 40,
             database_url="postgresql://u:p@h/d").validate_production()


# --- Gemini client: new auth keys ("AQ."), model fallback, error reporting ----

class _FakeResponse:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body

    def json(self):
        return self._body


def _gemini_ok(text='{"total_score": 600, "category_scores": {}, "judge_questions": ["Q?"]}'):
    return _FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": text}]}}]})


def _use_gemini_key(monkeypatch, key="AQ.Ab8RN6-test_key.value"):
    monkeypatch.setattr(llm_client, "settings", Settings(_env_file=None, gemini_api_key=key))
    return key


def test_gemini_auth_key_sent_in_header_not_url(monkeypatch):
    key = _use_gemini_key(monkeypatch)
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append((url, headers))
        return _gemini_ok()

    monkeypatch.setattr(llm_client.requests, "post", fake_post)
    result = llm_client.LLMClient().complete_json("prompt")
    assert result["_source"] == "gemini"
    url, headers = calls[0]
    assert headers["x-goog-api-key"] == key
    assert "Authorization" not in headers
    assert "key=" not in url and key not in url


def test_gemini_falls_back_only_on_404(monkeypatch):
    _use_gemini_key(monkeypatch)
    tried = []

    def fake_post(url, headers=None, json=None, timeout=None):
        tried.append(url.split("/models/")[1].split(":")[0])
        return _FakeResponse(404, {}) if len(tried) == 1 else _gemini_ok()

    monkeypatch.setattr(llm_client.requests, "post", fake_post)
    client = llm_client.LLMClient()
    client.complete_json("prompt")
    assert tried == ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"]
    assert client.last_model == "gemini-flash-lite-latest"


def test_gemini_bad_key_error_is_readable_and_hides_key(monkeypatch):
    key = _use_gemini_key(monkeypatch)
    tried = []

    def fake_post(url, headers=None, json=None, timeout=None):
        tried.append(url)
        return _FakeResponse(400, {"error": {"code": 400, "message": "API key not valid. Please pass a valid API key."}})

    monkeypatch.setattr(llm_client.requests, "post", fake_post)
    with pytest.raises(LLMUnavailableError) as info:
        llm_client.LLMClient().complete_json("prompt")
    message = str(info.value)
    assert "API key not valid" in message
    assert "AQ." in message  # tells the admin what a current key looks like
    assert key not in message
    assert len(tried) == 1  # auth errors are not retried on other models


def test_gemini_model_list_has_no_deprecated_models():
    models = llm_client.LLMClient()._gemini_models()
    assert "gemini-3.5-flash" not in models
    assert "gemini-3.7-flash" not in models


def test_join_code_only_visible_to_members_and_managers(client, db, auth_client, participant_client):
    hid = auth_client.post("/api/hackathons", json={"name": "Codes"}).json()["id"]
    team = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "Secret Team"}).json()
    assert team["join_code"]  # the creator (a member) sees it

    outsider = _register(client, "outsider", None, db)
    listed = client.get(f"/api/teams?hackathon_id={hid}", headers=outsider).json()
    assert listed[0]["join_code"] is None
    assert client.get(f"/api/teams/{team['id']}", headers=outsider).json()["join_code"] is None
    detail = client.get(f"/api/hackathons/{hid}", headers=outsider).json()
    assert detail["teams"][0]["join_code"] is None

    assert auth_client.get(f"/api/teams?hackathon_id={hid}").json()[0]["join_code"] == team["join_code"]
    assert participant_client.get(f"/api/hackathons/{hid}").json()["teams"][0]["join_code"] == team["join_code"]


def test_many_users_behind_one_ip_can_log_in(client):
    # A campus Wi-Fi puts many students behind one IP; each must still be able to log in.
    for i in range(15):
        r = client.post("/api/auth/login", data={"username": f"student{i}", "password": "wrong"})
        assert r.status_code == 400, (i, r.status_code)


def test_one_account_is_still_limited(client):
    for _ in range(10):
        client.post("/api/auth/login", data={"username": "victim", "password": "guess"})
    r = client.post("/api/auth/login", data={"username": "victim", "password": "guess"})
    assert r.status_code == 429


def test_many_registrations_from_one_ip(client):
    for i in range(8):
        r = client.post("/api/auth/register", json={
            "username": f"campus{i}", "email": f"campus{i}@example.com", "password": "Secret123!",
        })
        assert r.status_code == 201, (i, r.text)
