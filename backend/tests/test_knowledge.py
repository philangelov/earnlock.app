"""Knowledge Import routes — POST /knowledge/import, GET /knowledge.

The repo is replaced with an in-memory fake so these exercise the route logic (auth,
validation, link fetching, whitespace/length normalization, owner-scoped listing) with
no live DB or real network access. HTML-stripping itself is covered by
test_text_extraction.py; here fetch_url_text is mocked to return already-extracted text.
"""

import uuid
from unittest.mock import patch

import pytest

from app.repos import knowledge_repo
from app.text_extraction import FetchError
from tests.conftest import TEST_USER_ID


@pytest.fixture
def fake_knowledge(monkeypatch):
    store = {"rows": []}

    def create_material(user_id, raw_text, source_type, title=""):
        # Real UUIDs, matching production (knowledge_materials.id is uuid) — the delete
        # route rejects malformed ids before ever reaching the repo.
        row = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "raw_text": raw_text,
            "source_type": source_type,
            "title": title,
            "created_at": "2026-07-08T00:00:00Z",
        }
        store["rows"].append(row)
        return {
            "id": row["id"],
            "title": title,
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

    def delete_material(material_id, user_id):
        for i, r in enumerate(store["rows"]):
            if r["id"] == material_id and r["user_id"] == user_id:
                del store["rows"][i]
                return True
        return False

    monkeypatch.setattr(knowledge_repo, "create_material", create_material)
    monkeypatch.setattr(knowledge_repo, "list_materials", list_materials)
    monkeypatch.setattr(knowledge_repo, "get_material", get_material)
    monkeypatch.setattr(knowledge_repo, "delete_material", delete_material)
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
    assert body["material_id"]
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


# --- title + delete (migration 0016) --------------------------------------------


def test_import_derives_title_from_text(client, auth_headers, fake_knowledge):
    text = "Photosynthesis turns light into sugar."
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "text", "raw_text": text},
    )
    assert resp.status_code == 201
    # Short text becomes its own title verbatim.
    assert resp.get_json()["title"] == text
    assert fake_knowledge["rows"][0]["title"] == text


def test_import_accepts_client_title(client, auth_headers, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={
            "source_type": "text",
            "raw_text": "long body text",
            "title": "Cell biology",
        },
    )
    assert resp.status_code == 201
    assert resp.get_json()["title"] == "Cell biology"


def test_list_includes_title(client, auth_headers, fake_knowledge):
    client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={
            "source_type": "text",
            "raw_text": "Roman aqueducts moved water.",
            "title": "Rome",
        },
    )
    listed = client.get("/knowledge", headers=auth_headers).get_json()["materials"]
    assert listed[0]["title"] == "Rome"


def test_delete_removes_material(client, auth_headers, fake_knowledge):
    created = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "text", "raw_text": "disposable"},
    ).get_json()
    mid = created["material_id"]

    resp = client.delete(f"/knowledge/{mid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["deleted"] is True
    assert client.get("/knowledge", headers=auth_headers).get_json()["materials"] == []


def test_delete_404_for_unknown_material(client, auth_headers, fake_knowledge):
    ghost = "11111111-1111-1111-1111-111111111111"
    resp = client.delete(f"/knowledge/{ghost}", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_404_for_malformed_id(client, auth_headers, fake_knowledge):
    resp = client.delete("/knowledge/not-a-uuid", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_requires_auth(client, fake_knowledge):
    ghost = "11111111-1111-1111-1111-111111111111"
    assert client.delete(f"/knowledge/{ghost}").status_code == 401


# --- File upload (source_type='file') -----------------------------------------
# The AI extractor is mocked: these exercise the route (validation, size/mime checks,
# transcribe-then-store, and the failure → 422 path), not a real model call.

import base64  # noqa: E402
from unittest.mock import Mock  # noqa: E402

from app.ai import DocumentExtractionError  # noqa: E402
from app.routes import knowledge as knowledge_routes  # noqa: E402

# A tiny base64 payload; the extractor is mocked, so the bytes' content is irrelevant.
_FILE_B64 = base64.b64encode(b"%PDF-1.4 fake bytes").decode()


def _fake_extractor(monkeypatch, *, text="Cells are the unit of life.", raises=None):
    extractor = Mock()
    if raises is not None:
        extractor.extract.side_effect = raises
    else:
        extractor.extract.return_value = text
    monkeypatch.setattr(knowledge_routes, "get_document_extractor", lambda: extractor)
    return extractor


def test_import_file_transcribes_and_stores(
    client, auth_headers, fake_knowledge, monkeypatch
):
    _fake_extractor(monkeypatch, text="  Mitochondria   make\n\nenergy.  ")
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={
            "source_type": "file",
            "data": _FILE_B64,
            "mime_type": "application/pdf",
            "filename": "biology chapter 3.pdf",
        },
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["source_type"] == "file"
    assert body["material_id"]
    # Extracted text is normalized and stored like any other material.
    stored = fake_knowledge["rows"][0]["raw_text"]
    assert stored == "Mitochondria make energy."
    assert body["preview"] == stored
    # The filename (minus extension) becomes the title.
    assert body["title"] == "biology chapter 3"


def test_import_file_rejects_bad_mime(
    client, auth_headers, fake_knowledge, monkeypatch
):
    _fake_extractor(monkeypatch)
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "file", "data": _FILE_B64, "mime_type": "text/plain"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "validation_error"


def test_import_file_rejects_bad_base64(
    client, auth_headers, fake_knowledge, monkeypatch
):
    _fake_extractor(monkeypatch)
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "file", "data": "not@@base64", "mime_type": "image/png"},
    )
    assert resp.status_code == 400


def test_import_file_rejects_oversize(
    client, auth_headers, fake_knowledge, monkeypatch
):
    monkeypatch.setitem(client.application.config, "KNOWLEDGE_FILE_MAX_BYTES", 8)
    _fake_extractor(monkeypatch)
    big = base64.b64encode(b"x" * 64).decode()
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "file", "data": big, "mime_type": "image/png"},
    )
    assert resp.status_code == 400


def test_import_file_extraction_failure_is_422(
    client, auth_headers, fake_knowledge, monkeypatch
):
    _fake_extractor(
        monkeypatch, raises=DocumentExtractionError("No study text could be read.")
    )
    resp = client.post(
        "/knowledge/import",
        headers=auth_headers,
        json={"source_type": "file", "data": _FILE_B64, "mime_type": "image/png"},
    )
    assert resp.status_code == 422
    assert resp.get_json()["error"]["code"] == "unprocessable"
    # Nothing stored on a failed extraction.
    assert fake_knowledge["rows"] == []


def test_import_file_requires_auth(client, fake_knowledge):
    resp = client.post(
        "/knowledge/import",
        json={"source_type": "file", "data": _FILE_B64, "mime_type": "image/png"},
    )
    assert resp.status_code == 401
