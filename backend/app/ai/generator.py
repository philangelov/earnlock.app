"""AI quiz generation — orchestrates dynamic multiple-choice question generation.

This is the primary AI integration for the quiz engine (architecture.md §6). It builds
age-appropriate MCQs from either a learner's profile (grade/age + focus subjects) or an
explicit study material, enforces a strict structural contract on the model's output,
and guarantees the endpoint never crashes on malformed AI content.

A generation is a **quiz plus its recap**: the multiple-choice questions, and one
fill-in-the-blank sentence closing the same idea. Both come out of a single structured
output call, so the recap is grounded in the material the questions came from rather
than being a fixed sentence bolted on by the client.

Design — a small pluggable interface with two implementations behind one factory:

  * ``ClaudeQuestionGenerator`` — calls the Anthropic API with a JSON-schema structured
    output so the model returns a standardized questions array plus a recap.
  * ``DummyQuestionGenerator`` — serves the curated offline bank (app/quiz_content.py).
    Used when no API key is configured AND as the resiliency fallback.

Resiliency (the DoD): ``generate_quiz`` runs the AI generator, validates the result,
re-prompts once on a validation failure, and on a second failure falls back to the
offline bank — so a client always receives a valid, structured quiz. A *recap* that
fails validation is quietly replaced from the offline bank instead of costing an
otherwise perfectly good set of questions.
"""

import json
import logging
from typing import Protocol

from flask import current_app

from app.quiz_content import build_questions, build_recap
from app.validation import VALID_SUBJECTS

try:  # optional dependency — only needed when an API key is configured
    import anthropic
except ImportError:  # pragma: no cover - exercised only in a stripped install
    anthropic = None

logger = logging.getLogger(__name__)

# Every question is exactly one prompt + this many options + one correct index.
OPTION_COUNT = 4

# Case-insensitive canonicalization, so a model that answers "math" still lands in the
# same mastery bucket as one that answers "Math". Built per-generation from the subjects
# actually in play (predefined + the learner's custom ones), so a custom subject is
# tracked like a built-in. This default covers callers that pass no subjects (the bank).
_DEFAULT_SUBJECT_LOOKUP = {s.lower(): s for s in VALID_SUBJECTS}


def _allowed_subjects(subjects: list[str] | None) -> list[str]:
    """Subjects a question may be tagged with: the predefined set, plus any custom focus
    subjects the learner picked — so a custom subject earns mastery like a built-in."""
    allowed = list(VALID_SUBJECTS)
    seen = {s.lower() for s in allowed}
    for subject in subjects or []:
        if isinstance(subject, str) and subject.strip():
            name = subject.strip()
            if name.lower() not in seen:
                seen.add(name.lower())
                allowed.append(name)
    return allowed


class GeneratorError(Exception):
    """A generator could not produce a valid quiz; the caller falls back."""


class QuestionGenerator(Protocol):
    """Produces a raw generation: {questions: [...], recap: {...}}.

    Each question is {prompt, options, correct_index, concept, subject}; the recap is
    {sentence_before, sentence_after, answer, distractors}.
    """

    def generate(
        self,
        *,
        count: int,
        subjects: list[str] | None = None,
        grade_or_age: str | None = None,
        material_text: str | None = None,
        locale: str = "en",
    ) -> dict: ...


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


def _clean_subject(value, lookup: dict) -> str | None:
    """Canonicalize a generated subject against the in-play lookup, or None if unknown.

    Deliberately lenient: an unrecognised subject costs one row of mastery data, while
    raising here would throw away an otherwise perfectly good quiz.
    """
    if not isinstance(value, str):
        return None
    return lookup.get(value.strip().lower())


def validate_questions(
    raw, count: int, subject_lookup: dict | None = None
) -> list[dict]:
    """Enforce the contract and normalize to internal quiz items.

    Returns exactly ``count`` items shaped
    ``{id, prompt, options[4], correct_index, concept, subject}`` (ids q1..qN).
    ``subject_lookup`` maps lowercased→canonical for the subjects in play; defaults to
    the predefined set. Raises :class:`GeneratorError` on any violation.
    """
    lookup = subject_lookup if subject_lookup is not None else _DEFAULT_SUBJECT_LOOKUP
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
                "subject": _clean_subject(question.get("subject"), lookup),
            }
        )
    return items


#: Chips shown on the recap screen: the answer plus this many distractors.
RECAP_OPTION_COUNT = 3


def validate_recap(raw) -> dict:
    """Enforce the recap contract and normalize to `{sentence_before, sentence_after,
    answer, options}`.

    Raises :class:`GeneratorError` on any violation.
    """
    if not isinstance(raw, dict):
        raise GeneratorError("recap must be an object")

    before = raw.get("sentence_before")
    if not isinstance(before, str) or not before.strip():
        raise GeneratorError("recap sentence_before must be a non-empty string")

    # The blank may end the sentence, so a trailing clause is optional.
    after = raw.get("sentence_after")
    after = after.strip() if isinstance(after, str) else ""

    answer = raw.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        raise GeneratorError("recap answer must be a non-empty string")
    answer = answer.strip()

    distractors = raw.get("distractors")
    wanted = RECAP_OPTION_COUNT - 1
    if not isinstance(distractors, list) or len(distractors) != wanted:
        raise GeneratorError(f"recap needs exactly {wanted} distractors")

    cleaned: list[str] = []
    seen = {answer.lower()}
    for distractor in distractors:
        if not isinstance(distractor, str) or not distractor.strip():
            raise GeneratorError("recap distractors must be non-empty strings")
        text = distractor.strip()
        if text.lower() in seen:
            raise GeneratorError(
                "recap distractors must differ from the answer and each other"
            )
        seen.add(text.lower())
        cleaned.append(text)

    # A deterministic but non-obvious slot for the answer. Always-first would teach the
    # chip's position rather than the fact; shuffling would make the output untestable
    # and would change on every re-render if the client ever re-sorted.
    slot = sum(map(ord, answer)) % RECAP_OPTION_COUNT
    options = cleaned[:]
    options.insert(slot, answer)

    return {
        "sentence_before": before.strip(),
        "sentence_after": after,
        "answer": answer,
        "options": options,
    }


def validate_generation(
    raw, count: int, allowed_subjects: list[str] | None = None
) -> dict:
    """Validate a whole generation into `{questions, recap}`.

    Questions are strict: a malformed set is rejected so the caller can retry or fall
    back. The recap is not worth a quiz — if the model botched it, we serve the offline
    one and keep the questions it got right. ``allowed_subjects`` widens the canonical
    set for this generation (predefined + custom); defaults to predefined.
    """
    if not isinstance(raw, dict):
        raise GeneratorError("generation must be an object with a 'questions' array")

    lookup = {s.lower(): s for s in (allowed_subjects or VALID_SUBJECTS)}
    questions = validate_questions(raw.get("questions"), count, lookup)

    try:
        recap = validate_recap(raw.get("recap"))
    except GeneratorError as exc:
        logger.warning("recap rejected (%s); serving the offline recap", exc)
        recap = validate_recap(build_recap(count))

    return {"questions": questions, "recap": recap}


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
    ) -> dict:
        return {
            "questions": [
                {
                    "prompt": q["prompt"],
                    "options": q["options"],
                    "correct_index": q["correct_index"],
                    "concept": q["concept"],
                    "subject": q["subject"],
                }
                for q in build_questions(count)
            ],
            "recap": build_recap(count),
        }


def _build_schema(allowed_subjects: list[str]) -> dict:
    """The structured-output schema for one generation. The subject is an enum, not a
    free string — mastery is only comparable across quizzes if every generator names a
    subject the same way — but the enum is the subjects actually in play, so a learner's
    custom subject is a valid tag rather than being coerced away."""
    return {
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
                        "subject": {"type": "string", "enum": list(allowed_subjects)},
                    },
                    "required": [
                        "prompt",
                        "options",
                        "correct_index",
                        "concept",
                        "subject",
                    ],
                    "additionalProperties": False,
                },
            },
            "recap": {
                "type": "object",
                "properties": {
                    "sentence_before": {"type": "string"},
                    "sentence_after": {"type": "string"},
                    "answer": {"type": "string"},
                    "distractors": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "sentence_before",
                    "sentence_after",
                    "answer",
                    "distractors",
                ],
                "additionalProperties": False,
            },
        },
        "required": ["questions", "recap"],
        "additionalProperties": False,
    }


def _build_prompts(
    count: int,
    subjects: list[str] | None,
    grade_or_age: str | None,
    material_text: str | None,
    locale: str,
) -> tuple[str, str]:
    allowed = _allowed_subjects(subjects)
    system = (
        "You are an expert author of educational multiple-choice quizzes for children. "
        "You write clear, unambiguous, age-appropriate questions. Every question has "
        f"exactly {OPTION_COUNT} distinct, plausible answer options and exactly one "
        "correct option. For each question also give a one-sentence 'concept' "
        "explaining why the correct answer is right (shown to a child who answered "
        "wrong), and a 'subject' naming which school subject it belongs to. Return "
        "only the requested structured data."
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
        "strings, a 'correct_index' pointing to the single correct option, a "
        "one-sentence 'concept', and a 'subject' — exactly one of: "
        + ", ".join(allowed)
        + ". Pick the closest subject even when the question straddles two."
    )
    parts.append(
        "Also write one 'recap': a fill-in-the-blank sentence closing the single most "
        "important idea the quiz covered. Split it at the blank into 'sentence_before' "
        "and 'sentence_after' (use an empty 'sentence_after' if the blank ends the "
        "sentence), give the word or number that fills it as 'answer', and give "
        f"{RECAP_OPTION_COUNT - 1} plausible but wrong 'distractors'. The answer must "
        "be short — a single word or number, not a clause."
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
    ) -> dict:
        system, user = _build_prompts(
            count, subjects, grade_or_age, material_text, locale
        )
        schema = _build_schema(_allowed_subjects(subjects))
        # Budget headroom per question (prompt + 4 options + concept + subject) plus the
        # recap. Too low a cap truncates the JSON on a longer (debt-mode) quiz, which
        # fails validation and silently falls back to the offline bank, not the
        # material.
        max_tokens = min(8000, 600 * count + 1200)
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"format": {"type": "json_schema", "schema": schema}},
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

        if not isinstance(data, dict) or not isinstance(data.get("questions"), list):
            raise GeneratorError("Claude response missing a 'questions' array")
        return data


def get_generator() -> QuestionGenerator:
    """Return the active generator: Claude when a key is set, else the offline bank."""
    api_key = current_app.config.get("ANTHROPIC_API_KEY")
    if api_key:
        return ClaudeQuestionGenerator(api_key, current_app.config["ANTHROPIC_MODEL"])
    return DummyQuestionGenerator()


def generate_quiz(
    *,
    count: int,
    subjects: list[str] | None = None,
    grade_or_age: str | None = None,
    material_text: str | None = None,
    locale: str = "en",
) -> dict:
    """Produce a validated `{questions, recap}` with exactly ``count`` questions.

    Runs the active generator, validates the output, re-prompts once on a validation
    failure (``QUIZ_GEN_RETRIES``), then falls back to the offline bank — so callers
    always receive a valid, structured quiz and never an unhandled crash.
    """
    generator = get_generator()

    if isinstance(generator, DummyQuestionGenerator):
        # No AI configured; the bank is valid by construction — no retry needed.
        return validate_generation(generator.generate(count=count), count)

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
            return validate_generation(raw, count, _allowed_subjects(subjects))
        except GeneratorError as exc:
            last_error = exc
            logger.warning(
                "quiz generation attempt %d/%d failed: %s", attempt, attempts, exc
            )

    logger.warning(
        "AI generation exhausted (%s); serving offline fallback bank", last_error
    )
    return validate_generation(DummyQuestionGenerator().generate(count=count), count)
