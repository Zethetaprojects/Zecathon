"""GitHub client failure handling and the bulk submissions endpoint."""
import pytest

from app.services import github_client as gh
from app.services.github_client import GitHubUnavailableError
from app.services.scoring import tech_evaluator as tech_mod


class _Resp:
    def __init__(self, status, body=None, headers=None, text=""):
        self.status_code = status
        self._body = body if body is not None else {}
        self.headers = headers or {}
        self.text = text

    def json(self):
        return self._body


def _router(routes):
    """Fake requests.get: match the first route whose key is contained in the URL."""
    calls = []

    def fake_get(url, headers=None, params=None, timeout=None):
        calls.append(url)
        for key, resp in routes:
            if key in url:
                return resp
        return _Resp(404)

    return fake_get, calls


def test_rate_limit_raises_instead_of_scoring_zero(monkeypatch):
    fake, _ = _router([("/repos/o/r", _Resp(403, headers={"x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000"},
                                            text="API rate limit exceeded"))])
    monkeypatch.setattr(gh.requests, "get", fake)
    with pytest.raises(GitHubUnavailableError, match="rate limit"):
        gh.summarize_repo("https://github.com/o/r")


def test_missing_or_private_repo_is_reported_clearly(monkeypatch):
    fake, _ = _router([])
    monkeypatch.setattr(gh.requests, "get", fake)
    result = gh.summarize_repo("https://github.com/o/r")
    assert result["valid"] is False
    assert "REPOSITORY_NOT_FOUND" in result["error"]


def test_uses_default_branch_and_canonical_name_after_transfer(monkeypatch):
    meta = {"default_branch": "develop", "name": "r2", "owner": {"login": "ZethetaIntern"}}
    tree = {"tree": [{"type": "blob", "path": "src/model.py"}, {"type": "blob", "path": "README.md"}]}
    file_body = {"content": "cHJpbnQoMSk="}  # print(1)
    fake, calls = _router([
        ("/repos/o/r", _Resp(200, meta)),
        ("/git/trees/develop", _Resp(200, tree)),
        ("/readme", _Resp(200, {"content": "IyBSZWFkbWU="})),
        ("/commits", _Resp(200, [{"commit": {"committer": {"date": "2026-10-23T10:00:00Z"}}}])),
        ("/contents/src/model.py", _Resp(200, file_body)),
    ])
    monkeypatch.setattr(gh.requests, "get", fake)
    result = gh.summarize_repo("https://github.com/o/r.git")
    assert result["valid"] is True
    assert result["default_branch"] == "develop"
    assert result["snippets"]["src/model.py"] == "print(1)"
    assert any("/repos/ZethetaIntern/r2/git/trees/develop" in c for c in calls)


def test_github_outage_returns_503_and_stores_nothing(auth_client, participant_client, monkeypatch):
    def _down(url):
        raise GitHubUnavailableError("GitHub API rate limit reached.")
    monkeypatch.setattr(tech_mod, "summarize_repo", _down)
    hid = auth_client.post("/api/hackathons", json={"name": "GH"}).json()["id"]
    ps_id = auth_client.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "PS"}).json()["id"]
    team_id = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "T"}).json()["id"]
    sub_id = participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    }).json()["id"]
    r = auth_client.post(f"/api/evaluate/tech/{sub_id}")
    assert r.status_code == 503
    assert "GitHub" in r.json()["detail"]
    assert auth_client.get(f"/api/submissions/hackathon/{hid}").json()[0]["evaluation"] is None


def test_bulk_submissions_endpoint_permissions(auth_client, participant_client):
    hid = auth_client.post("/api/hackathons", json={"name": "Bulk"}).json()["id"]
    ps_id = auth_client.post(f"/api/hackathons/{hid}/problem-statements", data={"title": "PS"}).json()["id"]
    team_id = participant_client.post("/api/teams", json={"hackathon_id": hid, "name": "T"}).json()["id"]
    participant_client.post("/api/submissions", data={
        "team_id": team_id, "problem_statement_id": ps_id, "type": "tech", "submission_url": "https://github.com/o/r",
    })
    r = auth_client.get(f"/api/submissions/hackathon/{hid}")
    assert r.status_code == 200
    assert len(r.json()) == 1 and "evaluation" in r.json()[0]
    assert participant_client.get(f"/api/submissions/hackathon/{hid}").status_code == 403
