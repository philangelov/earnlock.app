from unittest.mock import patch

import pytest

from app.services.supabase import SupabaseError

USER_ID = "11111111-1111-1111-1111-111111111111"

SVC = "app.routes.screentime.supabase"


@pytest.fixture
def auth_headers():
    """Bypass JWT verification without disturbing the Flask app context."""
    decode = patch("app.middleware.auth.jwt.decode", return_value={"sub": USER_ID})
    jwks = patch("jwt.PyJWKClient.get_signing_key_from_jwt")
    with decode, jwks as mock_key:
        mock_key.return_value.key = "k"
        yield {"Authorization": "Bearer fake.jwt.token"}


def test_balance_requires_auth(client):
    res = client.get("/screentime/balance")
    assert res.status_code == 401


def test_balance_returns_wallet_row(client, auth_headers):
    row = {"remaining_seconds": 1320, "updated_at": "2026-07-06T09:20:00Z"}
    with patch(f"{SVC}.get_screentime_balance", return_value=row):
        res = client.get("/screentime/balance", headers=auth_headers)

    assert res.status_code == 200
    assert res.get_json() == row


def test_balance_defaults_to_zero_when_wallet_missing(client, auth_headers):
    with patch(f"{SVC}.get_screentime_balance", return_value=None):
        res = client.get("/screentime/balance", headers=auth_headers)

    assert res.status_code == 200
    assert res.get_json() == {"remaining_seconds": 0, "updated_at": None}


def test_balance_returns_500_on_backend_failure(client, auth_headers):
    with patch(f"{SVC}.get_screentime_balance", side_effect=SupabaseError("boom")):
        res = client.get("/screentime/balance", headers=auth_headers)

    assert res.status_code == 500
    assert res.get_json()["error"]["code"] == "internal_error"
