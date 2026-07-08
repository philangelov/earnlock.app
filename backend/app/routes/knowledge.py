"""Knowledge Import — store study material a learner can generate quizzes from.

POST /knowledge/import accepts pasted text or a URL; for a URL, the server fetches the
page and strips it down to plain text itself (docs/api-contract.md §4) — the client
never scrapes pages. GET /knowledge lists it. /quiz/generate reads a stored material by
id (source=material) to produce questions grounded in that text. All access is
owner-scoped: the repo writes with the service role and reads are filtered by user_id.
"""

from flask import Blueprint, current_app, g, jsonify, request

from app.middleware.auth import require_auth
from app.repos import knowledge_repo
from app.services.supabase import SupabaseError
from app.text_extraction import FetchError, fetch_url_text, normalize_whitespace
from app.validation import ValidationError, validate_knowledge_import

knowledge_bp = Blueprint("knowledge", __name__, url_prefix="/knowledge")

# "preview is the first ~200 chars of the normalized text" — docs/api-contract.md §4.
_PREVIEW_CHARS = 200


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _normalize_and_cap(text, max_chars):
    return normalize_whitespace(text)[:max_chars].rstrip()


@knowledge_bp.post("/import")
@require_auth
def import_material():
    try:
        source_type, raw_text, url = validate_knowledge_import(
            request.get_json(silent=True) or {}
        )
    except ValidationError as exc:
        return _error("validation_error", str(exc), 400)

    if source_type == "link":
        try:
            extracted = fetch_url_text(
                url,
                timeout=current_app.config["KNOWLEDGE_FETCH_TIMEOUT_SECONDS"],
                max_bytes=current_app.config["KNOWLEDGE_FETCH_MAX_BYTES"],
            )
        except FetchError as exc:
            return _error("unprocessable", str(exc), 422)
        text = _normalize_and_cap(extracted, current_app.config["KNOWLEDGE_MAX_CHARS"])
    else:
        text = _normalize_and_cap(raw_text, current_app.config["KNOWLEDGE_MAX_CHARS"])

    try:
        material = knowledge_repo.create_material(g.user_id, text, source_type)
    except SupabaseError:
        return _error("internal_error", "Could not save material.", 500)

    return (
        jsonify(
            {
                "material_id": material["id"],
                "source_type": material["source_type"],
                "preview": text[:_PREVIEW_CHARS],
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
            "material_id": row["id"],
            "source_type": row["source_type"],
            "preview": row["raw_text"][:_PREVIEW_CHARS],
            "created_at": row["created_at"],
        }
        for row in rows
    ]
    return jsonify({"materials": materials}), 200
