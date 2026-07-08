import os

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key-for-ci")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key-for-ci")
# Force the offline generator in tests: an empty value keeps load_dotenv() (which reads
# a developer's real .env) from wiring the AI path into the suite. Tests that exercise
# the Claude path inject a fake generator explicitly.
os.environ.setdefault("ANTHROPIC_API_KEY", "")
from app import create_app

TEST_USER_ID = "user-123"


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def auth_headers(monkeypatch):
    """Bypass JWKS/ES256 verification: any bearer token authenticates as TEST_USER_ID.

    Matches the production auth path (middleware calls get_signing_key_from_jwt then
    jwt.decode) without needing a live Supabase project or real keypair.
    """
    from jwt import PyJWKClient

    class _SigningKey:
        key = "test-key"

    monkeypatch.setattr(
        PyJWKClient, "get_signing_key_from_jwt", lambda self, token: _SigningKey()
    )
    monkeypatch.setattr(
        "app.middleware.auth.jwt.decode", lambda *args, **kwargs: {"sub": TEST_USER_ID}
    )
    return {"Authorization": "Bearer test-token"}
