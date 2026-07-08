"""Knowledge Import — store study material a learner can generate quizzes from.

POST /knowledge/import saves pasted study text (or already-fetched article text) for
the authenticated user; GET /knowledge lists it. /quiz/generate reads a stored material
by id (source=material) to produce questions grounded in that text. All access is
owner-scoped: the repo writes with the service role and reads are filtered by user_id.
"""

from flask import Blueprint, current_app, g, jsonify, request

from app.middleware.auth import require_auth
from app.repos import knowledge_repo
from app.services.supabase import SupabaseError
from app.validation import ValidationError, validate_knowledge_import

knowledge_bp = Blueprint("knowledge", __name__, url_prefix="/knowledge")

# How many characters of the stored text to echo back in the list view.
_PREVIEW_CHARS = 160


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


@knowledge_bp.post("/import")
@require_auth
def import_material():
    max_chars = current_app.config["KNOWLEDGE_MAX_CHARS"]
    try:
        raw_text, source_type = validate_knowledge_import(
            request.get_json(silent=True) or {}, max_chars
        )
    except ValidationError as exc:
        return _error("validation_error", str(exc), 400)

    try:
        material = knowledge_repo.create_material(g.user_id, raw_text, source_type)
    except SupabaseError:
        return _error("internal_error", "Could not save material.", 500)

    return (
        jsonify(
            {
                "id": material["id"],
                "source_type": material["source_type"],
                "char_count": len(raw_text),
                "created_at": material["created_at"],
            }
        ),
        201,
    )


@knowledge_bp.get("")
@require_auth
def list_materials():
    try:
        rows = knowledge_repo.list_materials(g.user_id)
    except SupabaseError:
        return _error("internal_error", "Could not read materials.", 500)

    materials = [
        {
            "id": row["id"],
            "source_type": row["source_type"],
            "char_count": len(row["raw_text"]),
            "preview": row["raw_text"][:_PREVIEW_CHARS],
            "created_at": row["created_at"],
        }
        for row in rows
    ]
    return jsonify({"materials": materials}), 200
