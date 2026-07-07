from app.routes.quiz import get_quiz_answer_key, set_user_state


def _generate_quiz(client, auth_headers):
    response = client.post("/quiz/generate", headers=auth_headers)
    assert response.status_code == 200
    return response.get_json()


def _submit_answers(client, auth_headers, quiz_id, answers):
    return client.post(
        "/quiz/submit",
        headers=auth_headers,
        json={"quiz_id": quiz_id, "answers": answers},
    )


def test_submit_zero_correct_returns_full_remediation(client, auth_headers):
    quiz = _generate_quiz(client, auth_headers)
    answer_key = get_quiz_answer_key(quiz["quiz_id"])
    wrong_answers = [
        {"id": question_id, "selected_index": (correct_index + 1) % 4}
        for question_id, correct_index in answer_key.items()
    ]

    response = _submit_answers(client, auth_headers, quiz["quiz_id"], wrong_answers)
    assert response.status_code == 200
    body = response.get_json()

    assert body["correct_count"] == 0
    assert body["earned_seconds"] == 0
    assert body["new_balance_seconds"] == 0
    assert len(body["remediation"]) == quiz["question_count"]
    assert all(not result["correct"] for result in body["results"])


def test_submit_all_correct_awards_full_reward(client, auth_headers):
    quiz = _generate_quiz(client, auth_headers)
    answer_key = get_quiz_answer_key(quiz["quiz_id"])
    correct_answers = [
        {"id": question_id, "selected_index": correct_index}
        for question_id, correct_index in answer_key.items()
    ]

    response = _submit_answers(client, auth_headers, quiz["quiz_id"], correct_answers)
    assert response.status_code == 200
    body = response.get_json()

    assert body["correct_count"] == quiz["question_count"]
    assert body["earned_seconds"] == 900
    assert body["new_balance_seconds"] == 900
    assert body["sos_debt_cleared"] is False


def test_submit_in_debt_state_caps_reward_and_clears_debt(client, auth_headers):
    set_user_state("user-123", debt_flag=True, balance_seconds=-120)
    quiz = _generate_quiz(client, auth_headers)
    answer_key = get_quiz_answer_key(quiz["quiz_id"])
    assert quiz["question_count"] == 7

    first_five = list(answer_key.items())[:5]
    remaining = list(answer_key.items())[5:]
    answers = [
        {"id": question_id, "selected_index": correct_index}
        for question_id, correct_index in first_five
    ]
    answers.extend(
        {"id": question_id, "selected_index": (correct_index + 1) % 4}
        for question_id, correct_index in remaining
    )

    response = _submit_answers(client, auth_headers, quiz["quiz_id"], answers)
    assert response.status_code == 200
    body = response.get_json()

    assert body["correct_count"] == 5
    assert body["earned_seconds"] == 900
    assert body["new_balance_seconds"] == 780
    assert body["sos_debt_cleared"] is True


def test_submit_duplicate_quiz_is_rejected_without_extra_reward(client, auth_headers):
    quiz = _generate_quiz(client, auth_headers)
    answer_key = get_quiz_answer_key(quiz["quiz_id"])
    correct_answers = [
        {"id": question_id, "selected_index": correct_index}
        for question_id, correct_index in answer_key.items()
    ]

    first = _submit_answers(client, auth_headers, quiz["quiz_id"], correct_answers)
    assert first.status_code == 200
    assert first.get_json()["new_balance_seconds"] == 900

    second = _submit_answers(client, auth_headers, quiz["quiz_id"], correct_answers)
    assert second.status_code == 409
