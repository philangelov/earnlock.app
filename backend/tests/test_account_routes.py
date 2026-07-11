from unittest.mock import patch

import pytest

from app.services.supabase import SupabaseError

USER_ID = "11111111-1111-1111-1111-111111111111"

SVC = "app.routes.account.supabase"


@pytest.fixture
def auth_headers():
    decode = patch("app.middleware.auth.jwt.decode", return_value={"sub": USER_ID})
    jwks = patch("jwt.PyJWKClient.get_signing_key_from_jwt")
    with decode, jwks as mock_key:
        mock_key.return_value.key = "k"
        yield {"Authorization": "Bearer fake.jwt.token"}


def test_delete_requires_auth(client):
    assert client.delete("/account").status_code == 401


def test_delete_removes_the_caller_and_only_the_caller(client, auth_headers):
    """The user id comes from the verified token, never from the body — otherwise a
    request could name someone else's account."""
    with patch(f"{SVC}.delete_auth_user") as delete_user:
        res = client.delete(
            "/account", headers=auth_headers, json={"user_id": "someone-else"}
        )

    assert res.status_code == 204
    assert res.get_data() == b""
    delete_user.assert_called_once_with(USER_ID)


def test_delete_is_idempotent_when_the_account_is_already_gone(client, auth_headers):
    """`delete_auth_user` maps a 404 to a normal return: asking to delete something that
    no longer exists got the caller what they wanted."""
    with patch(f"{SVC}.delete_auth_user", return_value=404):
        assert client.delete("/account", headers=auth_headers).status_code == 204


def test_delete_returns_500_on_backend_failure(client, auth_headers):
    with patch(f"{SVC}.delete_auth_user", side_effect=SupabaseError("boom")):
        res = client.delete("/account", headers=auth_headers)

    assert res.status_code == 500
    assert res.get_json()["error"]["code"] == "internal_error"
