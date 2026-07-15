from functools import wraps

import jwt
from flask import current_app, g, jsonify, request


def _unauthorized(message):
    """401 in the contract's error envelope (api-contract.md §2)."""
    return jsonify({"error": {"code": "unauthorized", "message": message}}), 401


def _safe_header(token):
    """The token's unverified header (alg/kid), for diagnostics only — never trusted."""
    try:
        header = jwt.get_unverified_header(token)
        return {"alg": header.get("alg"), "kid": header.get("kid")}
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return _unauthorized("Missing or invalid Authorization header")

        token = auth_header.split(" ", 1)[1]
        try:
            signing_key = current_app.jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
                # A few seconds of tolerance for clock skew between this server and the
                # token issuer — without it a token whose iat/nbf is a second ahead is
                # rejected as "not yet valid", which reads as a broken login.
                leeway=10,
            )
            g.user_id = payload["sub"]
        except jwt.ExpiredSignatureError:
            return _unauthorized("Token expired")
        except (jwt.InvalidTokenError, jwt.PyJWKClientError) as exc:
            # Log the specific cause (and the token's alg/kid) so a real verification
            # failure is diagnosable — the client only ever sees a generic 401.
            current_app.logger.warning(
                "JWT verification failed (%s): %s; header=%s",
                type(exc).__name__,
                exc,
                _safe_header(token),
            )
            return _unauthorized("Invalid token")

        return f(*args, **kwargs)

    return decorated
