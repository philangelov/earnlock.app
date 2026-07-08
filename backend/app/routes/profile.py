from flask import Blueprint, g, jsonify, request

from app.middleware.auth import require_auth
from app.services import supabase
from app.validation import ValidationError, validate_profile_update

profile_bp = Blueprint("profile", __name__, url_prefix="/profile")


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _serialize(user_id, grade_or_age, profile_row):
    """Build the GET/PUT /profile response body from the two source rows."""
    return {
        "user_id": user_id,
        "grade_or_age": grade_or_age,
        "focus_subjects": profile_row["focus_subjects"],
        "sos_debt_flag": profile_row["sos_debt_flag"],
        "last_sos_date": profile_row["last_sos_date"],
        "wakeup_completed_date": profile_row["wakeup_completed_date"],
    }


@profile_bp.get("")
@require_auth
def get_profile():
    user_id = g.user_id
    try:
        grade_or_age = supabase.get_user_grade(user_id)
        profile_row = supabase.get_profile_row(user_id)
    except supabase.SupabaseError:
        return _error("internal_error", "Could not read profile.", 500)

    if grade_or_age is None or profile_row is None:
        return _error("not_found", "Profile does not exist.", 404)

    return jsonify(_serialize(user_id, grade_or_age, profile_row)), 200


@profile_bp.put("")
@require_auth
def update_profile():
    user_id = g.user_id
    body = request.get_json(silent=True)

    try:
        user_fields, profile_fields = validate_profile_update(body or {})
    except ValidationError as exc:
        return _error("validation_error", str(exc), 400)

    try:
        if user_fields:
            supabase.update_user_grade(user_id, user_fields["grade_or_age"])
        if profile_fields:
            supabase.update_profile_subjects(user_id, profile_fields["focus_subjects"])

        grade_or_age = supabase.get_user_grade(user_id)
        profile_row = supabase.get_profile_row(user_id)
    except supabase.SupabaseError:
        return _error("internal_error", "Could not update profile.", 500)

    if grade_or_age is None or profile_row is None:
        return _error("not_found", "Profile does not exist.", 404)

    return jsonify(_serialize(user_id, grade_or_age, profile_row)), 200
