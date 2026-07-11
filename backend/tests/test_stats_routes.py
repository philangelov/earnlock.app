from unittest.mock import patch

import pytest

from app.services.supabase import SupabaseError

USER_ID = "11111111-1111-1111-1111-111111111111"

REPO = "app.routes.stats.stats_repo"

SAMPLE_STATS = {
    "totals": {
        "quizzes": 12,
        "questions_answered": 60,
        "questions_correct": 51,
        "accuracy": 0.85,
        "earned_seconds": 9180,
        "spent_seconds": 7860,
        "remaining_seconds": 1320,
    },
    "streak": {"current": 4, "best": 11, "active_today": True},
    "daily": [
        {
            "date": "2026-07-04",
            "quizzes": 1,
            "correct": 4,
            "total": 5,
            "earned_seconds": 720,
        }
    ],
    "subjects": [{"subject": "Math", "correct": 44, "total": 50, "accuracy": 0.88}],
    "recent": [
        {
            "quiz_id": "22222222-2222-2222-2222-222222222222",
            "correct_count": 5,
            "total_count": 5,
            "earned_seconds": 900,
            "created_at": "2026-07-10T08:00:00Z",
        }
    ],
}


@pytest.fixture
def auth_headers():
    """Bypass JWT verification without disturbing the Flask app context."""
    decode = patch("app.middleware.auth.jwt.decode", return_value={"sub": USER_ID})
    jwks = patch("jwt.PyJWKClient.get_signing_key_from_jwt")
    with decode, jwks as mock_key:
        mock_key.return_value.key = "k"
        yield {"Authorization": "Bearer fake.jwt.token"}


def test_stats_requires_auth(client):
    res = client.get("/stats")
    assert res.status_code == 401


def test_stats_returns_aggregates(client, auth_headers):
    with patch(f"{REPO}.get_user_stats", return_value=SAMPLE_STATS) as get_stats:
        res = client.get("/stats", headers=auth_headers)

    assert res.status_code == 200
    assert res.get_json() == SAMPLE_STATS
    get_stats.assert_called_once_with(USER_ID, 0)


def test_stats_forwards_tz_offset(client, auth_headers):
    with patch(f"{REPO}.get_user_stats", return_value=SAMPLE_STATS) as get_stats:
        res = client.get("/stats?tz_offset=-420", headers=auth_headers)

    assert res.status_code == 200
    get_stats.assert_called_once_with(USER_ID, -420)


@pytest.mark.parametrize("offset", ["abc", "", "1.5", "841", "-841"])
def test_stats_rejects_bad_tz_offset(client, auth_headers, offset):
    with patch(f"{REPO}.get_user_stats") as get_stats:
        res = client.get(f"/stats?tz_offset={offset}", headers=auth_headers)

    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "validation_error"
    get_stats.assert_not_called()


def test_stats_accepts_offset_bounds(client, auth_headers):
    for offset in (-840, 840):
        with patch(f"{REPO}.get_user_stats", return_value=SAMPLE_STATS):
            res = client.get(f"/stats?tz_offset={offset}", headers=auth_headers)
        assert res.status_code == 200


def test_stats_returns_500_on_backend_failure(client, auth_headers):
    with patch(f"{REPO}.get_user_stats", side_effect=SupabaseError("boom")):
        res = client.get("/stats", headers=auth_headers)

    assert res.status_code == 500
    assert res.get_json()["error"]["code"] == "internal_error"


def test_fresh_account_reports_no_accuracy_rather_than_zero(client, auth_headers):
    """A user who has answered nothing has *unknown* accuracy, not 0% accuracy — the
    UI keys off `null` to show an empty state instead of a discouraging goose-egg."""
    from app.repos.stats_repo import EMPTY_STATS

    with patch(f"{REPO}.get_user_stats", return_value=EMPTY_STATS):
        res = client.get("/stats", headers=auth_headers)

    body = res.get_json()
    assert res.status_code == 200
    assert body["totals"]["accuracy"] is None
    assert body["totals"]["quizzes"] == 0
    assert body["streak"] == {"current": 0, "best": 0, "active_today": False}
    assert body["recent"] == []
