from unittest.mock import patch

import pytest

from app.validation import (
    ValidationError,
    validate_focus_subjects,
    validate_grade_or_age,
    validate_profile_update,
)

USER_ID = "11111111-1111-1111-1111-111111111111"

_PROFILE_ROW = {
    "user_id": USER_ID,
    "focus_subjects": ["Math", "History"],
    "sos_debt_flag": False,
    "last_sos_date": None,
    "wakeup_completed_date": None,
}

SVC = "app.routes.profile.supabase"


@pytest.fixture
def auth_headers():
    """Bypass JWT verification without disturbing the Flask app context."""
    decode = patch("app.middleware.auth.jwt.decode", return_value={"sub": USER_ID})
    jwks = patch("jwt.PyJWKClient.get_signing_key_from_jwt")
    with decode, jwks as mock_key:
        mock_key.return_value.key = "k"
        yield {"Authorization": "Bearer fake.jwt.token"}


# --- Validation unit tests ------------------------------------------------------

def test_subjects_reject_empty():
    with pytest.raises(ValidationError):
        validate_focus_subjects([])


def test_subjects_reject_unknown():
    with pytest.raises(ValidationError):
        validate_focus_subjects(["Math", "Astrology"])


def test_subjects_canonicalise_and_dedupe():
    assert validate_focus_subjects(["math", "MATH", "biology"]) == ["Math", "Biology"]


def test_grade_accepts_known_grade():
    assert validate_grade_or_age("6th grade") == "6th grade"


def test_grade_accepts_age_in_range():
    assert validate_grade_or_age("Age 12") == "Age 12"
    assert validate_grade_or_age("12") == "Age 12"


def test_grade_rejects_out_of_range_age():
    with pytest.raises(ValidationError):
        validate_grade_or_age("99")


def test_update_requires_at_least_one_field():
    with pytest.raises(ValidationError):
        validate_profile_update({})


def test_update_ignores_server_managed_fields():
    user_fields, profile_fields = validate_profile_update(
        {"focus_subjects": ["Math"], "sos_debt_flag": True}
    )
    assert user_fields == {}
    assert profile_fields == {"focus_subjects": ["Math"]}


# --- Route tests ----------------------------------------------------------------

def test_get_profile_returns_merged_shape(client, auth_headers):
    with patch.multiple(
        SVC, get_user_grade=lambda _: "5th grade",
        get_profile_row=lambda _: _PROFILE_ROW,
    ):
        res = client.get("/profile", headers=auth_headers)

    assert res.status_code == 200
    body = res.get_json()
    assert body["grade_or_age"] == "5th grade"
    assert body["focus_subjects"] == ["Math", "History"]
    assert body["sos_debt_flag"] is False


def test_get_profile_404_when_missing(client, auth_headers):
    with patch.multiple(
        SVC, get_user_grade=lambda _: None, get_profile_row=lambda _: None
    ):
        res = client.get("/profile", headers=auth_headers)

    assert res.status_code == 404
    assert res.get_json()["error"]["code"] == "not_found"


def test_put_profile_rejects_bad_subject(client, auth_headers):
    res = client.put(
        "/profile", headers=auth_headers, json={"focus_subjects": ["Wizardry"]}
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "validation_error"


def test_put_profile_persists_and_returns_updated(client, auth_headers):
    updated = {**_PROFILE_ROW, "focus_subjects": ["Math", "Biology", "English"]}
    with patch(f"{SVC}.update_user_grade") as up_user, \
         patch(f"{SVC}.update_profile_subjects") as up_prof, \
         patch(f"{SVC}.get_user_grade", return_value="6th grade"), \
         patch(f"{SVC}.get_profile_row", return_value=updated):
        res = client.put(
            "/profile",
            headers=auth_headers,
            json={
                "grade_or_age": "6th grade",
                "focus_subjects": ["Math", "Biology", "English"],
            },
        )

    assert res.status_code == 200
    up_user.assert_called_once_with(USER_ID, "6th grade")
    up_prof.assert_called_once_with(USER_ID, ["Math", "Biology", "English"])
    body = res.get_json()
    assert body["focus_subjects"] == ["Math", "Biology", "English"]


def test_put_profile_partial_only_touches_provided_table(client, auth_headers):
    with patch(f"{SVC}.update_user_grade") as up_user, \
         patch(f"{SVC}.update_profile_subjects") as up_prof, \
         patch(f"{SVC}.get_user_grade", return_value="5th grade"), \
         patch(f"{SVC}.get_profile_row", return_value=_PROFILE_ROW):
        res = client.put(
            "/profile", headers=auth_headers, json={"focus_subjects": ["Math"]}
        )

    assert res.status_code == 200
    up_user.assert_not_called()
    up_prof.assert_called_once()
