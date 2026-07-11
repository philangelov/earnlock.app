"""Account lifecycle — deletion.

Signing out is a client-side act (drop the tokens); it needs no endpoint. Deleting an
account does: only the service role may remove a Supabase Auth user, and the app must
never hold that key.

The delete is a hard delete of `auth.users`, which cascades through `public.users` into
profiles, the screen-time window, imported materials, quizzes, quiz history and subject
stats. Nothing is retained, and there is no tombstone to reconcile later.
"""

from flask import Blueprint, g, jsonify

from app.middleware.auth import require_auth
from app.services import supabase

account_bp = Blueprint("account", __name__, url_prefix="/account")


@account_bp.delete("")
@require_auth
def delete_account():
    try:
        supabase.delete_auth_user(g.user_id)
    except supabase.SupabaseError:
        return jsonify(
            {
                "error": {
                    "code": "internal_error",
                    "message": "Could not delete the account.",
                }
            }
        ), 500

    # 204: the account is gone, and there is nothing left to describe. The token
    # still parses until it expires, but every row it could reach is deleted.
    return "", 204
