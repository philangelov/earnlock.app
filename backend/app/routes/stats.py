"""Learning statistics — the read behind the Insights tab and the Learn roadmap.

One endpoint, one query: totals, streak, a 7-day series, subject mastery, and the
recent attempts the roadmap lays out as nodes. Every figure is derived from what the
user actually did; a fresh account gets zeros and an explicit `null` accuracy rather
than a flattering default.
"""

from flask import Blueprint, g, jsonify, request

from app.middleware.auth import require_auth
from app.repos import stats_repo
from app.services import supabase

stats_bp = Blueprint("stats", __name__, url_prefix="/stats")

# Sanity-clamp the client's UTC offset to +/-14:00 (-840..840 minutes) -- a symmetric
# superset of the real civil range (UTC-12:00 .. UTC+14:00) -- matching the guard inside
# user_stats(). Anything outside it is a client bug, not a timezone.
_MIN_TZ_OFFSET = -840
_MAX_TZ_OFFSET = 840


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


@stats_bp.get("")
@require_auth
def get_stats():
    raw_offset = request.args.get("tz_offset", "0")
    try:
        tz_offset = int(raw_offset)
    except (TypeError, ValueError):
        return _error("validation_error", "tz_offset must be an integer.", 400)

    if not _MIN_TZ_OFFSET <= tz_offset <= _MAX_TZ_OFFSET:
        return _error(
            "validation_error",
            f"tz_offset must be between {_MIN_TZ_OFFSET} and {_MAX_TZ_OFFSET} minutes.",
            400,
        )

    try:
        stats = stats_repo.get_user_stats(g.user_id, tz_offset)
    except supabase.SupabaseError:
        return _error("internal_error", "Could not read stats.", 500)

    return jsonify(stats), 200
