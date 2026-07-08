"""Thin PostgREST data-access layer for the service-role (server-authoritative) path.

The mobile client never writes to Postgres directly (see docs/rls.md); every table
mutation is performed here by the backend using the ``service_role`` key, which has the
``BYPASSRLS`` attribute. This mirrors the urllib style already used in routes/auth.py so
no new HTTP dependency is introduced.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

from flask import current_app


class SupabaseError(Exception):
    """Raised when a PostgREST call fails for a non-recoverable reason."""


def _rest_request(method, path, *, params=None, body=None, prefer=None):
    base = current_app.config["SUPABASE_URL"]
    key = current_app.config["SUPABASE_SERVICE_ROLE_KEY"]

    url = f"{base}/rest/v1/{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"

    headers = {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    if prefer:
        headers["Prefer"] = prefer

    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read()
            return (json.loads(raw) if raw else None), res.status
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise SupabaseError(f"PostgREST {method} {path} failed ({e.code}): {detail}")
    except urllib.error.URLError as e:
        # Connection-level failure (DNS, refused, timeout). HTTPError is a subclass of
        # URLError, so this branch only handles the transport errors — surfaced as a
        # SupabaseError so callers' `except SupabaseError` handles them uniformly.
        raise SupabaseError(f"PostgREST {method} {path} connection failed: {e.reason}")


def get_user_grade(user_id):
    """Return the user's grade_or_age string, or None if the account row is missing."""
    rows, _ = _rest_request(
        "GET",
        "users",
        params={"id": f"eq.{user_id}", "select": "grade_or_age"},
    )
    return rows[0]["grade_or_age"] if rows else None


def get_profile_row(user_id):
    """Return the full profiles row dict, or None if the row is missing."""
    rows, _ = _rest_request(
        "GET",
        "profiles",
        params={
            "user_id": f"eq.{user_id}",
            "select": (
                "user_id,focus_subjects,sos_debt_flag,"
                "last_sos_date,wakeup_completed_date"
            ),
        },
    )
    return rows[0] if rows else None


def update_user_grade(user_id, grade_or_age):
    _rest_request(
        "PATCH",
        "users",
        params={"id": f"eq.{user_id}"},
        body={"grade_or_age": grade_or_age},
        prefer="return=minimal",
    )


def update_profile_subjects(user_id, focus_subjects):
    _rest_request(
        "PATCH",
        "profiles",
        params={"user_id": f"eq.{user_id}"},
        body={"focus_subjects": focus_subjects},
        prefer="return=minimal",
    )


def get_screentime_balance(user_id):
    """Return {remaining_seconds, updated_at}, or None if no wallet row exists yet."""
    rows, _ = _rest_request(
        "GET",
        "screentime_balance",
        params={"user_id": f"eq.{user_id}", "select": "remaining_seconds,updated_at"},
    )
    return rows[0] if rows else None
