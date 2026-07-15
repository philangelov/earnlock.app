"""Inbound profile-field validation.

Runs before anything touches the database. Enforces:
  * focus_subjects  -> non-empty subset of the known subject whitelist
  * grade_or_age    -> a recognised grade OR a realistic age (5-18)

Server-managed fields (sos_debt_flag, last_sos_date, wakeup_completed_date) are NOT
accepted here at all: per the API contract they are "ignored if sent", so the caller
simply never forwards them to the DB layer.
"""

import base64
import binascii
import re
import uuid

from app.text_extraction import is_valid_http_url

# --- Focus subjects -------------------------------------------------------------
# The PREDEFINED subjects the app offers up front (SUBJECT_DEFS in
# frontend/src/store/content.ts). This is no longer a whitelist: a learner may study
# ANY subject, and both `profiles.focus_subjects` (text[]) and `subject_stats` (text PK)
# key on free text, so a custom subject earns and tracks like a built-in. The set is
# used only to canonicalise the CASING of recognised subjects and to seed the
# generator's subject enum. Keep roughly in step with the app's predefined list.
VALID_SUBJECTS = (
    "Math",
    "History",
    "Biology",
    "English",
    "Physics",
    "Chemistry",
    "Geography",
    "Coding",
    "Literature",
    "Computer Science",
    "Economics",
    "Art",
    "Music",
    "Languages",
    "Psychology",
    "Astronomy",
    "Health",
    "Statistics",
)
_SUBJECT_LOOKUP = {s.lower(): s for s in VALID_SUBJECTS}

# Bounds on free-text subjects — keep junk and abuse off the wire. The per-subject cap
# matches the app's normalizeSubject() (frontend/src/store/content.ts).
_MAX_SUBJECT_LEN = 40
_MAX_SUBJECTS = 30
_WHITESPACE_RE = re.compile(r"\s+")


def _normalize_subject(value: str) -> str:
    """Trim, collapse inner whitespace, cap length. Mirrors the client's normaliser."""
    return _WHITESPACE_RE.sub(" ", value).strip()[:_MAX_SUBJECT_LEN]


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
    """Return a canonicalised, de-duplicated subject list or raise ValidationError.

    Any non-empty subject is accepted (custom subjects are first-class). A recognised
    name is canonicalised to its predefined casing so "math"/"MATH" land in one bucket;
    an unrecognised one is kept as the learner typed it (normalised). De-dup is
    case-insensitive.
    """
    if not isinstance(value, list):
        raise ValidationError("focus_subjects must be an array of strings.")
    if not value:
        raise ValidationError("focus_subjects must not be empty.")

    cleaned = []
    seen = set()
    for item in value:
        if not isinstance(item, str):
            raise ValidationError("focus_subjects must contain only strings.")
        normalized = _normalize_subject(item)
        if not normalized:
            raise ValidationError("focus_subjects must not contain blank entries.")
        canonical = _SUBJECT_LOOKUP.get(normalized.lower(), normalized)
        key = canonical.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(canonical)
    if len(cleaned) > _MAX_SUBJECTS:
        raise ValidationError(
            f"focus_subjects can contain at most {_MAX_SUBJECTS} subjects."
        )
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


# A filename is a display label (the material's title), not a path — keep it short and
# strip anything that isn't part of a human-readable name.
_MAX_FILENAME_LEN = 120


def validate_file_import(body, *, allowed_media_types, max_bytes):
    """Validate a POST /knowledge/import body with ``source_type='file'``.

    Shape: ``{"source_type": "file", "data": "<base64>", "mime_type": "...",
    "filename": "..."}``. The file is transcribed to text server-side
    (app/ai/extractor.py) before storage, so this only checks that the payload is a
    decodable file of an allowed type and a sane size. Returns
    ``(data_b64, media_type, filename_or_none)``.
    """
    if not isinstance(body, dict):
        raise ValidationError("Request body must be a JSON object.")

    media_type = body.get("mime_type")
    if not isinstance(media_type, str) or media_type not in allowed_media_types:
        raise ValidationError(
            "mime_type must be one of: " + ", ".join(allowed_media_types) + "."
        )

    data = body.get("data")
    if not isinstance(data, str) or not data.strip():
        raise ValidationError("data must be a base64-encoded file.")

    # Validate that it decodes, and bound the *decoded* size — the wire cap
    # (MAX_CONTENT_LENGTH) is the base64 envelope; this is the real file size.
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValidationError("data must be valid base64.") from exc
    if not raw:
        raise ValidationError("The uploaded file is empty.")
    if len(raw) > max_bytes:
        mb = max_bytes / 1_000_000
        raise ValidationError(f"The file is too large (max {mb:.0f} MB).")

    filename = body.get("filename")
    if filename is not None:
        if not isinstance(filename, str):
            raise ValidationError("filename must be a string.")
        filename = _WHITESPACE_RE.sub(" ", filename).strip()[:_MAX_FILENAME_LEN] or None

    return data, media_type, filename


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
