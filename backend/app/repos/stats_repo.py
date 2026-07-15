"""Read model for the Insights and Learn surfaces.

Everything the app renders as a number — streak, accuracy, minutes learned per day,
subject mastery, the roadmap's node list — is derived here from `quiz_history`,
`subject_stats` and `screentime_balance`. Nothing is stored twice and nothing is
guessed: if the user has never taken a quiz, the aggregates come back as zeros and
nulls, and the screens are expected to render an empty state rather than a plausible
lie.

The whole read is one `user_stats()` RPC (migration 0014) rather than four PostgREST
round trips, because a streak computed from one snapshot and an accuracy computed from
a later one can disagree with each other.
"""

from app.services.supabase import _rest_request

# What the RPC returns for a user who has never submitted a quiz. Also the shape the
# route falls back to, so a brand-new account renders an empty Insights tab instead of
# a 500.
EMPTY_STATS: dict = {
    "totals": {
        "quizzes": 0,
        "questions_answered": 0,
        "questions_correct": 0,
        "accuracy": None,
        "earned_seconds": 0,
        "spent_seconds": 0,
        "remaining_seconds": 0,
    },
    "streak": {"current": 0, "best": 0, "active_today": False},
    "daily": [],
    "subjects": [],
    "materials": [],
    "recent": [],
}


def get_user_stats(user_id: str, tz_offset_minutes: int = 0) -> dict:
    """Every aggregate for one user, bucketed into their local calendar days.

    `tz_offset_minutes` is the client's offset from UTC (`+120` for UTC+2). A streak is
    a local-calendar notion — a quiz finished at 23:30 in Sofia belongs to that day, not
    to the next one, which is what UTC bucketing would claim.
    """
    result, _ = _rest_request(
        "POST",
        "rpc/user_stats",
        body={"p_user_id": user_id, "p_tz_offset_minutes": tz_offset_minutes},
    )
    return result if isinstance(result, dict) else dict(EMPTY_STATS)
