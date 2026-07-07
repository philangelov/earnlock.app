"""AI remediation — pluggable explanation generator for wrong quiz answers.

Learning Mode (see docs/ui-ux.md §7.5) shows the child a short explanation for every
question they got wrong. That text is produced here behind a single interface so the MVP
can ship a deterministic stub today and swap in a real LLM later **without changing any
caller or the API contract** (architecture.md §6).

The real implementation will call the Claude API from a server-side proxy (the key never
lives in the app); it must return the same 2–3 sentence shape this stub returns.
"""

from typing import Protocol


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
    """Deterministic, offline stub used for the MVP and in tests.

    Produces a constructive 2–3 sentence explanation from the question data alone — no
    network, no API key — the full quiz flow works before the real model is wired in.
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


def get_explainer() -> Explainer:
    """Return the active explainer; swap in a model-backed impl later (config)."""
    return DummyExplainer()
