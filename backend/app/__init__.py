from flask import Flask
from flask_cors import CORS

from app.config import get_config
from app.routes.health import health_bp
from app.routes.quiz import quiz_bp


def create_app():
    app = Flask(__name__)
    config = get_config()
    app.config.from_object(config)

    CORS(app, origins=config.ALLOWED_ORIGINS)

    app.register_blueprint(health_bp)
    app.register_blueprint(quiz_bp)

    return app
