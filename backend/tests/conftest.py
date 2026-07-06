import os
import pytest

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-ci")

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c
