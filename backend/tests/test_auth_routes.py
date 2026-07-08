import json
from unittest.mock import patch

from app.routes import auth as auth_module


class _FakeResponse:
    def __init__(self, body, status):
        self._body = json.dumps(body).encode()
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self._body


def test_register_requires_all_fields(client):
    res = client.post("/auth/register", json={"email": "kid@example.com"})
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "validation_error"


def test_register_success_returns_user_and_token(client):
    supabase_body = {
        "access_token": "jwt-token",
        "user": {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "kid@example.com",
        },
    }
    fake_urlopen = _FakeResponse(supabase_body, 200)
    with patch.object(auth_module.urllib.request, "urlopen", return_value=fake_urlopen):
        res = client.post(
            "/auth/register",
            json={
                "email": "kid@example.com",
                "password": "password123",
                "grade_or_age": "5th grade",
            },
        )

    assert res.status_code == 201
    body = res.get_json()
    assert body["token"] == "jwt-token"
    assert body["user"]["grade_or_age"] == "5th grade"


def test_register_conflict_on_existing_email(client):
    error = auth_module.urllib.error.HTTPError(
        url=None, code=422, msg="already registered", hdrs=None, fp=None
    )
    error.read = lambda: json.dumps({"msg": "User already registered"}).encode()

    with patch.object(auth_module.urllib.request, "urlopen", side_effect=error):
        res = client.post(
            "/auth/register",
            json={
                "email": "kid@example.com",
                "password": "password123",
                "grade_or_age": "5th grade",
            },
        )

    assert res.status_code == 409
    assert res.get_json()["error"]["code"] == "conflict"


def test_login_requires_fields(client):
    res = client.post("/auth/login", json={"email": "kid@example.com"})
    assert res.status_code == 400


def test_login_success_returns_user_and_token(client):
    supabase_body = {
        "access_token": "jwt-token",
        "user": {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "kid@example.com",
            "user_metadata": {"grade_or_age": "5th grade"},
        },
    }
    fake_urlopen = _FakeResponse(supabase_body, 200)
    with patch.object(auth_module.urllib.request, "urlopen", return_value=fake_urlopen):
        res = client.post(
            "/auth/login",
            json={"email": "kid@example.com", "password": "password123"},
        )

    assert res.status_code == 200
    body = res.get_json()
    assert body["token"] == "jwt-token"
    assert body["user"]["grade_or_age"] == "5th grade"


def test_login_rejects_bad_credentials(client):
    error = auth_module.urllib.error.HTTPError(
        url=None, code=400, msg="invalid", hdrs=None, fp=None
    )
    error.read = lambda: json.dumps(
        {"error_description": "Invalid login credentials"}
    ).encode()

    with patch.object(auth_module.urllib.request, "urlopen", side_effect=error):
        res = client.post(
            "/auth/login",
            json={"email": "kid@example.com", "password": "wrong"},
        )

    assert res.status_code == 401
    assert res.get_json()["error"]["code"] == "unauthorized"


def test_register_rejects_invalid_grade_or_age(client):
    """grade_or_age goes through the same whitelist as PUT /profile."""
    res = client.post(
        "/auth/register",
        json={
            "email": "kid@example.com",
            "password": "password123",
            "grade_or_age": "definitely-not-a-grade",
        },
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "validation_error"


def test_login_unreachable_auth_service_maps_to_502(client):
    """URLError/timeout must return the JSON envelope, never Flask's HTML 500."""
    error = auth_module.urllib.error.URLError("connection refused")
    with patch.object(auth_module.urllib.request, "urlopen", side_effect=error):
        res = client.post(
            "/auth/login",
            json={"email": "kid@example.com", "password": "password123"},
        )
    assert res.status_code == 502
    assert res.get_json()["error"]["code"] == "upstream_error"
