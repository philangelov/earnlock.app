"""Knowledge Import — store study material a learner can generate quizzes from.

POST /knowledge/import accepts pasted text or a URL; for a URL, the server fetches the
page and strips it down to plain text itself (docs/api-contract.md §4) — the client
never scrapes pages. GET /knowledge lists it, DELETE /knowledge/<id> removes one.
/quiz/generate reads a stored material by id (source=material) to produce questions
grounded in that text, and records which material each quiz came from so understanding
is tracked per material. All access is owner-scoped: the repo writes with the service
role and reads are filtered by user_id.
"""

from flask import Blueprint, current_app, g, jsonify, request

from app.ai import (
    SUPPORTED_MEDIA_TYPES,
    DocumentExtractionError,
    get_document_extractor,
)
from app.middleware.auth import require_auth
from app.repos import knowledge_repo
from app.services.supabase import SupabaseError
from app.text_extraction import FetchError, fetch_url_text, normalize_whitespace
from app.validation import (
    ValidationError,
    is_valid_uuid,
    validate_file_import,
    validate_knowledge_import,
)

knowledge_bp = Blueprint("knowledge", __name__, url_prefix="/knowledge")

# "preview is the first ~200 chars of the normalized text" — docs/api-contract.md §4.
_PREVIEW_CHARS = 200
# A material's display name is short — a chip/row title, not a paragraph.
_TITLE_CHARS = 80


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _normalize_and_cap(text, max_chars):
    return normalize_whitespace(text)[:max_chars].rstrip()


def _resolve_title(client_title, text):
    """Use the client's title if it sent a usable one, else derive one from the text.

    The derived title is the opening of the material, cut at a word boundary so it reads
    as a name rather than a truncated sentence.
    """
    if isinstance(client_title, str) and client_title.strip():
        return normalize_whitespace(client_title)[:_TITLE_CHARS].rstrip()
    if len(text) <= _TITLE_CHARS:
        return text
    head = text[: _TITLE_CHARS + 1]
    cut = head.rsplit(" ", 1)[0] if " " in head else text[:_TITLE_CHARS]
    return (cut or text[:_TITLE_CHARS]).rstrip() + "…"


def _title_from_filename(filename):
    """Turn an uploaded file's name into a material title (drop the extension)."""
    if not filename:
        return None
    base = filename.rsplit(".", 1)[0] if "." in filename else filename
    return base.strip() or None


def _import_file(body):
    """Import an uploaded file: validate it, transcribe it to text, store the text."""
    try:
        data_b64, media_type, filename = validate_file_import(
            body,
            allowed_media_types=SUPPORTED_MEDIA_TYPES,
            max_bytes=current_app.config["KNOWLEDGE_FILE_MAX_BYTES"],
        )
    except ValidationError as exc:
        return _error("validation_error", str(exc), 400)

    try:
        extractor = get_document_extractor()
        extracted = extractor.extract(data_b64=data_b64, media_type=media_type)
    except DocumentExtractionError as exc:
        # The file was well-formed but we couldn't get usable text out of it (or AI is
        # not configured) — a 422 shown as "try a clearer photo / paste instead".
        return _error("unprocessable", str(exc), 422)

    text = _normalize_and_cap(extracted, current_app.config["KNOWLEDGE_MAX_CHARS"])
    if not text:
        return _error(
            "unprocessable", "No study text could be read from that file.", 422
        )

    # Prefer the file's name as the title; fall back to a title derived from the text.
    title = _resolve_title(_title_from_filename(filename) or body.get("title"), text)

    try:
        material = knowledge_repo.create_material(g.user_id, text, "file", title)
    except SupabaseError:
        return _error("internal_error", "Could not save material.", 500)

    return (
        jsonify(
            {
                "material_id": material["id"],
                "title": material["title"],
                "source_type": material["source_type"],
                "preview": text[:_PREVIEW_CHARS],
                "created_at": material["created_at"],
            }
        ),
        201,
    )


@knowledge_bp.post("/import")
@require_auth
def import_material():
    body = request.get_json(silent=True) or {}

    # A file (PDF/photo) is its own path: the bytes are transcribed to study text by the
    # AI model before anything is stored, so downstream sees an ordinary text material.
    if body.get("source_type") == "file":
        return _import_file(body)

    try:
        source_type, raw_text, url = validate_knowledge_import(body)
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

    title = _resolve_title(body.get("title"), text)

    try:
        material = knowledge_repo.create_material(g.user_id, text, source_type, title)
    except SupabaseError:
        return _error("internal_error", "Could not save material.", 500)

    return (
        jsonify(
            {
                "material_id": material["id"],
                "title": material["title"],
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
            "title": row.get("title", ""),
            "source_type": row["source_type"],
            "preview": row["raw_text"][:_PREVIEW_CHARS],
            "created_at": row["created_at"],
        }
        for row in rows
    ]
    return jsonify({"materials": materials}), 200


@knowledge_bp.delete("/<material_id>")
@require_auth
def delete_material(material_id):
    # A malformed id can't belong to anyone; answer 404 rather than hand PostgREST a
    # guaranteed uuid-cast error (which would surface as a 500).
    if not is_valid_uuid(material_id):
        return _error("not_found", "material not found", 404)
    try:
        removed = knowledge_repo.delete_material(material_id, g.user_id)
    except SupabaseError:
        return _error("internal_error", "Could not delete material.", 500)
    if not removed:
        return _error("not_found", "material not found", 404)
    return jsonify({"material_id": material_id, "deleted": True}), 200
