"""Inbound profile-field validation.

Runs before anything touches the database. Enforces:
  * focus_subjects  -> non-empty subset of the known subject whitelist
  * grade_or_age    -> a recognised grade OR a realistic age (5-18)

Server-managed fields (sos_debt_flag, last_sos_date, wakeup_completed_date) are NOT
accepted here at all: per the API contract they are "ignored if sent", so the caller
simply never forwards them to the DB layer.
"""

import re

# --- Focus subjects -------------------------------------------------------------
# Canonical set from docs/api-contract.md §3. Stored with this exact casing.
VALID_SUBJECTS = ("Math", "History", "Biology", "English")
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
        raise ValidationError(
            f"age must be between {MIN_AGE} and {MAX_AGE}."
        )

    raise ValidationError(
        "grade_or_age must be a recognised grade "
        f"(e.g. one of: {', '.join(VALID_GRADES)}) or an age {MIN_AGE}-{MAX_AGE}."
    )


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
        raise ValidationError(
            "Provide at least one of: grade_or_age, focus_subjects."
        )

    return user_fields, profile_fields
