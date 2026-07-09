"""Wake-Up Lock — morning restriction status + completion (docs/api-contract.md §8).

GET /wakeup/status reports whether today's lock is still active (i.e. not yet cleared).
POST /wakeup/complete clears it for today, but only once, and only for a real
completion: quiz_id must point at a quiz the caller owns that was actually submitted
*today* (server clock, UTC) — a quiz submitted on a prior day can't be replayed to clear
today's lock, and there's no client-supplied date/timestamp anywhere in this flow for a
client to manipulate. The "already completed today" case is guarded by an atomic
conditional update (app/repos/wakeup_repo.py) rather than a check-then-write, so a
duplicate/concurrent call gets a clean 409 instead of a second silent success.

Daily reset is implicit: "today" is always the server's current UTC date, so the lock
reappears automatically at UTC midnight with no separate reset job. required_questions
is informational for the client; this endpoint doesn't itself generate the wake-up quiz
(that's POST /quiz/generate) or enforce its exact length.
"""

from datetime import UTC, datetime

from flask import Blueprint, current_app, g, jsonify, request

from app.middleware.auth import require_auth
from app.repos import quiz_repo, wakeup_repo
from app.services.supabase import SupabaseError
from app.validation import is_valid_uuid

wakeup_bp = Blueprint("wakeup", __name__, url_prefix="/wakeup")


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _today() -> str:
    return datetime.now(UTC).date().isoformat()


@wakeup_bp.get("/status")
@require_auth
def status():
    try:
        completed_date = wakeup_repo.get_wakeup_completed_date(g.user_id)
    except SupabaseError:
        return _error("internal_error", "Could not read wake-up status.", 500)

    completed_today = completed_date == _today()
    return jsonify(
        {
            "active": not completed_today,
            "required_questions": current_app.config["WAKEUP_QUESTIONS"],
            "completed_today": completed_today,
        }
    )


@wakeup_bp.post("/complete")
@require_auth
def complete():
    payload = request.get_json(silent=True) or {}
    quiz_id = payload.get("quiz_id")
    if not isinstance(quiz_id, str) or not quiz_id:
        return _error("validation_error", "quiz_id is required", 400)

    # A malformed id can't exist; answering 404 here also spares PostgREST a
    # guaranteed uuid-cast error (which would surface as a 500).
    if not is_valid_uuid(quiz_id):
        return _error("not_found", "quiz not found", 404)

    try:
        quiz = quiz_repo.get_quiz(quiz_id, g.user_id)
    except SupabaseError:
        return _error("internal_error", "Could not verify quiz.", 500)

    if quiz is None:
        return _error("not_found", "quiz not found", 404)

    today = _today()
    submitted_at = quiz.get("submitted_at")
    if submitted_at is None or not submitted_at.startswith(today):
        return _error(
            "validation_error", "quiz_id must reference a quiz submitted today", 400
        )

    try:
        updated = wakeup_repo.mark_completed_if_not_today(g.user_id, today)
    except SupabaseError:
        return _error("internal_error", "Could not save wake-up completion.", 500)

    if not updated:
        return _error("conflict", "wake-up already completed today", 409)

    return jsonify({"completed": True, "wakeup_completed_date": today})
