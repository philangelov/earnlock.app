from datetime import UTC, datetime
from threading import RLock
from uuid import uuid4

from flask import Blueprint, current_app, g, jsonify, request

from app.middleware.auth import require_auth

quiz_bp = Blueprint("quiz", __name__, url_prefix="/quiz")

_STATE_LOCK = RLock()
_ACTIVE_QUIZZES = {}
_INFLIGHT_SUBMISSIONS = set()
_SUBMITTED_QUIZZES = set()
_BALANCE_LEDGER = {}
_TRANSACTION_LEDGER = {}
_USER_DEBT_FLAGS = {}

_QUESTION_BANK = [
    {
        "prompt": "What is the time complexity of binary search?",
        "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
        "correct_index": 1,
        "concept": "Binary search halves the search interval on every step.",
    },
    {
        "prompt": "Which organelle is responsible for photosynthesis?",
        "options": ["Nucleus", "Ribosome", "Chloroplast", "Mitochondrion"],
        "correct_index": 2,
        "concept": "Chloroplasts use chlorophyll to convert light energy into sugars.",
    },
    {
        "prompt": "What is 9 × 6?",
        "options": ["54", "42", "48", "56"],
        "correct_index": 0,
        "concept": "Multiplication combines equal groups, so 9 groups of 6 make 54.",
    },
    {
        "prompt": "Which data structure follows FIFO order?",
        "options": ["Stack", "Queue", "Tree", "Set"],
        "correct_index": 1,
        "concept": "A queue serves the oldest inserted item first.",
    },
    {
        "prompt": "What gas do plants release during photosynthesis?",
        "options": ["Nitrogen", "Carbon dioxide", "Helium", "Oxygen"],
        "correct_index": 3,
        "concept": "Plants take in carbon dioxide and release oxygen as a byproduct.",
    },
    {
        "prompt": "Which statement about fractions is correct?",
        "options": [
            "1/4 is larger than 1/2",
            "2/3 is larger than 1/2",
            "3/8 equals 1/2",
            "1/5 is larger than 1/4",
        ],
        "correct_index": 1,
        "concept": "With a common denominator, 2/3 is greater than 1/2.",
    },
    {
        "prompt": "Which planet is known as the Red Planet?",
        "options": ["Venus", "Jupiter", "Mars", "Mercury"],
        "correct_index": 2,
        "concept": "Mars appears red because of iron oxide dust on its surface.",
    },
]


def _utc_now_iso():
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _reward_for_correct_answers(correct_count):
    correct_target = current_app.config["QUIZ_CORRECT_TARGET"]
    reward_seconds = current_app.config["REWARD_SECONDS"]
    seconds_per_correct = reward_seconds // correct_target
    return min(correct_count, correct_target) * seconds_per_correct


def _build_quiz_questions(question_count):
    questions = []
    for i, question in enumerate(_QUESTION_BANK[:question_count], start=1):
        questions.append(
            {
                "id": f"q{i}",
                "prompt": question["prompt"],
                "options": question["options"],
                "correct_index": question["correct_index"],
                "concept": question["concept"],
            }
        )
    return questions


def _generate_ai_remediation(locale, question, selected_index):
    picked_text = (
        question["options"][selected_index]
        if isinstance(selected_index, int) and 0 <= selected_index <= 3
        else "no option"
    )
    return (
        f"[{locale}] '{picked_text}' is not correct for this question. "
        f"The correct idea is: {question['concept']} "
        "Review that concept and try a similar problem again."
    )


def reset_quiz_state():
    with _STATE_LOCK:
        _ACTIVE_QUIZZES.clear()
        _INFLIGHT_SUBMISSIONS.clear()
        _SUBMITTED_QUIZZES.clear()
        _BALANCE_LEDGER.clear()
        _TRANSACTION_LEDGER.clear()
        _USER_DEBT_FLAGS.clear()


def set_user_state(user_id, *, debt_flag=None, balance_seconds=None):
    with _STATE_LOCK:
        if debt_flag is not None:
            _USER_DEBT_FLAGS[user_id] = bool(debt_flag)
        if balance_seconds is not None:
            _BALANCE_LEDGER[user_id] = int(balance_seconds)


def get_quiz_answer_key(quiz_id):
    with _STATE_LOCK:
        quiz = _ACTIVE_QUIZZES.get(quiz_id)
        if not quiz:
            return {}
        return {
            question["id"]: question["correct_index"] for question in quiz["questions"]
        }


@quiz_bp.post("/generate")
@require_auth
def generate_quiz():
    with _STATE_LOCK:
        has_debt = _USER_DEBT_FLAGS.get(g.user_id, False)
    question_count = (
        current_app.config["QUIZ_LEN_DEBT"]
        if has_debt
        else current_app.config["QUIZ_LEN_NORMAL"]
    )
    quiz_id = str(uuid4())
    questions = _build_quiz_questions(question_count)
    with _STATE_LOCK:
        _ACTIVE_QUIZZES[quiz_id] = {
            "user_id": g.user_id,
            "questions": questions,
            "submitted": False,
        }
    return jsonify(
        {
            "quiz_id": quiz_id,
            "user_id": g.user_id,
            "question_count": question_count,
            "questions": [
                {
                    "id": question["id"],
                    "prompt": question["prompt"],
                    "options": question["options"],
                }
                for question in questions
            ],
            "generated_at": _utc_now_iso(),
        }
    )


@quiz_bp.post("/submit")
@require_auth
def submit_quiz():
    payload = request.get_json(silent=True) or {}
    quiz_id = payload.get("quiz_id")
    answers = payload.get("answers")
    if not isinstance(quiz_id, str) or not isinstance(answers, list):
        return jsonify({"error": "validation_error"}), 400

    submission_key = (g.user_id, quiz_id)
    with _STATE_LOCK:
        quiz = _ACTIVE_QUIZZES.get(quiz_id)
        if not quiz or quiz["user_id"] != g.user_id:
            return jsonify({"error": "not_found"}), 404
        if submission_key in _SUBMITTED_QUIZZES or quiz["submitted"]:
            return jsonify({"error": "quiz already submitted"}), 409
        if submission_key in _INFLIGHT_SUBMISSIONS:
            return jsonify({"error": "submission in progress"}), 409
        _INFLIGHT_SUBMISSIONS.add(submission_key)

    try:
        answer_map = {}
        for answer in answers:
            if not isinstance(answer, dict):
                return jsonify({"error": "validation_error"}), 400
            answer_id = answer.get("id")
            selected_index = answer.get("selected_index")
            if not isinstance(answer_id, str):
                return jsonify({"error": "validation_error"}), 400
            if selected_index is not None and (
                not isinstance(selected_index, int)
                or selected_index < 0
                or selected_index > 3
            ):
                return jsonify({"error": "validation_error"}), 400
            answer_map[answer_id] = selected_index

        locale = request.headers.get("Accept-Language", "en").split(",")[0] or "en"
        correct_count = 0
        results = []
        remediation = {}
        for question in quiz["questions"]:
            selected_index = answer_map.get(question["id"])
            is_correct = selected_index == question["correct_index"]
            if is_correct:
                correct_count += 1
                explanation = None
            else:
                explanation = _generate_ai_remediation(locale, question, selected_index)
                remediation[question["id"]] = explanation
            results.append(
                {
                    "id": question["id"],
                    "correct": is_correct,
                    "selected_index": selected_index,
                    "correct_index": question["correct_index"],
                    "explanation": explanation,
                }
            )

        earned_seconds = _reward_for_correct_answers(correct_count)
        with _STATE_LOCK:
            current_balance = _BALANCE_LEDGER.get(g.user_id, 0)
            new_balance = current_balance + earned_seconds
            _BALANCE_LEDGER[g.user_id] = new_balance
            debt_was_active = _USER_DEBT_FLAGS.get(g.user_id, False)
            target = current_app.config["QUIZ_CORRECT_TARGET"]
            sos_debt_cleared = debt_was_active and correct_count >= target
            if sos_debt_cleared:
                _USER_DEBT_FLAGS[g.user_id] = False
            _TRANSACTION_LEDGER.setdefault(g.user_id, []).append(
                {
                    "quiz_id": quiz_id,
                    "earned_seconds": earned_seconds,
                    "balance_after": new_balance,
                    "created_at": _utc_now_iso(),
                }
            )
            quiz["submitted"] = True
            _SUBMITTED_QUIZZES.add(submission_key)
    finally:
        with _STATE_LOCK:
            _INFLIGHT_SUBMISSIONS.discard(submission_key)

    return jsonify(
        {
            "quiz_id": quiz_id,
            "user_id": g.user_id,
            "correct_count": correct_count,
            "total": len(results),
            "earned_seconds": earned_seconds,
            "new_balance_seconds": new_balance,
            "sos_debt_cleared": sos_debt_cleared,
            "results": results,
            "remediation": remediation,
            "submitted_at": _utc_now_iso(),
        }
    )
