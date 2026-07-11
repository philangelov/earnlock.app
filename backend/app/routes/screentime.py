"""The screen-time window — how long the shield stays off.

The wallet stores an instant (`screentime_balance.unlocked_until`), not a countdown.
Remaining seconds are computed here, against the server's clock, on every read. That
is what makes the number un-resettable: a client that relaunches, backgrounds for an
hour, or moves its own clock gets the same answer the server would give anyone.
"""

from datetime import UTC, datetime

from flask import Blueprint, g, jsonify

from app.middleware.auth import require_auth
from app.services import supabase

screentime_bp = Blueprint("screentime", __name__, url_prefix="/screentime")


def _remaining_seconds(unlocked_until: str | None) -> int:
    """Seconds left on the window, floored at zero. An unparseable instant reads as
    expired: refusing to shield because a timestamp was malformed is the wrong way
    to fail."""
    if not unlocked_until:
        return 0
    try:
        deadline = datetime.fromisoformat(unlocked_until)
    except ValueError:
        return 0
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=UTC)
    return max(0, int((deadline - datetime.now(UTC)).total_seconds()))


@screentime_bp.get("/balance")
@require_auth
def get_balance():
    """Server-authoritative sync point for the countdown and the native shield.

    A cold-start user (row not yet provisioned, or racing the signup trigger) gets an
    explicit zero rather than a 404/500.
    """
    try:
        row = supabase.get_screentime_window(g.user_id)
    except supabase.SupabaseError:
        return jsonify(
            {
                "error": {
                    "code": "internal_error",
                    "message": "Could not read balance.",
                }
            }
        ), 500

    if row is None:
        return jsonify(
            {"remaining_seconds": 0, "unlocked_until": None, "updated_at": None}
        ), 200

    return jsonify(
        {
            "remaining_seconds": _remaining_seconds(row.get("unlocked_until")),
            "unlocked_until": row.get("unlocked_until"),
            "updated_at": row.get("updated_at"),
        }
    ), 200
