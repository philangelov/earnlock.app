"""Wake-Up Lock — status + completion tests (docs/api-contract.md §8).

app.repos.quiz_repo and app.repos.wakeup_repo are replaced with in-memory fakes so
these exercise the real route logic (auth, replay/tamper guards, the atomic
"already completed today" conflict) with no live Supabase project. "Today" is
monkeypatched to a fixed date so the tests are deterministic regardless of when
they run.
"""

import uuid

import pytest

from app.repos import quiz_repo, wakeup_repo
from tests.conftest import TEST_USER_ID

TODAY = "2026-07-09"
YESTERDAY = "2026-07-08"


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr("app.routes.wakeup._today", lambda: TODAY)


@pytest.fixture
def fake_quizzes(monkeypatch):
    store = {}

    def get_quiz(quiz_id, user_id):
        q = store.get(quiz_id)
        if not q or q["user_id"] != user_id:
            return None
        return dict(q)

    monkeypatch.setattr(quiz_repo, "get_quiz", get_quiz)
    return store


@pytest.fixture
def fake_profile(monkeypatch):
    state = {"wakeup_completed_date": None}

    def get_wakeup_completed_date(user_id):
        return state["wakeup_completed_date"]

    def mark_completed_if_not_today(user_id, today):
        if state["wakeup_completed_date"] == today:
            return False
        state["wakeup_completed_date"] = today
        return True

    monkeypatch.setattr(
        wakeup_repo, "get_wakeup_completed_date", get_wakeup_completed_date
    )
    monkeypatch.setattr(
        wakeup_repo, "mark_completed_if_not_today", mark_completed_if_not_today
    )
    return state


def _submitted_quiz(day):
    return {
        "id": str(uuid.uuid4()),
        "user_id": TEST_USER_ID,
        "questions": [],
        "submitted_at": f"{day}T07:15:00Z",
    }


# --- GET /wakeup/status ----------------------------------------------------------


def test_status_requires_auth(client, fake_profile):
    assert client.get("/wakeup/status").status_code == 401


def test_status_active_by_default(client, auth_headers, fake_profile):
    resp = client.get("/wakeup/status", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == {
        "active": True,
        "required_questions": 3,
        "completed_today": False,
    }


def test_status_inactive_once_completed_today(client, auth_headers, fake_profile):
    fake_profile["wakeup_completed_date"] = TODAY
    resp = client.get("/wakeup/status", headers=auth_headers)
    body = resp.get_json()
    assert body["active"] is False
    assert body["completed_today"] is True


def test_status_resets_after_a_day_passes(client, auth_headers, fake_profile):
    fake_profile["wakeup_completed_date"] = YESTERDAY
    resp = client.get("/wakeup/status", headers=auth_headers)
    body = resp.get_json()
    assert body["active"] is True
    assert body["completed_today"] is False


# --- POST /wakeup/complete --------------------------------------------------------


def test_complete_requires_auth(client, fake_quizzes, fake_profile):
    resp = client.post("/wakeup/complete", json={"quiz_id": str(uuid.uuid4())})
    assert resp.status_code == 401


def test_complete_requires_quiz_id(client, auth_headers, fake_quizzes, fake_profile):
    resp = client.post("/wakeup/complete", headers=auth_headers, json={})
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "validation_error"


def test_complete_malformed_quiz_id_returns_404(
    client, auth_headers, fake_quizzes, fake_profile
):
    resp = client.post(
        "/wakeup/complete", headers=auth_headers, json={"quiz_id": "not-a-uuid"}
    )
    assert resp.status_code == 404
    assert resp.get_json()["error"]["code"] == "not_found"


def test_complete_unknown_quiz_returns_404(
    client, auth_headers, fake_quizzes, fake_profile
):
    resp = client.post(
        "/wakeup/complete", headers=auth_headers, json={"quiz_id": str(uuid.uuid4())}
    )
    assert resp.status_code == 404


def test_complete_rejects_unsubmitted_quiz(
    client, auth_headers, fake_quizzes, fake_profile
):
    quiz_id = str(uuid.uuid4())
    fake_quizzes[quiz_id] = {
        "id": quiz_id,
        "user_id": TEST_USER_ID,
        "questions": [],
        "submitted_at": None,
    }
    resp = client.post(
        "/wakeup/complete", headers=auth_headers, json={"quiz_id": quiz_id}
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "validation_error"


def test_complete_rejects_quiz_submitted_on_a_different_day(
    client, auth_headers, fake_quizzes, fake_profile
):
    """A stale quiz_id can't be replayed on a later day to fake completion."""
    quiz_id = str(uuid.uuid4())
    fake_quizzes[quiz_id] = _submitted_quiz(YESTERDAY)
    resp = client.post(
        "/wakeup/complete", headers=auth_headers, json={"quiz_id": quiz_id}
    )
    assert resp.status_code == 400
    assert "submitted today" in resp.get_json()["error"]["message"]


def test_complete_happy_path(client, auth_headers, fake_quizzes, fake_profile):
    quiz_id = str(uuid.uuid4())
    fake_quizzes[quiz_id] = _submitted_quiz(TODAY)

    resp = client.post(
        "/wakeup/complete", headers=auth_headers, json={"quiz_id": quiz_id}
    )
    assert resp.status_code == 200
    assert resp.get_json() == {"completed": True, "wakeup_completed_date": TODAY}

    status = client.get("/wakeup/status", headers=auth_headers).get_json()
    assert status == {
        "active": False,
        "required_questions": 3,
        "completed_today": True,
    }


def test_complete_twice_in_one_day_is_conflict(
    client, auth_headers, fake_quizzes, fake_profile
):
    quiz_id = str(uuid.uuid4())
    fake_quizzes[quiz_id] = _submitted_quiz(TODAY)

    first = client.post(
        "/wakeup/complete", headers=auth_headers, json={"quiz_id": quiz_id}
    )
    assert first.status_code == 200

    other_quiz_id = str(uuid.uuid4())
    fake_quizzes[other_quiz_id] = _submitted_quiz(TODAY)
    second = client.post(
        "/wakeup/complete", headers=auth_headers, json={"quiz_id": other_quiz_id}
    )
    assert second.status_code == 409
    assert second.get_json()["error"]["code"] == "conflict"


def test_complete_concurrent_race_caught_by_atomic_guard(
    client, auth_headers, fake_quizzes, fake_profile, monkeypatch
):
    """Even if the pre-check would allow it, the atomic guard yields 409 — proving the
    conflict check doesn't rely on a racy read-then-write in this process."""
    quiz_id = str(uuid.uuid4())
    fake_quizzes[quiz_id] = _submitted_quiz(TODAY)
    monkeypatch.setattr(
        wakeup_repo, "mark_completed_if_not_today", lambda user_id, today: False
    )

    resp = client.post(
        "/wakeup/complete", headers=auth_headers, json={"quiz_id": quiz_id}
    )
    assert resp.status_code == 409
