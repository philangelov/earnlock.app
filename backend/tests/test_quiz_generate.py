"""POST /quiz/generate — source routing (profile | material | text).

The generator runs offline (no API key in tests → curated bank), and the DB layer is
stubbed, so these assert the route's source resolution and validation, not AI quality.
"""

import pytest

from app.repos import knowledge_repo, quiz_repo
from app.services import supabase


@pytest.fixture
def gen_stubs(monkeypatch):
    """Stub the DB reads/writes /quiz/generate performs, keeping the suite hermetic."""
    state = {"created_questions": None}

    monkeypatch.setattr(quiz_repo, "get_debt_flag", lambda user_id: False)

    def create_quiz(user_id, questions):
        state["created_questions"] = questions
        return "quiz-xyz"

    monkeypatch.setattr(quiz_repo, "create_quiz", create_quiz)
    monkeypatch.setattr(supabase, "get_user_grade", lambda user_id: "Age 11")
    monkeypatch.setattr(
        supabase,
        "get_profile_row",
        lambda user_id: {"focus_subjects": ["Math", "Biology"]},
    )
    return state


def test_generate_defaults_to_profile_source(client, auth_headers, gen_stubs):
    resp = client.post("/quiz/generate", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["source"] == "profile"
    assert body["question_count"] == 5
    for q in body["questions"]:
        assert "correct_index" not in q  # answer key stays server-side
    # a full quiz (with answer keys) was persisted
    assert gen_stubs["created_questions"] is not None
    assert all("correct_index" in q for q in gen_stubs["created_questions"])


def test_generate_ships_a_recap_with_its_answer(client, auth_headers, gen_stubs):
    """The recap is a review exercise, not a graded one — /quiz/submit has already paid
    out by the time it renders — so unlike the questions it carries its own answer."""
    body = client.post("/quiz/generate", headers=auth_headers).get_json()
    recap = body["recap"]

    assert recap["sentence_before"]
    assert recap["answer"] in recap["options"]
    assert len(recap["options"]) == 3
    assert len(set(recap["options"])) == 3


def test_generate_rejects_unknown_source(client, auth_headers, gen_stubs):
    resp = client.post(
        "/quiz/generate", headers=auth_headers, json={"source": "banana"}
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "validation_error"


def test_generate_source_text(client, auth_headers, gen_stubs):
    resp = client.post(
        "/quiz/generate",
        headers=auth_headers,
        json={"source": "text", "text": "The mitochondrion is the powerhouse."},
    )
    assert resp.status_code == 200
    assert resp.get_json()["source"] == "text"


def test_generate_source_text_requires_text(client, auth_headers, gen_stubs):
    resp = client.post("/quiz/generate", headers=auth_headers, json={"source": "text"})
    assert resp.status_code == 400


def test_generate_source_material(client, auth_headers, gen_stubs, monkeypatch):
    monkeypatch.setattr(
        knowledge_repo,
        "get_material",
        lambda material_id, user_id: {
            "id": material_id,
            "raw_text": "Photosynthesis converts light to sugar.",
            "source_type": "text",
            "created_at": "t",
        },
    )
    resp = client.post(
        "/quiz/generate",
        headers=auth_headers,
        json={"source": "material", "material_id": "mat-1"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["source"] == "material"


def test_generate_source_material_requires_id(client, auth_headers, gen_stubs):
    resp = client.post(
        "/quiz/generate", headers=auth_headers, json={"source": "material"}
    )
    assert resp.status_code == 400


def test_generate_source_material_not_found(
    client, auth_headers, gen_stubs, monkeypatch
):
    monkeypatch.setattr(
        knowledge_repo, "get_material", lambda material_id, user_id: None
    )
    resp = client.post(
        "/quiz/generate",
        headers=auth_headers,
        json={"source": "material", "material_id": "ghost"},
    )
    assert resp.status_code == 404


def test_generate_debt_yields_seven_questions(
    client, auth_headers, gen_stubs, monkeypatch
):
    monkeypatch.setattr(quiz_repo, "get_debt_flag", lambda user_id: True)
    resp = client.post("/quiz/generate", headers=auth_headers)
    assert resp.get_json()["question_count"] == 7


def test_generate_requires_auth(client, gen_stubs):
    assert client.post("/quiz/generate").status_code == 401
