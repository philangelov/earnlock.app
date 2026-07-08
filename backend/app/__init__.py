from flask import Flask, jsonify
from flask_cors import CORS
from jwt import PyJWKClient

from app.config import get_config
from app.routes.auth import auth_bp
from app.routes.health import health_bp
from app.routes.knowledge import knowledge_bp
from app.routes.profile import profile_bp
from app.routes.quiz import quiz_bp
from app.routes.screentime import screentime_bp
from app.services.supabase import SupabaseError


def create_app():
    app = Flask(__name__)
    config = get_config()
    app.config.from_object(config)

    CORS(app, origins=config.ALLOWED_ORIGINS)

    jwks_url = f"{config.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    app.jwks_client = PyJWKClient(jwks_url)

    app.register_blueprint(auth_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(screentime_bp)

    @app.errorhandler(SupabaseError)
    def handle_supabase_error(exc):
        # Keep every failure in the contract's JSON envelope — never Flask's HTML 500.
        app.logger.error("Supabase request failed: %s", exc)
        return jsonify(
            {
                "error": {
                    "code": "internal_error",
                    "message": "Upstream data store error.",
                }
            }
        ), 500

    return app
