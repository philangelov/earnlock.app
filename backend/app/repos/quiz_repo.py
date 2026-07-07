"""Data access for the quiz engine (Supabase / Postgres, service-role).

Keeps all persistence in one place so the routes stay thin and the layer is trivially
mockable in tests. The reward credit is applied through a single Postgres function
(`submit_quiz_reward`, migration 0010) so balance update + history insert + debt clear +
the "already submitted" guard all happen in one atomic transaction — no double
rewards from rapid-fire submits, even across workers/restarts.
"""

from app.db import get_supabase


class QuizAlreadySubmitted(Exception):
    """Raised when a quiz_id has already been scored (idempotency guard)."""


# Sentinel raised by the submit_quiz_reward SQL function on a duplicate submit.
_ALREADY_SUBMITTED_MARKER = "quiz_already_submitted"


def create_quiz(user_id: str, questions: list[dict]) -> str:
    """Persist a generated quiz (questions incl. answer keys) and return its id."""
    resp = (
        get_supabase()
        .table("quizzes")
        .insert({"user_id": user_id, "questions": questions})
        .execute()
    )
    return resp.data[0]["id"]


def get_quiz(quiz_id: str, user_id: str) -> dict | None:
    """Load a quiz owned by the user, or None if it does not exist / isn't theirs."""
    resp = (
        get_supabase()
        .table("quizzes")
        .select("id, user_id, questions, submitted_at")
        .eq("id", quiz_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


def get_debt_flag(user_id: str) -> bool:
    """Read profiles.sos_debt_flag; False if the profile row is absent."""
    resp = (
        get_supabase()
        .table("profiles")
        .select("sos_debt_flag")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return bool(rows[0]["sos_debt_flag"]) if rows else False


def submit_reward(
    user_id: str,
    quiz_id: str,
    correct_count: int,
    earned_seconds: int,
    clear_debt: bool,
) -> int:
    """Atomically mark the quiz submitted, credit the balance, append history, and clear
    the SOS debt flag if satisfied. Returns the new balance in seconds.

    Raises QuizAlreadySubmitted if the quiz was already scored.
    """
    try:
        resp = (
            get_supabase()
            .rpc(
                "submit_quiz_reward",
                {
                    "p_user_id": user_id,
                    "p_quiz_id": quiz_id,
                    "p_correct_count": correct_count,
                    "p_earned_seconds": earned_seconds,
                    "p_clear_debt": clear_debt,
                },
            )
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — normalize the driver's error
        if _ALREADY_SUBMITTED_MARKER in str(exc):
            raise QuizAlreadySubmitted(quiz_id) from exc
        raise
    return int(resp.data)
