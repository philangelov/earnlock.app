"""Data access for imported study material, on the service-role PostgREST client.

Backs POST /knowledge/import and GET /knowledge, and is read by /quiz/generate when
``source=material``. Uses app/services/supabase.py so there is one Supabase access path
and no extra HTTP dependency. The knowledge_materials table (migration 0004) is
owner-readable via RLS; all writes go through the backend here.
"""

from app.services.supabase import _rest_request


def create_material(user_id: str, raw_text: str, source_type: str) -> dict:
    """Persist an imported material and return its {id, source_type, created_at}."""
    rows, _ = _rest_request(
        "POST",
        "knowledge_materials",
        body={"user_id": user_id, "raw_text": raw_text, "source_type": source_type},
        prefer="return=representation",
    )
    row = rows[0]
    return {
        "id": row["id"],
        "source_type": row["source_type"],
        "created_at": row["created_at"],
    }


def list_materials(user_id: str) -> list[dict]:
    """Return the user's materials (newest first) with full text for previews."""
    rows, _ = _rest_request(
        "GET",
        "knowledge_materials",
        params={
            "user_id": f"eq.{user_id}",
            "select": "id,source_type,raw_text,created_at",
            "order": "created_at.desc",
        },
    )
    return rows or []


def get_material(material_id: str, user_id: str) -> dict | None:
    """Load one material owned by the user, or None if missing / not theirs."""
    rows, _ = _rest_request(
        "GET",
        "knowledge_materials",
        params={
            "id": f"eq.{material_id}",
            "user_id": f"eq.{user_id}",
            "select": "id,source_type,raw_text,created_at",
            "limit": "1",
        },
    )
    return rows[0] if rows else None
