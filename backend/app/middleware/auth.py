from functools import wraps

import jwt
from flask import current_app, g, jsonify, request


def _unauthorized(message):
    """401 in the contract's error envelope (api-contract.md §2)."""
    return jsonify({"error": {"code": "unauthorized", "message": message}}), 401


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
            )
            g.user_id = payload["sub"]
        except jwt.ExpiredSignatureError:
            return _unauthorized("Token expired")
        except (jwt.InvalidTokenError, jwt.PyJWKClientError):
            return _unauthorized("Invalid token")

        return f(*args, **kwargs)

    return decorated
