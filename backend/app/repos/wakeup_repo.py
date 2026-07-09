"""Data access for the Wake-Up Lock (docs/api-contract.md §8), on the service-role
PostgREST client. Reuses app/services/supabase.py so there is one Supabase access path.

Completion is idempotent per calendar day at the database layer: the UPDATE below only
matches a row when wakeup_completed_date is NULL or a different date, so two concurrent
completion attempts can't both "win" — Postgres resolves the race atomically inside the
single UPDATE statement, not in this process.
"""

from app.services.supabase import _rest_request, get_profile_row


def get_wakeup_completed_date(user_id: str) -> str | None:
    """Read profiles.wakeup_completed_date; None if unset or the profile is absent."""
    profile = get_profile_row(user_id)
    return profile["wakeup_completed_date"] if profile else None


def mark_completed_if_not_today(user_id: str, today: str) -> bool:
    """Set wakeup_completed_date = today, unless it's already marked for today.

    Returns True if this call performed the update, False if it was already completed
    for `today` — the caller should treat False as a 409 conflict.
    """
    rows, _ = _rest_request(
        "PATCH",
        "profiles",
        params={
            "user_id": f"eq.{user_id}",
            "or": f"(wakeup_completed_date.is.null,wakeup_completed_date.neq.{today})",
        },
        body={"wakeup_completed_date": today},
        prefer="return=representation",
    )
    return bool(rows)
