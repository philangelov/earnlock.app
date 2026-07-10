"""Auth routes — Sign in with Apple / Google only.

EarnLock has no passwords. The client obtains an OpenID Connect identity token
natively (ASAuthorization on iOS, Google Sign-In) and posts it here; we exchange it
with Supabase Auth's `token?grant_type=id_token` endpoint, which verifies the token
signature against the provider's JWKS, provisions the account on first sign-in
(migration 0007's `on_auth_user_created` trigger), and hands back a session.

The exchange happens server-side, not in the app, so the anon key never ships in the
bundle -- and so `grade_or_age`, which the id_token grant cannot carry as signup
metadata, can be read back from the row the trigger just created.

Sessions expire (Supabase access tokens are short-lived), so `/auth/refresh` trades a
refresh token for a new pair. Without it every client would start 401ing an hour in.
"""

import json
import urllib.error
import urllib.request

from flask import Blueprint, current_app, jsonify, request

from app.services import supabase
from app.validation import (
    ValidationError,
    validate_oauth_signin,
    validate_refresh_token,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

_UPSTREAM_TIMEOUT_SECONDS = 10

# grade_or_age is NOT NULL in public.users. The provisioning trigger uses this same
# fallback when signup metadata carries no grade, which an id_token grant never can.
_UNSPECIFIED_GRADE = "unspecified"


def _supabase_auth_request(path, payload):
    url = f"{current_app.config['SUPABASE_URL']}/auth/v1/{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "apikey": current_app.config["SUPABASE_ANON_KEY"],
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_UPSTREAM_TIMEOUT_SECONDS) as res:
            return json.loads(res.read()), res.status
    except urllib.error.HTTPError as e:
        # Upstream error bodies are usually JSON, but 5xx gateway pages may not be.
        try:
            return json.loads(e.read()), e.code
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {"msg": "upstream auth service error"}, e.code
    except (urllib.error.URLError, TimeoutError):
        # Unreachable / timed out — surface as a 5xx so callers map it to 502.
        return {"msg": "auth service unreachable"}, 503


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


def _upstream_message(data, default):
    return data.get("msg") or data.get("error_description") or default


def _session(data):
    """Shape a Supabase token response into the contract's session body.

    `grade_or_age` is read from public.users rather than from user_metadata: the
    id_token grant has no metadata channel, so for an OAuth account the only
    authoritative copy is the row the provisioning trigger wrote.
    """
    user = data.get("user") or {}
    user_id = user.get("id")

    grade_or_age = None
    if user_id:
        try:
            grade_or_age = supabase.get_user_grade(user_id)
        except supabase.SupabaseError:
            # A usable session beats a 500 — the client can still PUT /profile.
            current_app.logger.warning("could not read grade_or_age for %s", user_id)

    return {
        "user": {
            "id": user_id,
            # Null for an Apple account that withheld its email; the schema allows it.
            "email": user.get("email"),
            "grade_or_age": grade_or_age or _UNSPECIFIED_GRADE,
        },
        "token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in"),
    }


@auth_bp.post("/oauth")
def oauth():
    """Exchange an Apple/Google identity token for an EarnLock session."""
    body = request.get_json(silent=True) or {}

    try:
        provider, id_token, nonce = validate_oauth_signin(body)
    except ValidationError as exc:
        return _error("validation_error", str(exc), 400)

    payload = {"provider": provider, "id_token": id_token}
    if nonce:
        payload["nonce"] = nonce

    data, status = _supabase_auth_request("token?grant_type=id_token", payload)

    if status >= 500:
        return _error("upstream_error", "auth service unavailable", 502)
    if status >= 400:
        # Covers a rejected or expired token, a nonce mismatch, and — the one worth
        # reading during setup — a provider not enabled on the Supabase project.
        return _error("unauthorized", _upstream_message(data, "sign-in failed"), 401)

    return jsonify(_session(data)), 200


@auth_bp.post("/refresh")
def refresh():
    """Trade a refresh token for a fresh access token."""
    body = request.get_json(silent=True) or {}

    try:
        refresh_token = validate_refresh_token(body)
    except ValidationError as exc:
        return _error("validation_error", str(exc), 400)

    data, status = _supabase_auth_request(
        "token?grant_type=refresh_token", {"refresh_token": refresh_token}
    )

    if status >= 500:
        return _error("upstream_error", "auth service unavailable", 502)
    if status >= 400:
        return _error("unauthorized", "session expired", 401)

    return jsonify(_session(data)), 200
