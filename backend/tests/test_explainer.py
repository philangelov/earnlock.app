"""Remediation explainer — Claude-backed with a guaranteed offline fallback.

The submit flow must never break because a remediation call errored, so ClaudeExplainer
degrades to the deterministic DummyExplainer on any API failure, refusal, or empty
reply. No network here: the client is faked.
"""

import pytest

from app.ai.explainer import ClaudeExplainer, DummyExplainer, get_explainer

QUESTION = {
    "prompt": "What gas do plants release during photosynthesis?",
    "options": ["Nitrogen", "Carbon dioxide", "Helium", "Oxygen"],
    "correct_index": 3,
    "selected_index": 0,
    "concept": "Plants take in CO2 and release oxygen.",
}


@pytest.fixture
def app_context():
    from app import create_app

    app = create_app()
    with app.app_context():
        yield app


class _Block:
    type = "text"

    def __init__(self, text):
        self.text = text


class _Resp:
    def __init__(self, text, stop_reason="end_turn"):
        self.content = [_Block(text)]
        self.stop_reason = stop_reason


class _Messages:
    def __init__(self, resp_or_exc):
        self._resp_or_exc = resp_or_exc

    def create(self, **kwargs):
        if isinstance(self._resp_or_exc, Exception):
            raise self._resp_or_exc
        return self._resp_or_exc


class _Client:
    def __init__(self, resp_or_exc):
        self.messages = _Messages(resp_or_exc)


def _explainer_with(resp_or_exc):
    exp = ClaudeExplainer.__new__(ClaudeExplainer)  # skip __init__ (no key)
    exp._model = "claude-haiku-4-5"
    exp._client = _Client(resp_or_exc)
    exp._fallback = DummyExplainer()
    return exp


def test_explainer_returns_model_text():
    exp = _explainer_with(_Resp("Plants breathe out oxygen, not nitrogen. Try again!"))
    out = exp.explain(**QUESTION)
    assert out == "Plants breathe out oxygen, not nitrogen. Try again!"


def test_explainer_falls_back_on_api_error():
    exp = _explainer_with(RuntimeError("network down"))
    out = exp.explain(**QUESTION)
    # deterministic stub text — mentions the correct option
    assert "Oxygen" in out
    assert isinstance(out, str) and out


def test_explainer_falls_back_on_refusal():
    exp = _explainer_with(_Resp("", stop_reason="refusal"))
    out = exp.explain(**QUESTION)
    assert "Oxygen" in out


def test_explainer_falls_back_on_empty_text():
    exp = _explainer_with(_Resp("   "))
    out = exp.explain(**QUESTION)
    assert "Oxygen" in out


def test_get_explainer_offline_without_key(app_context):
    # conftest forces ANTHROPIC_API_KEY="" → the offline stub.
    assert isinstance(get_explainer(), DummyExplainer)
