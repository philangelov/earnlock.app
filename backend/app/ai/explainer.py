"""AI remediation — pluggable explanation generator for wrong quiz answers.

Learning Mode (see docs/ui-ux.md §7.5) shows the child a short explanation for every
question they got wrong. That text is produced here behind a single interface so the
generator and the explainer share one config switch (architecture.md §6):

  * ``ClaudeExplainer`` — calls the Anthropic API for a 2-3 sentence, kid-friendly
    explanation. Active when an API key is configured.
  * ``DummyExplainer`` — deterministic offline stub. Active when no key is set, AND the
    fallback ClaudeExplainer uses if a call fails — so scoring a quiz never breaks over
    remediation (a secondary feature).
"""

import logging
from typing import Protocol

from flask import current_app

try:  # optional dependency — only needed when an API key is configured
    import anthropic
except ImportError:  # pragma: no cover - exercised only in a stripped install
    anthropic = None

logger = logging.getLogger(__name__)


class Explainer(Protocol):
    """Generates a concise (2–3 sentence) explanation for a wrong answer."""

    def explain(
        self,
        *,
        prompt: str,
        options: list[str],
        correct_index: int,
        selected_index: int | None,
        concept: str | None = None,
        locale: str = "en",
    ) -> str: ...


class DummyExplainer:
    """Deterministic, offline stub used without a key and as the resiliency fallback.

    Produces a constructive 2–3 sentence explanation from the question data alone — no
    network, no API key — so the full quiz flow works before the real model is wired in.
    """

    def explain(
        self,
        *,
        prompt: str,
        options: list[str],
        correct_index: int,
        selected_index: int | None,
        concept: str | None = None,
        locale: str = "en",
    ) -> str:
        picked = (
            options[selected_index]
            if isinstance(selected_index, int) and 0 <= selected_index < len(options)
            else "no answer"
        )
        correct = (
            options[correct_index]
            if 0 <= correct_index < len(options)
            else "the right option"
        )
        reason = f" {concept.strip()}" if concept else ""
        return (
            f"“{picked}” isn’t right for this one — the correct answer is “{correct}”."
            f"{reason} Re-read the question with that in mind and try again."
        )


class ClaudeExplainer:
    """Model-backed explainer. Any failure falls back to the offline stub, so the quiz
    submit flow can never break because a remediation call errored."""

    def __init__(self, api_key: str, model: str):
        if anthropic is None:  # pragma: no cover - guarded by get_explainer()
            raise RuntimeError("anthropic package is not installed")
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model
        self._fallback = DummyExplainer()

    def explain(
        self,
        *,
        prompt: str,
        options: list[str],
        correct_index: int,
        selected_index: int | None,
        concept: str | None = None,
        locale: str = "en",
    ) -> str:
        try:
            return self._call(
                prompt, options, correct_index, selected_index, concept, locale
            )
        except Exception as exc:  # remediation is secondary — never fail the submit
            logger.warning("Claude explainer failed (%s); using offline stub", exc)
            return self._fallback.explain(
                prompt=prompt,
                options=options,
                correct_index=correct_index,
                selected_index=selected_index,
                concept=concept,
                locale=locale,
            )

    def _call(self, prompt, options, correct_index, selected_index, concept, locale):
        correct = (
            options[correct_index]
            if 0 <= correct_index < len(options)
            else "the correct option"
        )
        picked = (
            options[selected_index]
            if isinstance(selected_index, int) and 0 <= selected_index < len(options)
            else None
        )

        chose = f"The child chose: {picked}" if picked is not None else "No answer."
        lines = [
            f"Question: {prompt}",
            f"Options: {options}",
            f"Correct answer: {correct}",
            chose,
        ]
        if concept:
            lines.append(f"Key idea: {concept}")
        if locale and not locale.startswith("en"):
            lines.append(f"Write the explanation in locale '{locale}'.")

        response = self._client.messages.create(
            model=self._model,
            max_tokens=300,
            system=(
                "You are a kind, encouraging tutor for children. In 2-3 short, simple "
                "sentences, explain why the correct answer is right and gently why the "
                "child's choice was not. Do not scold. Reply with only the explanation."
            ),
            messages=[{"role": "user", "content": "\n".join(lines)}],
        )
        if response.stop_reason == "refusal":
            raise RuntimeError("model declined to explain")
        text = next((b.text for b in response.content if b.type == "text"), None)
        if not text or not text.strip():
            raise RuntimeError("empty explanation")
        return text.strip()


def get_explainer() -> Explainer:
    """Return the active explainer: Claude when a key is set, else the offline stub."""
    api_key = current_app.config.get("ANTHROPIC_API_KEY")
    if api_key:
        return ClaudeExplainer(api_key, current_app.config["ANTHROPIC_MODEL"])
    return DummyExplainer()
