"""Quiz engine — generate a quiz and score a submission (docs/api-contract.md §5).

/submit is the heart of the currency: it grades answers server-side against the stored
key, computes earned screen-time (config-driven, capped), persists it atomically to the
hybrid ledger (balance + quiz_history) with an idempotency guard, clears SOS debt, and
returns per-question remediation for wrong answers (used by Learning Mode).
"""

import uuid
from datetime import UTC, datetime

from flask import Blueprint, current_app, g, jsonify, request

from app.ai import generate_quiz_questions, get_explainer
from app.middleware.auth import require_auth
from app.quiz_content import public_view
from app.repos import knowledge_repo, quiz_repo
from app.repos.quiz_repo import QuizAlreadySubmitted
from app.services import supabase

quiz_bp = Blueprint("quiz", __name__, url_prefix="/quiz")


def _is_uuid(value: str) -> bool:
    """True only for the canonical 8-4-4-4-12 form Postgres accepts.

    uuid.UUID() alone is too lenient — it also parses urn:uuid:/braced/bare-hex
    forms that Postgres's uuid cast rejects (which would surface as a 500).
    """
    try:
        return str(uuid.UUID(value)) == value.lower()
    except ValueError:
        return False


def _now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _error(code: str, message: str, status: int):
    return jsonify({"error": {"code": code, "message": message}}), status


def _reward_seconds(correct_count: int) -> int:
    """Linear per correct answer, capped at the full reward (architecture.md §8)."""
    target = current_app.config["QUIZ_CORRECT_TARGET"]
    reward = current_app.config["REWARD_SECONDS"]
    seconds_per_correct = reward // target
    return min(correct_count, target) * seconds_per_correct


def _profile_context(user_id):
    """Best-effort (grade_or_age, focus_subjects) for personalizing generation.

    Personalization is optional: if the profile can't be read, generation still
    proceeds with a general quiz rather than failing the request.
    """
    try:
        grade_or_age = supabase.get_user_grade(user_id)
        profile = supabase.get_profile_row(user_id)
    except supabase.SupabaseError:
        return None, None
    subjects = profile["focus_subjects"] if profile else None
    return grade_or_age, subjects


@quiz_bp.post("/generate")
@require_auth
def generate_quiz():
    payload = request.get_json(silent=True) or {}
    source = payload.get("source", "profile")
    if source not in ("profile", "material", "text"):
        return _error(
            "validation_error", "source must be 'profile', 'material' or 'text'", 400
        )

    has_debt = quiz_repo.get_debt_flag(g.user_id)
    question_count = (
        current_app.config["QUIZ_LEN_DEBT"]
        if has_debt
        else current_app.config["QUIZ_LEN_NORMAL"]
    )
    locale = request.headers.get("Accept-Language", "en").split(",")[0] or "en"

    # Resolve the generation context from the requested source.
    subjects = None
    material_text = None
    grade_or_age, subjects = _profile_context(g.user_id)

    if source == "material":
        material_id = payload.get("material_id")
        if not isinstance(material_id, str) or not material_id:
            return _error(
                "validation_error", "material_id is required for source=material", 400
            )
        try:
            material = knowledge_repo.get_material(material_id, g.user_id)
        except supabase.SupabaseError:
            return _error("internal_error", "Could not read material.", 500)
        if material is None:
            return _error("not_found", "material not found", 404)
        material_text = material["raw_text"]
    elif source == "text":
        text = payload.get("text")
        if not isinstance(text, str) or not text.strip():
            return _error("validation_error", "text is required for source=text", 400)
        material_text = text.strip()[: current_app.config["KNOWLEDGE_MAX_CHARS"]]

    questions = generate_quiz_questions(
        count=question_count,
        subjects=subjects,
        grade_or_age=grade_or_age,
        material_text=material_text,
        locale=locale,
    )
    quiz_id = quiz_repo.create_quiz(g.user_id, questions)
    return jsonify(
        {
            "quiz_id": quiz_id,
            "user_id": g.user_id,
            "source": source,
            "question_count": len(questions),
            "questions": public_view(questions),  # answers omitted (security)
            "generated_at": _now_iso(),
        }
    )


@quiz_bp.post("/submit")
@require_auth
def submit_quiz():
    payload = request.get_json(silent=True) or {}
    quiz_id = payload.get("quiz_id")
    answers = payload.get("answers")
    if not isinstance(quiz_id, str) or not isinstance(answers, list):
        return _error("validation_error", "quiz_id and answers[] are required", 400)

    # Normalize answers to {question_id: selected_index|None}.
    answer_map: dict[str, int | None] = {}
    for answer in answers:
        if not isinstance(answer, dict):
            return _error("validation_error", "each answer must be an object", 400)
        answer_id = answer.get("id")
        selected_index = answer.get("selected_index")
        if not isinstance(answer_id, str):
            return _error("validation_error", "answer.id must be a string", 400)
        # bool is a subclass of int in Python — reject it explicitly so JSON
        # true/false can't be silently graded as index 1/0.
        if selected_index is not None and (
            isinstance(selected_index, bool) or not isinstance(selected_index, int)
        ):
            return _error(
                "validation_error", "selected_index must be an integer or null", 400
            )
        answer_map[answer_id] = selected_index

    # A malformed id can't exist; answering 404 here also spares PostgREST a
    # guaranteed uuid-cast error (which would surface as a 500).
    if not _is_uuid(quiz_id):
        return _error("not_found", "quiz not found", 404)

    quiz = quiz_repo.get_quiz(quiz_id, g.user_id)
    if quiz is None:
        return _error("not_found", "quiz not found", 404)
    if quiz.get("submitted_at") is not None:
        return _error("conflict", "quiz already submitted", 409)

    questions = quiz["questions"]
    explainer = get_explainer()
    locale = request.headers.get("Accept-Language", "en").split(",")[0] or "en"

    correct_count = 0
    results = []
    for question in questions:
        selected_index = answer_map.get(question["id"])
        is_correct = selected_index == question["correct_index"]
        explanation = None
        if is_correct:
            correct_count += 1
        else:
            explanation = explainer.explain(
                prompt=question["prompt"],
                options=question["options"],
                correct_index=question["correct_index"],
                selected_index=selected_index,
                concept=question.get("concept"),
                locale=locale,
            )
        results.append(
            {
                "id": question["id"],
                "correct": is_correct,
                "selected_index": selected_index,
                "correct_index": question["correct_index"],
                "explanation": explanation,
            }
        )

    earned_seconds = _reward_seconds(correct_count)
    target = current_app.config["QUIZ_CORRECT_TARGET"]
    had_debt = quiz_repo.get_debt_flag(g.user_id)
    sos_debt_cleared = had_debt and correct_count >= target

    # Atomic: idempotent submit + balance credit + history + debt clear.
    try:
        new_balance = quiz_repo.submit_reward(
            user_id=g.user_id,
            quiz_id=quiz_id,
            correct_count=correct_count,
            earned_seconds=earned_seconds,
            clear_debt=sos_debt_cleared,
        )
    except QuizAlreadySubmitted:
        return _error("conflict", "quiz already submitted", 409)

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
            "submitted_at": _now_iso(),
        }
    )
