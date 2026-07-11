"""AI quiz generation — validation, retry/fallback orchestration, Claude adapter.

These exercise the real logic in app/ai/generator.py with no network: the Claude client
is replaced by a fake, and the offline generator is deterministic. Together they cover
the task's contract-enforcement + resiliency requirements (exactly 4 options, one
correct index, no duplicate answers, one retry, then offline fallback).
"""

import json

import pytest

from app.ai import generator
from app.ai.generator import (
    ClaudeQuestionGenerator,
    GeneratorError,
    _build_prompts,
    generate_quiz,
    validate_generation,
    validate_questions,
    validate_recap,
)
from app.quiz_content import QUESTION_BANK, RECAP_BANK


def _q(prompt="What is 2+2?", options=None, correct_index=1, concept="basic sum"):
    return {
        "prompt": prompt,
        "options": options if options is not None else ["1", "4", "3", "2"],
        "correct_index": correct_index,
        "concept": concept,
    }


def _recap(answer="180", distractors=None, before="Angles add up to", after="degrees."):
    return {
        "sentence_before": before,
        "sentence_after": after,
        "answer": answer,
        "distractors": distractors if distractors is not None else ["90", "360"],
    }


GOOD = [_q(prompt=f"Q{i}?") for i in range(7)]


def _generation(questions=None, recap=None):
    return {
        "questions": GOOD if questions is None else questions,
        "recap": _recap() if recap is None else recap,
    }


@pytest.fixture
def app_context():
    from app import create_app

    app = create_app()
    with app.app_context():
        yield app


# --- validate_questions (contract enforcement) ---------------------------------


def test_validate_accepts_and_normalizes():
    items = validate_questions(GOOD, 5)
    assert len(items) == 5
    assert [q["id"] for q in items] == ["q1", "q2", "q3", "q4", "q5"]
    assert all(len(q["options"]) == 4 for q in items)
    assert items[0]["correct_index"] == 1


def test_validate_trims_and_strips_whitespace():
    raw = [_q(prompt="  spaced  ", options=[" a ", "b", "c", "d"])]
    items = validate_questions(raw, 1)
    assert items[0]["prompt"] == "spaced"
    assert items[0]["options"][0] == "a"


@pytest.mark.parametrize(
    "bad",
    [
        "not-a-list",
        [_q(options=["a", "b", "c"])],  # only 3 options
        [_q(options=["a", "b", "c", "d", "e"])],  # 5 options
        [_q(options=["a", "A", "c", "d"])],  # duplicate answer (case-insensitive)
        [_q(options=["a", "", "c", "d"])],  # empty option
        [_q(correct_index=4)],  # out of range
        [_q(correct_index=-1)],  # out of range
        [_q(correct_index=True)],  # bool is not a valid index
        [_q(prompt="")],  # empty prompt
        [{"options": ["a", "b", "c", "d"], "correct_index": 0}],  # missing prompt
        ["not-an-object"],
    ],
)
def test_validate_rejects_malformed(bad):
    with pytest.raises(GeneratorError):
        validate_questions(bad, 1)


def test_validate_requires_enough_questions():
    with pytest.raises(GeneratorError):
        validate_questions(GOOD[:2], 5)


# --- validate_recap (contract enforcement) -------------------------------------


def test_recap_normalizes_to_three_options_including_the_answer():
    recap = validate_recap(_recap())
    assert recap["sentence_before"] == "Angles add up to"
    assert recap["sentence_after"] == "degrees."
    assert recap["answer"] == "180"
    assert sorted(recap["options"]) == sorted(["180", "90", "360"])


def test_recap_answer_is_not_always_the_first_chip():
    """Always-first would teach the chip's position rather than the fact."""
    slots = {
        validate_recap(_recap(answer=a)).get("options").index(a)
        for a in ("180", "ATP", "b")
    }
    assert len(slots) > 1


def test_recap_option_order_is_stable_across_calls():
    """Deterministic: the chips must not reshuffle between renders of the same quiz."""
    assert validate_recap(_recap())["options"] == validate_recap(_recap())["options"]


def test_recap_allows_a_blank_that_ends_the_sentence():
    assert validate_recap(_recap(after=""))["sentence_after"] == ""
    raw = _recap()
    del raw["sentence_after"]
    assert validate_recap(raw)["sentence_after"] == ""


@pytest.mark.parametrize(
    "bad",
    [
        "not-an-object",
        _recap(before=""),  # empty stem
        _recap(answer=""),  # empty answer
        _recap(answer=None),  # non-string answer
        _recap(distractors=["90"]),  # too few
        _recap(distractors=["90", "360", "45"]),  # too many
        _recap(distractors=["90", "90"]),  # duplicate distractors
        _recap(answer="180", distractors=["180", "90"]),  # distractor equals the answer
        _recap(answer="180", distractors=["  180  ", "90"]),  # ...after trimming
        _recap(distractors=["90", ""]),  # empty distractor
        _recap(distractors="not-a-list"),
    ],
)
def test_recap_rejects_malformed(bad):
    with pytest.raises(GeneratorError):
        validate_recap(bad)


# --- validate_generation (questions are strict; the recap is not worth a quiz) ---


def test_generation_returns_questions_and_recap():
    out = validate_generation(_generation(), 5)
    assert len(out["questions"]) == 5
    assert out["recap"]["answer"] == "180"


def test_a_botched_recap_does_not_cost_a_good_quiz():
    out = validate_generation(_generation(recap={"sentence_before": ""}), 5)
    assert len(out["questions"]) == 5
    # ...it is silently replaced from the offline bank.
    assert out["recap"]["answer"] in {r["answer"] for r in RECAP_BANK}


def test_a_botched_question_set_is_still_rejected():
    with pytest.raises(GeneratorError):
        validate_generation(_generation(questions=[_q(correct_index=9)]), 1)


def test_generation_rejects_a_non_object():
    with pytest.raises(GeneratorError):
        validate_generation(GOOD, 5)  # a bare list, not {questions, recap}


# --- orchestration: retry once, then fall back ---------------------------------


class _FakeGen:
    """Yields a scripted result per call; an Exception value is raised instead."""

    def __init__(self, *results):
        self._results = list(results)
        self.calls = 0

    def generate(self, **kwargs):
        self.calls += 1
        result = self._results[min(self.calls - 1, len(self._results) - 1)]
        if isinstance(result, Exception):
            raise result
        return result


def test_generation_retries_then_succeeds(app_context, monkeypatch):
    app_context.config["QUIZ_GEN_RETRIES"] = 1
    bad = _generation(questions=[_q(options=["a", "b"])])  # fails validation
    fake = _FakeGen(bad, _generation())
    monkeypatch.setattr(generator, "get_generator", lambda: fake)

    quiz = generate_quiz(count=5, subjects=["Math"], grade_or_age="Age 10")

    assert fake.calls == 2  # first failed, retry succeeded
    assert len(quiz["questions"]) == 5
    assert quiz["questions"][0]["prompt"] == "Q0?"
    assert quiz["recap"]["answer"] == "180"


def test_generation_falls_back_to_bank_after_two_failures(app_context, monkeypatch):
    app_context.config["QUIZ_GEN_RETRIES"] = 1
    fake = _FakeGen(GeneratorError("boom"), GeneratorError("boom again"))
    monkeypatch.setattr(generator, "get_generator", lambda: fake)

    quiz = generate_quiz(count=5)

    assert fake.calls == 2  # 1 attempt + 1 retry, both failed
    assert len(quiz["questions"]) == 5
    # served from the offline bank, recap included
    assert quiz["questions"][0]["prompt"] == QUESTION_BANK[0]["prompt"]
    assert quiz["recap"]["answer"] in {r["answer"] for r in RECAP_BANK}


def test_generation_falls_back_on_repeated_malformed_output(app_context, monkeypatch):
    app_context.config["QUIZ_GEN_RETRIES"] = 1
    malformed = _generation(questions=[_q(correct_index=9)])  # invalid twice
    fake = _FakeGen(malformed, malformed)
    monkeypatch.setattr(generator, "get_generator", lambda: fake)

    quiz = generate_quiz(count=5)
    assert quiz["questions"][0]["prompt"] == QUESTION_BANK[0]["prompt"]


def test_no_api_key_uses_offline_bank_without_retrying(app_context):
    # conftest forces ANTHROPIC_API_KEY="" → get_generator() returns the Dummy gen.
    quiz = generate_quiz(count=5)
    assert [q["prompt"] for q in quiz["questions"]] == [
        q["prompt"] for q in QUESTION_BANK[:5]
    ]
    assert quiz["recap"]["answer"] in {r["answer"] for r in RECAP_BANK}


def test_offline_recap_varies_with_quiz_length(app_context):
    """A 5-question quiz and a 7-question debt quiz must not recap the same idea."""
    assert generate_quiz(count=5)["recap"] != generate_quiz(count=7)["recap"]


# --- Claude adapter (parsing / refusal), no network ----------------------------


class _Block:
    type = "text"

    def __init__(self, text):
        self.text = text


class _Resp:
    def __init__(self, text, stop_reason="end_turn"):
        self.content = [_Block(text)]
        self.stop_reason = stop_reason


class _FakeMessages:
    def __init__(self, resp):
        self._resp = resp
        self.kwargs = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        return self._resp


class _FakeClient:
    def __init__(self, resp):
        self.messages = _FakeMessages(resp)


def _claude_with(resp):
    gen = ClaudeQuestionGenerator.__new__(ClaudeQuestionGenerator)  # skip __init__
    gen._model = "claude-haiku-4-5"
    gen._client = _FakeClient(resp)
    return gen


def test_claude_generator_parses_structured_output(app_context):
    gen = _claude_with(_Resp(json.dumps(_generation())))
    raw = gen.generate(count=5, subjects=["Math"], grade_or_age="Age 10")
    assert isinstance(raw, dict)
    assert len(raw["questions"]) == 7
    assert raw["recap"]["answer"] == "180"
    # a json_schema structured-output request was issued
    fmt = gen._client.messages.kwargs["output_config"]["format"]
    assert fmt["type"] == "json_schema"
    assert "recap" in fmt["schema"]["properties"]


def test_claude_generator_refusal_raises(app_context):
    gen = _claude_with(_Resp("", stop_reason="refusal"))
    with pytest.raises(GeneratorError):
        gen.generate(count=5)


def test_claude_generator_invalid_json_raises(app_context):
    gen = _claude_with(_Resp("this is not json"))
    with pytest.raises(GeneratorError):
        gen.generate(count=5)


def test_claude_generator_missing_questions_key_raises(app_context):
    gen = _claude_with(_Resp(json.dumps({"items": []})))
    with pytest.raises(GeneratorError):
        gen.generate(count=5)


# --- prompt construction --------------------------------------------------------


def test_prompts_ground_on_material_and_level():
    system, user = _build_prompts(5, ["Math"], "Age 10", "MITOCHONDRIA FACTS", "en")
    assert "MITOCHONDRIA FACTS" in user
    assert "Age 10" in user
    assert "exactly 5" in user
    assert "four" in system.lower() or "4" in system


def test_prompts_use_subjects_when_no_material():
    _, user = _build_prompts(5, ["Math", "History"], None, None, "en")
    assert "Math" in user and "History" in user


def test_prompts_ask_for_the_recap():
    system, user = _build_prompts(5, ["Math"], None, None, "en")
    assert "recap" in user.lower()
    assert "sentence_before" in user and "distractors" in user
