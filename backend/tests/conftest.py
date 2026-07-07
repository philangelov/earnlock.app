import os

import jwt
import pytest

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-ci")

from app import create_app
from app.routes.quiz import reset_quiz_state


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture(autouse=True)
def clean_quiz_state():
    reset_quiz_state()


@pytest.fixture
def auth_headers():
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"},
        os.environ["SUPABASE_JWT_SECRET"],
        algorithm="HS256",
    )
    return {"Authorization": "Bearer " + token}
