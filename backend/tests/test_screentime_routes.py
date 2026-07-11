from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from app.routes.screentime import _remaining_seconds
from app.services.supabase import SupabaseError

USER_ID = "11111111-1111-1111-1111-111111111111"

SVC = "app.routes.screentime.supabase"


def _iso(delta: timedelta) -> str:
    return (datetime.now(UTC) + delta).isoformat()


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


def test_balance_derives_remaining_from_the_window(client, auth_headers):
    row = {
        "unlocked_until": _iso(timedelta(minutes=22)),
        "updated_at": "2026-07-06T09:20:00Z",
    }
    with patch(f"{SVC}.get_screentime_window", return_value=row):
        res = client.get("/screentime/balance", headers=auth_headers)

    assert res.status_code == 200
    body = res.get_json()
    # 22 minutes, give or take the round trip.
    assert 1310 <= body["remaining_seconds"] <= 1320
    assert body["unlocked_until"] == row["unlocked_until"]


def test_an_expired_window_reports_zero_not_a_negative(client, auth_headers):
    """The old model re-granted the full balance on every read. An elapsed window is
    simply spent — the number must never go below zero or wrap back to full."""
    row = {
        "unlocked_until": _iso(timedelta(hours=-3)),
        "updated_at": "2026-07-06T09:20:00Z",
    }
    with patch(f"{SVC}.get_screentime_window", return_value=row):
        res = client.get("/screentime/balance", headers=auth_headers)

    assert res.status_code == 200
    assert res.get_json()["remaining_seconds"] == 0


def test_balance_is_stable_across_repeated_reads(client, auth_headers):
    """Reading the balance must not extend it. Relaunching the app was doing exactly
    that under the old duration-based wallet."""
    row = {
        "unlocked_until": _iso(timedelta(minutes=10)),
        "updated_at": "2026-07-06T09:20:00Z",
    }
    with patch(f"{SVC}.get_screentime_window", return_value=row):
        first = client.get("/screentime/balance", headers=auth_headers).get_json()
        second = client.get("/screentime/balance", headers=auth_headers).get_json()

    assert second["remaining_seconds"] <= first["remaining_seconds"]
    assert first["remaining_seconds"] - second["remaining_seconds"] <= 2


def test_balance_defaults_to_zero_when_window_missing(client, auth_headers):
    with patch(f"{SVC}.get_screentime_window", return_value=None):
        res = client.get("/screentime/balance", headers=auth_headers)

    assert res.status_code == 200
    assert res.get_json() == {
        "remaining_seconds": 0,
        "unlocked_until": None,
        "updated_at": None,
    }


def test_balance_returns_500_on_backend_failure(client, auth_headers):
    with patch(f"{SVC}.get_screentime_window", side_effect=SupabaseError("boom")):
        res = client.get("/screentime/balance", headers=auth_headers)

    assert res.status_code == 500
    assert res.get_json()["error"]["code"] == "internal_error"


@pytest.mark.parametrize("bad", [None, "", "not-a-timestamp", "2026-13-45T99:99:99Z"])
def test_unparseable_window_reads_as_expired(bad):
    """Failing closed means the shield comes back. Failing open would leave a child's
    apps unlocked because a timestamp was malformed."""
    assert _remaining_seconds(bad) == 0


def test_naive_timestamp_is_treated_as_utc():
    naive = (datetime.now(UTC) + timedelta(minutes=5)).replace(tzinfo=None).isoformat()
    assert 290 <= _remaining_seconds(naive) <= 300
