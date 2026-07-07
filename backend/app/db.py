"""Supabase access for the backend (service-role, server-authoritative writes).

The client is created lazily and imported lazily so the app boots for auth-only work and
the test suite can run without `supabase` installed / without a live project — the quiz
data layer is mocked in tests. A missing service-role key fails when used, not at
import time.
"""

from functools import lru_cache

from flask import current_app


@lru_cache(maxsize=None)
def _make_client(url: str, key: str):
    # Imported here (not at module top) so importing this module never requires the
    # `supabase` package unless a real DB call is actually made.
    from supabase import create_client

    return create_client(url, key)


def get_supabase():
    """Return a service-role Supabase client, or raise a clear error if unconfigured."""
    url = current_app.config["SUPABASE_URL"]
    key = current_app.config.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not set — the backend cannot write the "
            "server-authoritative screen-time currency. Add it to backend/.env."
        )
    return _make_client(url, key)
