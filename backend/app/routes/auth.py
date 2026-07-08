import json
import urllib.error
import urllib.request

from flask import Blueprint, current_app, jsonify, request

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


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
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read()), res.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code


def _error(code, message, status):
    return jsonify({"error": {"code": code, "message": message}}), status


@auth_bp.post("/register")
def register():
    body = request.get_json(silent=True) or {}
    email = body.get("email")
    password = body.get("password")
    grade_or_age = body.get("grade_or_age")

    if not email or not password or not grade_or_age:
        return _error(
            "validation_error", "email, password and grade_or_age are required", 400
        )

    data, status = _supabase_auth_request(
        "signup",
        {"email": email, "password": password, "data": {"grade_or_age": grade_or_age}},
    )

    if status >= 400:
        message = (
            data.get("msg") or data.get("error_description") or "registration failed"
        )
        code = "conflict" if "already" in message.lower() else "validation_error"
        return _error(code, message, 409 if code == "conflict" else 400)

    return jsonify(
        {
            "user": {
                "id": data["user"]["id"],
                "email": data["user"]["email"],
                "grade_or_age": grade_or_age,
            },
            "token": data["access_token"],
        }
    ), 201


@auth_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        return _error("validation_error", "email and password are required", 400)

    data, status = _supabase_auth_request(
        "token?grant_type=password",
        {"email": email, "password": password},
    )

    if status >= 400:
        return _error("unauthorized", "invalid email or password", 401)

    return jsonify(
        {
            "user": {
                "id": data["user"]["id"],
                "email": data["user"]["email"],
                "grade_or_age": data["user"]
                .get("user_metadata", {})
                .get("grade_or_age"),
            },
            "token": data["access_token"],
        }
    ), 200
