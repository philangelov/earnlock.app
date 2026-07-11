"""Quiz submit engine — boundary + correctness tests.

The DB layer (app.repos.quiz_repo) is replaced with an in-memory fake so these exercise
the real route logic — grading, reward math, remediation, debt, idempotency — with no
live Supabase project. Answer keys are recomputed from the deterministic question bank.
"""

import uuid

import pytest

from app.quiz_content import build_questions, subject_tally
from app.repos import quiz_repo
from app.repos.quiz_repo import QuizAlreadySubmitted
from app.validation import VALID_SUBJECTS
from tests.conftest import TEST_USER_ID


@pytest.fixture
def fake_db(monkeypatch):
    """In-memory stand-in for quiz_repo, monkeypatched into the route module.

    Quiz ids are real UUID strings, matching production (quizzes.id is uuid) — the
    route rejects malformed ids before ever hitting the repo.
    """
    state = {"quizzes": {}, "debt": {}, "balance": {}, "subjects": {}, "history": []}

    def create_quiz(user_id, questions):
        quiz_id = str(uuid.uuid4())
        state["quizzes"][quiz_id] = {
            "id": quiz_id,
            "user_id": user_id,
            "questions": questions,
            "submitted_at": None,
        }
        return quiz_id

    def get_quiz(quiz_id, user_id):
        q = state["quizzes"].get(quiz_id)
        if not q or q["user_id"] != user_id:
            return None
        return dict(q)  # copy: the route sees the persisted submitted_at

    def get_debt_flag(user_id):
        return state["debt"].get(user_id, False)

    def submit_reward(
        user_id,
        quiz_id,
        correct_count,
        total_count,
        earned_seconds,
        clear_debt,
        subject_stats=None,
    ):
        q = state["quizzes"].get(quiz_id)
        if q is None or q["submitted_at"] is not None:
            raise QuizAlreadySubmitted(quiz_id)
        q["submitted_at"] = "2026-07-07T00:00:00Z"
        state["balance"][user_id] = state["balance"].get(user_id, 0) + earned_seconds
        state["history"].append(
            {"correct_count": correct_count, "total_count": total_count}
        )
        for row in subject_stats or []:
            bucket = state["subjects"].setdefault(
                row["subject"], {"correct": 0, "total": 0}
            )
            bucket["correct"] += row["correct"]
            bucket["total"] += row["total"]
        if clear_debt:
            state["debt"][user_id] = False
        return state["balance"][user_id]

    monkeypatch.setattr(quiz_repo, "create_quiz", create_quiz)
    monkeypatch.setattr(quiz_repo, "get_quiz", get_quiz)
    monkeypatch.setattr(quiz_repo, "get_debt_flag", get_debt_flag)
    monkeypatch.setattr(quiz_repo, "submit_reward", submit_reward)
    return state


def _generate(client, auth_headers):
    resp = client.post("/quiz/generate", headers=auth_headers)
    assert resp.status_code == 200
    return resp.get_json()


def _answers(quiz, *, correct):
    """Build an answers[] payload from the deterministic bank; correct or all-wrong."""
    keyed = build_questions(quiz["question_count"])
    return [
        {
            "id": q["id"],
            "selected_index": q["correct_index"]
            if correct
            else (q["correct_index"] + 1) % 4,
        }
        for q in keyed
    ]


def _submit(client, auth_headers, quiz_id, answers):
    return client.post(
        "/quiz/submit",
        headers=auth_headers,
        json={"quiz_id": quiz_id, "answers": answers},
    )


def test_generate_hides_answer_key(client, auth_headers, fake_db):
    quiz = _generate(client, auth_headers)
    assert quiz["question_count"] == 5
    for q in quiz["questions"]:
        assert "correct_index" not in q
        assert "concept" not in q


def test_generate_labels_each_question_with_a_subject(client, auth_headers, fake_db):
    """A subject names a question; it doesn't answer one — so it ships to the client,
    and it is what makes Insights' mastery bars real rather than decorative."""
    quiz = _generate(client, auth_headers)
    subjects = [q["subject"] for q in quiz["questions"]]
    assert all(s in VALID_SUBJECTS for s in subjects)


def test_submit_records_the_attempts_length_not_just_its_score(
    client, auth_headers, fake_db
):
    """Accuracy is unknowable without the denominator; history must carry it."""
    quiz = _generate(client, auth_headers)
    answers = _answers(quiz, correct=True)
    answers[0]["selected_index"] = (answers[0]["selected_index"] + 1) % 4
    _submit(client, auth_headers, quiz["quiz_id"], answers)

    assert fake_db["history"] == [{"correct_count": 4, "total_count": 5}]


def test_submit_tallies_correct_and_total_per_subject(client, auth_headers, fake_db):
    quiz = _generate(client, auth_headers)
    _submit(client, auth_headers, quiz["quiz_id"], _answers(quiz, correct=True))

    # The 5-question bank slice is Biology, History, Math, Biology, Coding.
    assert fake_db["subjects"] == {
        "Biology": {"correct": 2, "total": 2},
        "History": {"correct": 1, "total": 1},
        "Math": {"correct": 1, "total": 1},
        "Coding": {"correct": 1, "total": 1},
    }


def test_wrong_answers_count_toward_total_only(client, auth_headers, fake_db):
    quiz = _generate(client, auth_headers)
    _submit(client, auth_headers, quiz["quiz_id"], _answers(quiz, correct=False))

    tallied = fake_db["subjects"]
    assert sum(v["total"] for v in tallied.values()) == 5
    assert all(v["correct"] == 0 for v in tallied.values())


def test_unlabelled_questions_are_skipped_not_bucketed(client, auth_headers, fake_db):
    """A question with no subject is unknown, not 'General'. Inventing a bucket for it
    would put a mastery bar on a subject the learner never chose."""
    graded = [
        {"id": "q1", "correct": True},
        {"id": "q2", "correct": False},
    ]
    questions = [
        {"id": "q1", "subject": "Math"},
        {"id": "q2", "subject": None},
    ]
    assert subject_tally(questions, graded) == [
        {"subject": "Math", "correct": 1, "total": 1}
    ]


def test_all_correct_awards_full_reward(client, auth_headers, fake_db):
    quiz = _generate(client, auth_headers)
    resp = _submit(client, auth_headers, quiz["quiz_id"], _answers(quiz, correct=True))
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["correct_count"] == 5
    assert body["total"] == 5
    assert body["earned_seconds"] == 900
    assert body["new_balance_seconds"] == 900
    assert body["sos_debt_cleared"] is False
    assert all(r["correct"] and r["explanation"] is None for r in body["results"])


def test_zero_correct_earns_nothing_and_remediates_all(client, auth_headers, fake_db):
    quiz = _generate(client, auth_headers)
    resp = _submit(client, auth_headers, quiz["quiz_id"], _answers(quiz, correct=False))
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["correct_count"] == 0
    assert body["earned_seconds"] == 0
    assert body["new_balance_seconds"] == 0
    wrong = [r for r in body["results"] if not r["correct"]]
    assert len(wrong) == 5
    assert all(isinstance(r["explanation"], str) and r["explanation"] for r in wrong)


def test_partial_correct_is_linear(client, auth_headers, fake_db):
    quiz = _generate(client, auth_headers)
    answers = _answers(quiz, correct=True)
    answers[3]["selected_index"] = (answers[3]["selected_index"] + 1) % 4  # break one
    answers[4]["selected_index"] = (
        answers[4]["selected_index"] + 1
    ) % 4  # break another
    resp = _submit(client, auth_headers, quiz["quiz_id"], answers)
    body = resp.get_json()
    assert body["correct_count"] == 3
    assert body["earned_seconds"] == 540  # 3 × 180
    assert body["new_balance_seconds"] == 540


def test_debt_quiz_has_seven_caps_reward_and_clears_debt(client, auth_headers, fake_db):
    fake_db["debt"][TEST_USER_ID] = True
    quiz = _generate(client, auth_headers)
    assert quiz["question_count"] == 7

    keyed = build_questions(7)
    answers = [{"id": q["id"], "selected_index": q["correct_index"]} for q in keyed[:5]]
    answers += [
        {"id": q["id"], "selected_index": (q["correct_index"] + 1) % 4}
        for q in keyed[5:]
    ]

    resp = _submit(client, auth_headers, quiz["quiz_id"], answers)
    body = resp.get_json()
    assert body["correct_count"] == 5
    assert body["earned_seconds"] == 900  # capped even though 7 questions
    assert body["new_balance_seconds"] == 900  # debt is a flag, not a negative balance
    assert body["sos_debt_cleared"] is True
    assert fake_db["debt"][TEST_USER_ID] is False


def test_debt_not_cleared_when_below_target(client, auth_headers, fake_db):
    fake_db["debt"][TEST_USER_ID] = True
    quiz = _generate(client, auth_headers)
    keyed = build_questions(7)
    answers = [{"id": q["id"], "selected_index": q["correct_index"]} for q in keyed[:4]]
    answers += [
        {"id": q["id"], "selected_index": (q["correct_index"] + 1) % 4}
        for q in keyed[4:]
    ]
    body = _submit(client, auth_headers, quiz["quiz_id"], answers).get_json()
    assert body["correct_count"] == 4
    assert body["earned_seconds"] == 720  # 4 × 180
    assert body["sos_debt_cleared"] is False
    assert fake_db["debt"][TEST_USER_ID] is True


def test_duplicate_submit_rejected_without_extra_reward(client, auth_headers, fake_db):
    quiz = _generate(client, auth_headers)
    answers = _answers(quiz, correct=True)
    first = _submit(client, auth_headers, quiz["quiz_id"], answers)
    assert first.status_code == 200
    assert first.get_json()["new_balance_seconds"] == 900

    second = _submit(client, auth_headers, quiz["quiz_id"], answers)
    assert second.status_code == 409
    assert fake_db["balance"][TEST_USER_ID] == 900  # not doubled


def test_concurrent_race_caught_by_atomic_guard(
    client, auth_headers, fake_db, monkeypatch
):
    """Even if the fast-path check passes, the atomic submit_reward guard yields 409."""
    quiz = _generate(client, auth_headers)
    # Force the pre-check to think the quiz is unsubmitted, so the DB guard fires.
    monkeypatch.setattr(
        quiz_repo,
        "get_quiz",
        lambda quiz_id, user_id: {
            "id": quiz_id,
            "user_id": user_id,
            "questions": build_questions(5),
            "submitted_at": None,
        },
    )
    calls = {"n": 0}

    def racing_submit(**kwargs):
        calls["n"] += 1
        if calls["n"] > 1:
            raise QuizAlreadySubmitted(kwargs["quiz_id"])
        return 900

    monkeypatch.setattr(quiz_repo, "submit_reward", racing_submit)
    answers = _answers(quiz, correct=True)
    assert _submit(client, auth_headers, quiz["quiz_id"], answers).status_code == 200
    assert _submit(client, auth_headers, quiz["quiz_id"], answers).status_code == 409


def test_submit_unknown_quiz_returns_404(client, auth_headers, fake_db):
    """A well-formed id that simply doesn't exist → 404 from the repo lookup."""
    resp = _submit(
        client, auth_headers, str(uuid.uuid4()), [{"id": "q1", "selected_index": 0}]
    )
    assert resp.status_code == 404


def test_submit_malformed_quiz_id_returns_404(client, auth_headers, fake_db):
    """A non-UUID id can't exist; it must 404 without reaching PostgREST."""
    resp = _submit(
        client, auth_headers, "does-not-exist", [{"id": "q1", "selected_index": 0}]
    )
    assert resp.status_code == 404
    assert resp.get_json()["error"]["code"] == "not_found"


def test_submit_boolean_selected_index_rejected(client, auth_headers, fake_db):
    """JSON true/false must not be graded as index 1/0 (bool subclasses int)."""
    quiz = _generate(client, auth_headers)
    resp = _submit(
        client, auth_headers, quiz["quiz_id"], [{"id": "q1", "selected_index": True}]
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "validation_error"


def test_submit_validation_error(client, auth_headers, fake_db):
    resp = client.post("/quiz/submit", headers=auth_headers, json={"quiz_id": "x"})
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "validation_error"


def test_submit_requires_auth(client, fake_db):
    resp = client.post("/quiz/submit", json={"quiz_id": "x", "answers": []})
    assert resp.status_code == 401
