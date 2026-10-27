"""Partner hackathon URLs (/hackathons/{partner}/{n}) and public (no-login) hackathon pages."""
from datetime import datetime, timedelta, timezone


def _iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat()


def _create(client, **extra):
    r = client.post("/api/hackathons", json={"name": "Quant Hack", **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_partner_hackathons_are_numbered_per_partner(auth_client):
    a = _create(auth_client, partner_name="IIT Patna")
    b = _create(auth_client, partner_name="IIT Patna")
    c = _create(auth_client, partner_name="BITS Pilani", partner_website="https://www.bits-pilani.ac.in")
    plain = _create(auth_client)
    assert (a["partner_slug"], a["partner_number"]) == ("iit-patna", 1)
    assert (b["partner_slug"], b["partner_number"]) == ("iit-patna", 2)
    assert (c["partner_slug"], c["partner_number"]) == ("bits-pilani", 1)
    assert plain["partner_slug"] is None and plain["partner_number"] is None


def test_custom_and_invalid_partner_url_names(auth_client):
    custom = _create(auth_client, partner_name="Indian Institute of Technology Patna", partner_slug="IIT-Patna-Quant")
    assert custom["partner_slug"] == "iit-patna-quant"
    for bad in ("x", "has space", "new", "trailing-", "UPPER_case"):
        r = auth_client.post("/api/hackathons", json={"name": "Bad", "partner_name": "P", "partner_slug": bad})
        assert r.status_code == 422, bad
    r = auth_client.post("/api/hackathons", json={"name": "Bad", "partner_name": "P", "partner_website": "not-a-link"})
    assert r.status_code == 422


def test_public_pages_work_without_login(auth_client, client):
    h = _create(auth_client, partner_name="IIT Patna", submission_guidelines="Cite sources.",
                start_date=_iso(datetime.utcnow() - timedelta(hours=1)), duration_hours=24)
    auth_client.post(f"/api/hackathons/{h['id']}/problem-statements", data={"title": "PS1", "description": "Pick a stock"})

    by_partner = client.get("/api/hackathons/public/partner/iit-patna/1")
    assert by_partner.status_code == 200, by_partner.text
    data = by_partner.json()
    assert data["id"] == h["id"]
    assert data["partner_name"] == "IIT Patna"
    assert data["submission_guidelines"] == "Cite sources."
    assert [p["title"] for p in data["problem_statements"]] == ["PS1"]
    # Nothing private leaks into the public view.
    assert "teams" not in data and "rubric" not in data and "created_by" not in data

    assert client.get(f"/api/hackathons/public/{h['id']}").json()["id"] == h["id"]
    assert client.get("/api/hackathons/public/partner/iit-patna/99").status_code == 404
    # The authenticated endpoint still requires login.
    assert client.get(f"/api/hackathons/{h['id']}").status_code == 401


def test_public_page_hides_statements_before_start(auth_client, client):
    h = _create(auth_client, start_date=_iso(datetime.utcnow() + timedelta(hours=5)), duration_hours=24)
    auth_client.post(f"/api/hackathons/{h['id']}/problem-statements", data={"title": "Secret"})
    data = client.get(f"/api/hackathons/public/{h['id']}").json()
    assert data["problem_statements"] == []
    assert data["problem_statements_hidden"] is True
    assert data["problem_statement_count"] == 1


def test_changing_and_removing_the_partner(auth_client):
    h = _create(auth_client, partner_name="IIT Patna")
    _create(auth_client, partner_name="IIT Delhi")
    r = auth_client.put(f"/api/hackathons/{h['id']}", json={"partner_name": "IIT Delhi", "partner_slug": "iit-delhi"})
    assert (r.json()["partner_slug"], r.json()["partner_number"]) == ("iit-delhi", 2)
    # Editing other fields keeps the partner URL stable.
    r = auth_client.put(f"/api/hackathons/{h['id']}", json={"name": "Renamed"})
    assert (r.json()["partner_slug"], r.json()["partner_number"]) == ("iit-delhi", 2)
    r = auth_client.put(f"/api/hackathons/{h['id']}", json={"partner_name": None})
    assert r.json()["partner_name"] is None and r.json()["partner_slug"] is None and r.json()["partner_number"] is None


def test_partner_logo_upload(auth_client):
    plain = _create(auth_client)
    png = ("logo.png", b"\x89PNG\r\n\x1a\n", "image/png")
    assert auth_client.post(f"/api/hackathons/{plain['id']}/partner-logo", files={"file": png}).status_code == 400
    h = _create(auth_client, partner_name="IIT Patna")
    r = auth_client.post(f"/api/hackathons/{h['id']}/partner-logo", files={"file": png})
    assert r.status_code == 200 and r.json()["partner_logo_path"].startswith("/uploads/")
    pdf = ("logo.pdf", b"%PDF", "application/pdf")
    assert auth_client.post(f"/api/hackathons/{h['id']}/partner-logo", files={"file": pdf}).status_code == 400


def test_public_list_includes_partner(auth_client, client):
    _create(auth_client, partner_name="IIT Patna", start_date=_iso(datetime.utcnow() + timedelta(days=2)), duration_hours=24)
    items = client.get("/api/hackathons/public").json()
    assert any(i["partner_slug"] == "iit-patna" and i["partner_number"] == 1 for i in items)
