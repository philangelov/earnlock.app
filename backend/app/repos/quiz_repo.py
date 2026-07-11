"""Data access for the quiz engine, on the backend's PostgREST service-role client.

Reuses app/services/supabase.py (the urllib/service_role layer used for profiles) so
there is one Supabase access path and no extra HTTP dependency. The reward credit runs
through the submit_quiz_reward Postgres function (migration 0010) so balance update +
history insert + debt clear + the "already submitted" guard are one atomic transaction —
no double rewards from rapid-fire submits, even across workers/restarts.
"""

from app.services.supabase import SupabaseError, _rest_request, get_profile_row


class QuizAlreadySubmitted(Exception):
    """Raised when a quiz_id has already been scored (idempotency guard)."""


# Sentinel raised by the submit_quiz_reward SQL function on a duplicate submit.
_ALREADY_SUBMITTED_MARKER = "quiz_already_submitted"


def create_quiz(user_id: str, questions: list[dict]) -> str:
    """Persist a generated quiz (questions incl. answer keys) and return its id."""
    rows, _ = _rest_request(
        "POST",
        "quizzes",
        body={"user_id": user_id, "questions": questions},
        prefer="return=representation",
    )
    return rows[0]["id"]


def get_quiz(quiz_id: str, user_id: str) -> dict | None:
    """Load a quiz owned by the user, or None if it does not exist / isn't theirs."""
    rows, _ = _rest_request(
        "GET",
        "quizzes",
        params={
            "id": f"eq.{quiz_id}",
            "user_id": f"eq.{user_id}",
            "select": "id,user_id,questions,submitted_at",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


def get_debt_flag(user_id: str) -> bool:
    """Read profiles.sos_debt_flag; False if the profile row is absent."""
    profile = get_profile_row(user_id)
    return bool(profile["sos_debt_flag"]) if profile else False


def submit_reward(
    user_id: str,
    quiz_id: str,
    correct_count: int,
    total_count: int,
    earned_seconds: int,
    clear_debt: bool,
    subject_stats: list[dict] | None = None,
) -> int:
    """Atomically mark the quiz submitted, credit the balance, append history, fold in
    the per-subject tallies, and clear the SOS debt flag if satisfied. Returns the new
    balance in seconds.

    `subject_stats` is `[{subject, correct, total}]` for this attempt (see
    `quiz_content.subject_tally`); it is accumulated into `public.subject_stats` inside
    the same transaction, so mastery can never drift from the history it summarizes.

    Raises QuizAlreadySubmitted if the quiz was already scored.
    """
    try:
        result, _ = _rest_request(
            "POST",
            "rpc/submit_quiz_reward",
            body={
                "p_user_id": user_id,
                "p_quiz_id": quiz_id,
                "p_correct_count": correct_count,
                "p_total_count": total_count,
                "p_earned_seconds": earned_seconds,
                "p_clear_debt": clear_debt,
                "p_subject_stats": subject_stats or [],
            },
        )
    except SupabaseError as exc:
        if _ALREADY_SUBMITTED_MARKER in str(exc):
            raise QuizAlreadySubmitted(quiz_id) from exc
        raise
    return int(result)
