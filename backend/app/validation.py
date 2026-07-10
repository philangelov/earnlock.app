"""Inbound profile-field validation.

Runs before anything touches the database. Enforces:
  * focus_subjects  -> non-empty subset of the known subject whitelist
  * grade_or_age    -> a recognised grade OR a realistic age (5-18)

Server-managed fields (sos_debt_flag, last_sos_date, wakeup_completed_date) are NOT
accepted here at all: per the API contract they are "ignored if sent", so the caller
simply never forwards them to the DB layer.
"""

import re
import uuid

from app.text_extraction import is_valid_http_url

# --- Focus subjects -------------------------------------------------------------
# Canonical set from docs/api-contract.md §3. Stored with this exact casing.
# Must stay in step with the subjects the app actually offers (SUBJECT_DEFS in
# frontend/src/store/content.ts) — anything the picker shows but this rejects turns a
# perfectly ordinary selection into a 400 on PUT /profile. The generator only
# interpolates these names into its prompt, so the list is free to grow.
VALID_SUBJECTS = (
    "Math",
    "History",
    "Biology",
    "English",
    "Physics",
    "Chemistry",
    "Geography",
    "Coding",
)
_SUBJECT_LOOKUP = {s.lower(): s for s in VALID_SUBJECTS}

# --- Grade / age ----------------------------------------------------------------
# Realistic boundaries. NOTE: api-contract.md says only "a recognised grade/age" and
# does not enumerate them, so this list is the concrete decision for that constraint
# and should be reflected back into the contract with team sign-off.
MIN_AGE = 5
MAX_AGE = 18

_GRADE_ORDINALS = {
    1: "1st",
    2: "2nd",
    3: "3rd",
    **{n: f"{n}th" for n in range(4, 13)},
}
VALID_GRADES = ("Kindergarten",) + tuple(
    f"{ordinal} grade" for ordinal in _GRADE_ORDINALS.values()
)
_GRADE_LOOKUP = {g.lower(): g for g in VALID_GRADES}

_AGE_RE = re.compile(r"^(?:age\s+)?(\d{1,2})$", re.IGNORECASE)


class ValidationError(Exception):
    """Carries a client-facing message for a 400 validation_error response."""


def is_valid_uuid(value: str) -> bool:
    """True only for the canonical 8-4-4-4-12 form Postgres accepts.

    uuid.UUID() alone is too lenient — it also parses urn:uuid:/braced/bare-hex
    forms that Postgres's uuid cast rejects (which would surface as a 500 instead
    of a clean 404 for an id that plainly can't exist).
    """
    try:
        return str(uuid.UUID(value)) == value.lower()
    except (ValueError, AttributeError, TypeError):
        return False


def validate_focus_subjects(value):
    """Return a canonicalised, de-duplicated subject list or raise ValidationError."""
    if not isinstance(value, list):
        raise ValidationError("focus_subjects must be an array of strings.")
    if not value:
        raise ValidationError("focus_subjects must not be empty.")

    cleaned = []
    seen = set()
    for item in value:
        if not isinstance(item, str):
            raise ValidationError("focus_subjects must contain only strings.")
        canonical = _SUBJECT_LOOKUP.get(item.strip().lower())
        if canonical is None:
            raise ValidationError(
                f"Unknown subject '{item}'. Allowed: {', '.join(VALID_SUBJECTS)}."
            )
        if canonical not in seen:
            seen.add(canonical)
            cleaned.append(canonical)
    return cleaned


def validate_grade_or_age(value):
    """Return a canonical grade string or 'Age N', else raise ValidationError."""
    if not isinstance(value, str) or not value.strip():
        raise ValidationError("grade_or_age must be a non-empty string.")

    text = value.strip()

    grade = _GRADE_LOOKUP.get(text.lower())
    if grade is not None:
        return grade

    match = _AGE_RE.match(text)
    if match:
        age = int(match.group(1))
        if MIN_AGE <= age <= MAX_AGE:
            return f"Age {age}"
        raise ValidationError(f"age must be between {MIN_AGE} and {MAX_AGE}.")

    raise ValidationError(
        "grade_or_age must be a recognised grade "
        f"(e.g. one of: {', '.join(VALID_GRADES)}) or an age {MIN_AGE}-{MAX_AGE}."
    )


def validate_knowledge_import(body):
    """Validate a POST /knowledge/import body (docs/api-contract.md §4).

    Exactly one shape depending on ``source_type``:
      * ``{"source_type": "text", "raw_text": "..."}`` — pasted study material.
      * ``{"source_type": "link", "url": "..."}`` — a page the server fetches itself.

    Returns ``(source_type, raw_text_or_none, url_or_none)``. Normalization/length-
    capping happens afterwards in the route, on whichever text is finally in hand (typed
    directly, or extracted from the fetched page) — this function only checks shape.
    """
    if not isinstance(body, dict):
        raise ValidationError("Request body must be a JSON object.")

    source_type = body.get("source_type")
    if source_type not in ("text", "link"):
        raise ValidationError("source_type must be 'text' or 'link'.")

    if source_type == "text":
        raw_text = body.get("raw_text")
        if not isinstance(raw_text, str) or not raw_text.strip():
            raise ValidationError("raw_text must be a non-empty string.")
        return source_type, raw_text, None

    url = body.get("url")
    if not isinstance(url, str) or not is_valid_http_url(url):
        raise ValidationError("url must be a valid http(s) URL.")
    return source_type, None, url


def validate_profile_update(body):
    """Validate a PUT /profile body (partial patch).

    Accepts grade_or_age and/or focus_subjects; at least one must be present.
    Returns ``(user_fields, profile_fields)`` — dicts holding only the fields that
    should be written to public.users and public.profiles respectively.
    """
    if not isinstance(body, dict):
        raise ValidationError("Request body must be a JSON object.")

    user_fields = {}
    profile_fields = {}

    if "grade_or_age" in body:
        user_fields["grade_or_age"] = validate_grade_or_age(body["grade_or_age"])

    if "focus_subjects" in body:
        profile_fields["focus_subjects"] = validate_focus_subjects(
            body["focus_subjects"]
        )

    if not user_fields and not profile_fields:
        raise ValidationError("Provide at least one of: grade_or_age, focus_subjects.")

    return user_fields, profile_fields


# --- OAuth sign-in ---------------------------------------------------------------
# Apple and Google only; EarnLock has no password auth. The upstream verifies the token
# signature — these bounds only keep obvious junk and oversized payloads off the wire.
OAUTH_PROVIDERS = ("apple", "google")

# A signed JWT with Apple/Google claims sits well under 2 KB; the ceiling is generous.
_MAX_ID_TOKEN_CHARS = 8192
_MAX_NONCE_CHARS = 256
_MAX_REFRESH_TOKEN_CHARS = 1024


def _require_bounded_string(value, field, maximum):
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} is required.")
    if len(value) > maximum:
        raise ValidationError(f"{field} is too long.")
    return value.strip()


def validate_oauth_signin(body):
    """Return (provider, id_token, nonce|None) for POST /auth/oauth."""
    if not isinstance(body, dict):
        raise ValidationError("Request body must be a JSON object.")

    provider = body.get("provider")
    if provider not in OAUTH_PROVIDERS:
        raise ValidationError(f"provider must be one of: {', '.join(OAUTH_PROVIDERS)}.")

    id_token = _require_bounded_string(
        body.get("id_token"), "id_token", _MAX_ID_TOKEN_CHARS
    )

    # Apple requires the raw nonce whose SHA-256 is embedded in the token. Google's
    # native flow may omit it (the project's "skip nonce check" setting decides).
    nonce = body.get("nonce")
    if nonce is not None:
        nonce = _require_bounded_string(nonce, "nonce", _MAX_NONCE_CHARS)

    return provider, id_token, nonce


def validate_refresh_token(body):
    """Return the refresh token for POST /auth/refresh."""
    if not isinstance(body, dict):
        raise ValidationError("Request body must be a JSON object.")
    return _require_bounded_string(
        body.get("refresh_token"), "refresh_token", _MAX_REFRESH_TOKEN_CHARS
    )
