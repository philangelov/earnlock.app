import json
from unittest.mock import patch

from app.routes import auth as auth_module

_USER_ID = "11111111-1111-1111-1111-111111111111"


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


def _session_body(**overrides):
    body = {
        "access_token": "jwt-token",
        "refresh_token": "refresh-token",
        "expires_in": 3600,
        "user": {"id": _USER_ID, "email": "kid@example.com"},
    }
    body.update(overrides)
    return body


def _patch_upstream(body, status=200):
    return patch.object(
        auth_module.urllib.request, "urlopen", return_value=_FakeResponse(body, status)
    )


def _patch_grade(grade="5th grade"):
    return patch.object(auth_module.supabase, "get_user_grade", return_value=grade)


# --- POST /auth/oauth ------------------------------------------------------------


def test_oauth_rejects_unknown_provider(client):
    res = client.post("/auth/oauth", json={"provider": "facebook", "id_token": "t"})
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "validation_error"


def test_oauth_requires_id_token(client):
    res = client.post("/auth/oauth", json={"provider": "apple"})
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "validation_error"


def test_oauth_rejects_oversized_id_token(client):
    res = client.post(
        "/auth/oauth", json={"provider": "google", "id_token": "x" * 9000}
    )
    assert res.status_code == 400


def test_oauth_success_returns_session(client):
    with _patch_upstream(_session_body()), _patch_grade():
        res = client.post(
            "/auth/oauth",
            json={"provider": "apple", "id_token": "apple.id.token", "nonce": "abc"},
        )

    assert res.status_code == 200
    body = res.get_json()
    assert body["token"] == "jwt-token"
    assert body["refresh_token"] == "refresh-token"
    assert body["expires_in"] == 3600
    assert body["user"]["id"] == _USER_ID
    assert body["user"]["grade_or_age"] == "5th grade"


def test_oauth_forwards_nonce_only_when_present(client):
    """Google's native flow may omit the nonce; Apple's never does."""
    captured = {}

    def _capture(path, payload):
        captured.clear()
        captured.update(payload)
        return _session_body(), 200

    with patch.object(auth_module, "_supabase_auth_request", side_effect=_capture):
        with _patch_grade():
            client.post("/auth/oauth", json={"provider": "google", "id_token": "t"})
            assert "nonce" not in captured

            client.post(
                "/auth/oauth",
                json={"provider": "apple", "id_token": "t", "nonce": "raw"},
            )
            assert captured["nonce"] == "raw"


def test_oauth_grade_defaults_to_unspecified_when_row_unreadable(client):
    """A session must still be issued if public.users can't be read."""
    with _patch_upstream(_session_body()):
        with patch.object(
            auth_module.supabase,
            "get_user_grade",
            side_effect=auth_module.supabase.SupabaseError("boom"),
        ):
            res = client.post(
                "/auth/oauth", json={"provider": "google", "id_token": "t"}
            )

    assert res.status_code == 200
    assert res.get_json()["user"]["grade_or_age"] == "unspecified"


def test_oauth_allows_null_email(client):
    """Apple accounts may withhold the email claim entirely."""
    body = _session_body(user={"id": _USER_ID, "email": None})
    with _patch_upstream(body), _patch_grade():
        res = client.post("/auth/oauth", json={"provider": "apple", "id_token": "t"})

    assert res.status_code == 200
    assert res.get_json()["user"]["email"] is None


def test_oauth_rejected_token_maps_to_401(client):
    error = auth_module.urllib.error.HTTPError(
        url=None, code=400, msg="bad", hdrs=None, fp=None
    )
    error.read = lambda: json.dumps({"msg": "Provider is not enabled"}).encode()

    with patch.object(auth_module.urllib.request, "urlopen", side_effect=error):
        res = client.post("/auth/oauth", json={"provider": "apple", "id_token": "t"})

    assert res.status_code == 401
    body = res.get_json()
    assert body["error"]["code"] == "unauthorized"
    # The upstream reason survives — "provider is not enabled" is the setup mistake.
    assert "not enabled" in body["error"]["message"]


def test_oauth_unreachable_auth_service_maps_to_502(client):
    """URLError/timeout must return the JSON envelope, never Flask's HTML 500."""
    error = auth_module.urllib.error.URLError("connection refused")
    with patch.object(auth_module.urllib.request, "urlopen", side_effect=error):
        res = client.post("/auth/oauth", json={"provider": "google", "id_token": "t"})

    assert res.status_code == 502
    assert res.get_json()["error"]["code"] == "upstream_error"


# --- POST /auth/refresh ----------------------------------------------------------


def test_refresh_requires_token(client):
    res = client.post("/auth/refresh", json={})
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "validation_error"


def test_refresh_success_returns_new_session(client):
    with _patch_upstream(_session_body(access_token="new-jwt")), _patch_grade():
        res = client.post("/auth/refresh", json={"refresh_token": "old-refresh"})

    assert res.status_code == 200
    assert res.get_json()["token"] == "new-jwt"


def test_refresh_expired_maps_to_401(client):
    error = auth_module.urllib.error.HTTPError(
        url=None, code=400, msg="bad", hdrs=None, fp=None
    )
    error.read = lambda: json.dumps({"msg": "Invalid Refresh Token"}).encode()

    with patch.object(auth_module.urllib.request, "urlopen", side_effect=error):
        res = client.post("/auth/refresh", json={"refresh_token": "stale"})

    assert res.status_code == 401
    assert res.get_json()["error"]["code"] == "unauthorized"


# --- The password routes are gone -------------------------------------------------


def test_password_routes_no_longer_exist(client):
    assert client.post("/auth/register", json={}).status_code == 404
    assert client.post("/auth/login", json={}).status_code == 404
