"""Data access for imported study material, on the service-role PostgREST client.

Backs POST /knowledge/import, GET /knowledge, DELETE /knowledge/<id>, and is read by
/quiz/generate when ``source=material``. Uses app/services/supabase.py so there is one
Supabase access path and no extra HTTP dependency. The knowledge_materials table
(migrations 0004 + 0016) is owner-readable via RLS; all writes go through the backend
here. Deleting a material cascades its material_stats and nulls any quizzes.material_id.
"""

from app.services.supabase import _rest_request


def create_material(
    user_id: str, raw_text: str, source_type: str, title: str = ""
) -> dict:
    """Persist an imported material; return {id, title, source_type, created_at}."""
    rows, _ = _rest_request(
        "POST",
        "knowledge_materials",
        body={
            "user_id": user_id,
            "raw_text": raw_text,
            "source_type": source_type,
            "title": title,
        },
        prefer="return=representation",
    )
    row = rows[0]
    return {
        "id": row["id"],
        "title": row.get("title", ""),
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
            "select": "id,title,source_type,raw_text,created_at",
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
            "select": "id,title,source_type,raw_text,created_at",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


def delete_material(material_id: str, user_id: str) -> bool:
    """Delete one material owned by the user. Returns True if a row was removed.

    The user_id filter is the owner check: PostgREST deletes only matching rows, so a
    material that isn't theirs (or doesn't exist) removes nothing and returns False.
    """
    rows, _ = _rest_request(
        "DELETE",
        "knowledge_materials",
        params={"id": f"eq.{material_id}", "user_id": f"eq.{user_id}"},
        prefer="return=representation",
    )
    return bool(rows)
