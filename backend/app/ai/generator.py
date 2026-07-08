"""AI quiz generation — orchestrates dynamic multiple-choice question generation.

This is the primary AI integration for the quiz engine (architecture.md §6). It builds
age-appropriate MCQs from either a learner's profile (grade/age + focus subjects) or an
explicit study material, enforces a strict structural contract on the model's output,
and guarantees the endpoint never crashes on malformed AI content.

Design — a small pluggable interface with two implementations behind one factory:

  * ``ClaudeQuestionGenerator`` — calls the Anthropic API with a JSON-schema structured
    output so the model returns a standardized questions array.
  * ``DummyQuestionGenerator`` — serves the curated offline bank (app/quiz_content.py).
    Used when no API key is configured AND as the resiliency fallback.

Resiliency (the DoD): ``generate_quiz_questions`` runs the AI generator, validates the
result, re-prompts once on a validation failure, and on a second failure falls back to
the offline bank — so a client always receives a valid, structured quiz.
"""

import json
import logging
from typing import Protocol

from flask import current_app

from app.quiz_content import build_questions

try:  # optional dependency — only needed when an API key is configured
    import anthropic
except ImportError:  # pragma: no cover - exercised only in a stripped install
    anthropic = None

logger = logging.getLogger(__name__)

# Every question is exactly one prompt + this many options + one correct index.
OPTION_COUNT = 4


class GeneratorError(Exception):
    """A generator could not produce a valid quiz; the caller falls back."""


class QuestionGenerator(Protocol):
    """Produces raw question dicts: {prompt, options, correct_index, concept}."""

    def generate(
        self,
        *,
        count: int,
        subjects: list[str] | None = None,
        grade_or_age: str | None = None,
        material_text: str | None = None,
        locale: str = "en",
    ) -> list[dict]: ...


# ---------------------------------------------------------------------------
# Structural validation — the "contract enforcement" step. The JSON schema fixes
# the shape; these checks enforce the constraints a schema can't express (exactly
# 4 options, no duplicate answers, a single in-range correct index).
# ---------------------------------------------------------------------------


def _clean_options(options) -> list[str]:
    if not isinstance(options, list) or len(options) != OPTION_COUNT:
        raise GeneratorError(f"each question needs exactly {OPTION_COUNT} options")
    cleaned: list[str] = []
    seen: set[str] = set()
    for opt in options:
        if not isinstance(opt, str) or not opt.strip():
            raise GeneratorError("options must be non-empty strings")
        text = opt.strip()
        if text.lower() in seen:
            raise GeneratorError("options must be distinct (no duplicate answers)")
        seen.add(text.lower())
        cleaned.append(text)
    return cleaned


def validate_questions(raw, count: int) -> list[dict]:
    """Enforce the contract and normalize to internal quiz items.

    Returns exactly ``count`` items shaped
    ``{id, prompt, options[4], correct_index, concept}`` (ids q1..qN).
    Raises :class:`GeneratorError` on any violation.
    """
    if not isinstance(raw, list):
        raise GeneratorError("questions must be a list")
    if len(raw) < count:
        raise GeneratorError(f"expected at least {count} questions, got {len(raw)}")

    items: list[dict] = []
    for i, question in enumerate(raw[:count], start=1):
        if not isinstance(question, dict):
            raise GeneratorError("each question must be an object")

        prompt = question.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise GeneratorError("question prompt must be a non-empty string")

        options = _clean_options(question.get("options"))

        correct_index = question.get("correct_index")
        # bool is a subclass of int — reject it explicitly.
        if (
            not isinstance(correct_index, int)
            or isinstance(correct_index, bool)
            or not 0 <= correct_index < OPTION_COUNT
        ):
            raise GeneratorError(
                f"correct_index must be an integer 0..{OPTION_COUNT - 1}"
            )

        concept = question.get("concept")
        concept = (
            concept.strip() if isinstance(concept, str) and concept.strip() else None
        )

        items.append(
            {
                "id": f"q{i}",
                "prompt": prompt.strip(),
                "options": options,
                "correct_index": correct_index,
                "concept": concept,
            }
        )
    return items


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------


class DummyQuestionGenerator:
    """Offline generator: serves the curated question bank.

    Active when no API key is set, and reused as the guaranteed fallback when the AI
    path fails validation. Its output is always valid by construction.
    """

    def generate(
        self,
        *,
        count: int,
        subjects: list[str] | None = None,
        grade_or_age: str | None = None,
        material_text: str | None = None,
        locale: str = "en",
    ) -> list[dict]:
        return [
            {
                "prompt": q["prompt"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "concept": q["concept"],
            }
            for q in build_questions(count)
        ]


_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "correct_index": {"type": "integer"},
                    "concept": {"type": "string"},
                },
                "required": ["prompt", "options", "correct_index", "concept"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["questions"],
    "additionalProperties": False,
}


def _build_prompts(
    count: int,
    subjects: list[str] | None,
    grade_or_age: str | None,
    material_text: str | None,
    locale: str,
) -> tuple[str, str]:
    system = (
        "You are an expert author of educational multiple-choice quizzes for children. "
        "You write clear, unambiguous, age-appropriate questions. Every question has "
        f"exactly {OPTION_COUNT} distinct, plausible answer options and exactly one "
        "correct option. For each question also give a one-sentence 'concept' "
        "explaining why the correct answer is right (shown to a child who answered "
        "wrong). Return only the requested structured data."
    )

    parts = [f"Generate exactly {count} multiple-choice questions."]
    if grade_or_age:
        parts.append(
            f"Target learner: {grade_or_age}. "
            "Match vocabulary and difficulty to this level."
        )
    if material_text:
        parts.append(
            "Base every question strictly on the following study material. Do not ask "
            "about anything it does not cover:\n\n" + material_text
        )
    elif subjects:
        parts.append("Cover these subjects: " + ", ".join(subjects) + ".")
    else:
        parts.append(
            "Cover general school knowledge across math, science, history and language."
        )
    if locale and not locale.startswith("en"):
        parts.append(f"Write the questions and options in locale '{locale}'.")
    parts.append(
        f"Each item: a 'prompt', an 'options' array of exactly {OPTION_COUNT} distinct "
        "strings, a 'correct_index' pointing to the single correct option, and a "
        "one-sentence 'concept'."
    )
    return system, "\n\n".join(parts)


class ClaudeQuestionGenerator:
    """Generates questions via the Anthropic API with structured JSON-schema output."""

    def __init__(self, api_key: str, model: str):
        if anthropic is None:  # pragma: no cover - guarded by get_generator()
            raise GeneratorError("anthropic package is not installed")
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def generate(
        self,
        *,
        count: int,
        subjects: list[str] | None = None,
        grade_or_age: str | None = None,
        material_text: str | None = None,
        locale: str = "en",
    ) -> list[dict]:
        system, user = _build_prompts(
            count, subjects, grade_or_age, material_text, locale
        )
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=2000,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
            )
        except anthropic.APIError as exc:  # network / auth / rate-limit / 5xx
            raise GeneratorError(f"Claude API call failed: {exc}") from exc

        if response.stop_reason == "refusal":
            raise GeneratorError("Claude declined to generate for this input")

        text = next((b.text for b in response.content if b.type == "text"), None)
        if not text:
            raise GeneratorError("Claude returned no text content")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:  # truncated or malformed output
            raise GeneratorError(f"Claude returned invalid JSON: {exc}") from exc

        questions = data.get("questions") if isinstance(data, dict) else None
        if not isinstance(questions, list):
            raise GeneratorError("Claude response missing a 'questions' array")
        return questions


def get_generator() -> QuestionGenerator:
    """Return the active generator: Claude when a key is set, else the offline bank."""
    api_key = current_app.config.get("ANTHROPIC_API_KEY")
    if api_key:
        return ClaudeQuestionGenerator(api_key, current_app.config["ANTHROPIC_MODEL"])
    return DummyQuestionGenerator()


def generate_quiz_questions(
    *,
    count: int,
    subjects: list[str] | None = None,
    grade_or_age: str | None = None,
    material_text: str | None = None,
    locale: str = "en",
) -> list[dict]:
    """Produce exactly ``count`` validated quiz items.

    Runs the active generator, validates the output, re-prompts once on a validation
    failure (``QUIZ_GEN_RETRIES``), then falls back to the offline bank — so callers
    always receive a valid, structured quiz and never an unhandled crash.
    """
    generator = get_generator()

    if isinstance(generator, DummyQuestionGenerator):
        # No AI configured; the bank is valid by construction — no retry needed.
        return validate_questions(generator.generate(count=count), count)

    attempts = 1 + max(0, current_app.config.get("QUIZ_GEN_RETRIES", 1))
    last_error: GeneratorError | None = None
    for attempt in range(1, attempts + 1):
        try:
            raw = generator.generate(
                count=count,
                subjects=subjects,
                grade_or_age=grade_or_age,
                material_text=material_text,
                locale=locale,
            )
            return validate_questions(raw, count)
        except GeneratorError as exc:
            last_error = exc
            logger.warning(
                "quiz generation attempt %d/%d failed: %s", attempt, attempts, exc
            )

    logger.warning(
        "AI generation exhausted (%s); serving offline fallback bank", last_error
    )
    return validate_questions(DummyQuestionGenerator().generate(count=count), count)
