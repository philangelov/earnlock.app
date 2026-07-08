"""Knowledge Import routes — POST /knowledge/import, GET /knowledge.

The repo is replaced with an in-memory fake so these exercise the route logic (auth,
validation, link fetching, whitespace/length normalization, owner-scoped listing) with
no live DB or real network access. HTML-stripping itself is covered by
test_text_extraction.py; here fetch_url_text is mocked to return already-extracted text.
"""

from unittest.mock import patch

import pytest

from app.repos import knowledge_repo
from app.text_extraction import FetchError
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
    resp = client.post(
        "/knowledge/import", json={"source_type": "text", "raw_text": "hi"}
    )
    assert resp.status_code == 401


def test_import_rejects_missing_body(client, auth_headers, fake_knowledge):
    resp = client.post("/knowledge/import", headers=auth_headers, json={})
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "validation_error"


def test_import_rejects_bad_source_type(client, auth_headers, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "pdf", "raw_text": "hi"},
    )
    assert resp.status_code == 400


def test_import_rejects_empty_raw_text(client, auth_headers, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "text", "raw_text": "   "},
    )
    assert resp.status_code == 400


def test_import_rejects_invalid_url(client, auth_headers, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "link", "url": "not-a-url"},
    )
    assert resp.status_code == 400


def test_import_stores_and_normalizes(client, auth_headers, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={
            "source_type": "text",
            "raw_text": "  Photosynthesis   turns\n\nlight   into sugar.  ",
        },
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["source_type"] == "text"
    assert body["material_id"] == "mat-1"
    # whitespace collapsed
    stored = fake_knowledge["rows"][0]["raw_text"]
    assert stored == "Photosynthesis turns light into sugar."
    assert body["preview"] == stored


def test_import_caps_length(client, auth_headers, fake_knowledge, monkeypatch):
    monkeypatch.setitem(client.application.config, "KNOWLEDGE_MAX_CHARS", 50)
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "text", "raw_text": "x" * 200},
    )
    assert resp.status_code == 201
    stored = fake_knowledge["rows"][0]["raw_text"]
    assert len(stored) <= 50


def test_import_fetches_link_and_persists_extracted_text(
    client, auth_headers, fake_knowledge
):
    with patch(
        "app.routes.knowledge.fetch_url_text",
        return_value="Real   article\ntext.",
    ) as fake_fetch:
        resp = client.post(
            "/knowledge/import",
            headers=auth_headers,
            json={"source_type": "link", "url": "https://example.com/article"},
        )

    fake_fetch.assert_called_once()
    assert fake_fetch.call_args.args[0] == "https://example.com/article"
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["source_type"] == "link"
    stored = fake_knowledge["rows"][0]["raw_text"]
    assert stored == "Real article text."


def test_import_returns_422_when_link_fetch_fails(client, auth_headers, fake_knowledge):
    with patch("app.routes.knowledge.fetch_url_text", side_effect=FetchError("boom")):
        resp = client.post(
            "/knowledge/import",
            headers=auth_headers,
            json={"source_type": "link", "url": "https://example.com/dead"},
        )
    assert resp.status_code == 422
    assert resp.get_json()["error"]["code"] == "unprocessable"


def test_list_returns_materials_with_preview(client, auth_headers, fake_knowledge):
    client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "text", "raw_text": "First material text"},
    )
    client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "text", "raw_text": "Second material text"},
    )
    resp = client.get("/knowledge", headers=auth_headers)
    assert resp.status_code == 200
    materials = resp.get_json()["materials"]
    assert len(materials) == 2
    # newest first
    assert materials[0]["preview"].startswith("Second")
    assert {"material_id", "source_type", "preview", "created_at"} <= set(materials[0])
    assert TEST_USER_ID  # sanity: fixtures authenticate as this user


def test_list_requires_auth(client, fake_knowledge):
    assert client.get("/knowledge").status_code == 401
