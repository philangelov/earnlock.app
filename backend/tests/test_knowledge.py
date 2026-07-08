"""Knowledge Import routes — POST /knowledge/import, GET /knowledge.

The repo is replaced with an in-memory fake so these exercise the route logic (auth,
validation, whitespace/length normalization, owner-scoped listing) with no live DB.
"""

import pytest

from app.repos import knowledge_repo
from tests.conftest import TEST_USER_ID


@pytest.fixture
def fake_knowledge(monkeypatch):
    store = {"rows": [], "n": 0}

    def create_material(user_id, raw_text, source_type):
        store["n"] += 1
        row = {
            "id": f"mat-{store['n']}",
            "user_id": user_id,
            "raw_text": raw_text,
            "source_type": source_type,
            "created_at": "2026-07-08T00:00:00Z",
        }
        store["rows"].append(row)
        return {
            "id": row["id"],
            "source_type": source_type,
            "created_at": row["created_at"],
        }

    def list_materials(user_id):
        return [dict(r) for r in reversed(store["rows"]) if r["user_id"] == user_id]

    def get_material(material_id, user_id):
        for r in store["rows"]:
            if r["id"] == material_id and r["user_id"] == user_id:
                return dict(r)
        return None

    monkeypatch.setattr(knowledge_repo, "create_material", create_material)
    monkeypatch.setattr(knowledge_repo, "list_materials", list_materials)
    monkeypatch.setattr(knowledge_repo, "get_material", get_material)
    return store


def test_import_requires_auth(client, fake_knowledge):
    resp = client.post("/knowledge/import", json={"text": "hi"})
    assert resp.status_code == 401


def test_import_rejects_missing_text(client, auth_headers, fake_knowledge):
    resp = client.post("/knowledge/import", headers=auth_headers, json={})
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "validation_error"


def test_import_rejects_bad_source_type(client, auth_headers, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"text": "hi", "source_type": "pdf"},
    )
    assert resp.status_code == 400


def test_import_stores_and_normalizes(client, auth_headers, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"text": "  Photosynthesis   turns\n\nlight   into sugar.  "},
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["source_type"] == "text"
    assert body["id"] == "mat-1"
    # whitespace collapsed
    stored = fake_knowledge["rows"][0]["raw_text"]
    assert stored == "Photosynthesis turns light into sugar."
    assert body["char_count"] == len(stored)


def test_import_caps_length(client, auth_headers, fake_knowledge, monkeypatch):
    monkeypatch.setitem(client.application.config, "KNOWLEDGE_MAX_CHARS", 50)
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"text": "x" * 200},
    )
    assert resp.status_code == 201
    assert resp.get_json()["char_count"] <= 50


def test_import_accepts_link_source(client, auth_headers, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"text": "Fetched article body", "source_type": "link"},
    )
    assert resp.status_code == 201
    assert resp.get_json()["source_type"] == "link"


def test_list_returns_materials_with_preview(client, auth_headers, fake_knowledge):
    client.post(
        "/knowledge/import", headers=auth_headers, json={"text": "First material text"}
    )
    client.post(
        "/knowledge/import", headers=auth_headers, json={"text": "Second material text"}
    )
    resp = client.get("/knowledge", headers=auth_headers)
    assert resp.status_code == 200
    materials = resp.get_json()["materials"]
    assert len(materials) == 2
    # newest first
    assert materials[0]["preview"].startswith("Second")
    assert {"id", "source_type", "char_count", "preview", "created_at"} <= set(
        materials[0]
    )
    assert TEST_USER_ID  # sanity: fixtures authenticate as this user


def test_list_requires_auth(client, fake_knowledge):
    assert client.get("/knowledge").status_code == 401
