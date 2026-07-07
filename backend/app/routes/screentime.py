from flask import Blueprint, g, jsonify

from app.middleware.auth import require_auth
from app.services import supabase

screentime_bp = Blueprint("screentime", __name__, url_prefix="/screentime")


@screentime_bp.get("/balance")
@require_auth
def get_balance():
    """Server-authoritative balance sync point.

    The wallet is a stored integer (public.screentime_balance), credited by
    /quiz/submit and /sos — never derived from a client-supplied timestamp. So there is
    no elapsed-time math to trust or distrust here: the client cannot move this number
    by changing its device clock, it can only ask the server what the number currently
    is. A cold-start user (row not yet provisioned, or race with the signup trigger)
    gets an explicit zero balance instead of a 404/500.
    """
    try:
        row = supabase.get_screentime_balance(g.user_id)
    except supabase.SupabaseError:
        return jsonify({"error": {
            "code": "internal_error", "message": "Could not read balance.",
        }}), 500

    if row is None:
        return jsonify({"remaining_seconds": 0, "updated_at": None}), 200

    return jsonify(row), 200
