# EarnLock — Supabase Auth Setup & JWT Contract

Companion to [`architecture.md`](./architecture.md) §7.1 and
[`api-contract.md`](./api-contract.md) §2. This is the source of truth for how identity
works: what's configured on the Supabase project, the exact shape of the JWT, and the
request/response contract both the frontend and backend build against.

- **Supabase project ref:** `vkscemjmpyabipuyifgf`
- **Provider:** Email/password only (no OAuth, no magic link, no phone).

## 1. Supabase dashboard configuration (manual, one-time)

These are dashboard-level settings, not something checked into code. Set under
**Authentication → Providers → Email** and **Authentication → JWT Keys**:

| Setting | Value | Why |
|---|---|---|
| Email provider | **Enabled** | our only auth method |
| Confirm email | **Disabled (verified on project)** | signup must log the user in immediately — no "check your inbox" step. EarnLock targets kids/students; parents typically set the account up once and email deliverability shouldn't gate first use. This is also what [`0007_new_user_provisioning.sql`](../backend/migrations/0007_new_user_provisioning.sql) assumes: the account graph is provisioned synchronously on `auth.users` insert, not on confirmation. **Caution:** this toggle is easy to accidentally re-enable — it was found ON during this setup despite an earlier assumption it was off, which broke signup silently (see §6). |
| JWT signing key | **JWT Signing Keys, ECC (P-256) → ES256** (Project Settings → API → JWT Keys → "JWT Signing Keys" tab) | the project has migrated off the legacy HS256 shared secret to Supabase's newer asymmetric key rotation. The old HS256 secret still shows up under the "Legacy JWT Secret" tab as a **previously used key**, kept only so tokens issued before the migration (within their access-token expiry window) still verify — it is not used for new tokens and should not be used for new backend verification logic. |
| Access token (JWT) expiry | **3600s (default)** | standard 1-hour access token; the client refreshes via Supabase's refresh token flow rather than re-authenticating. No change needed for MVP. |
| Refresh token rotation | **Enabled (default)** | single-use, rotating refresh tokens — standard Supabase behavior, no action needed. |

> These toggles live only in the Supabase dashboard/API — there is nothing to check into
> this repo for them. If you're re-provisioning a project from scratch, set them before
> the first signup.

## 2. Auth flow

1. Client calls `POST /auth/register` or `POST /auth/login` on the **EarnLock backend**
   (not Supabase directly) — see [`api-contract.md`](./api-contract.md#2-auth).
2. The backend passes the request straight through to Supabase Auth
   (`/auth/v1/signup` or `/auth/v1/token?grant_type=password`) using the project's
   `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
3. On signup, Supabase inserts a row into `auth.users`, which fires the
   `on_auth_user_created` trigger ([`0007_new_user_provisioning.sql`](../backend/migrations/0007_new_user_provisioning.sql))
   and provisions `public.users` / `public.profiles` / `public.screentime_balance` in one
   transaction. `grade_or_age` is carried through as Supabase Auth signup metadata
   (`options.data.grade_or_age`) so the trigger can read it via
   `raw_user_meta_data ->> 'grade_or_age'`.
4. Supabase returns an `access_token` (JWT) + `user` object. The backend re-shapes this
   into the EarnLock response contract (see §4) and returns it to the client.
5. The client stores the JWT in `expo-secure-store` and sends it as
   `Authorization: Bearer <jwt>` on every subsequent request.
6. The backend's `require_auth` middleware (`backend/app/middleware/auth.py`) fetches the
   signing key from Supabase's JWKS endpoint (matched by the token's `kid` header),
   verifies the signature and expiry, then reads `g.user_id = payload["sub"]` — no DB
   round-trip needed just to authenticate a request.

This whole flow was verified end-to-end against the live project: register → real
Supabase JWT → `require_auth` accepts it and resolves `user_id` correctly; wrong password
→ `401 unauthorized`; malformed token → `401` `"Invalid token"`.

## 3. JWT anatomy

Supabase issues an **ES256**-signed JWT (asymmetric — verified via JWKS, not a shared
secret). Example decoded payload, captured from a real signup against this project:

```json
{
  "iss": "https://vkscemjmpyabipuyifgf.supabase.co/auth/v1",
  "sub": "6510f06c-5aa7-4810-817c-88a5271001af",
  "aud": "authenticated",
  "exp": 1783418365,
  "iat": 1783414765,
  "email": "kid@example.com",
  "phone": "",
  "app_metadata": { "provider": "email", "providers": ["email"] },
  "user_metadata": {
    "email": "kid@example.com",
    "email_verified": true,
    "grade_or_age": "5th grade",
    "phone_verified": false,
    "sub": "6510f06c-5aa7-4810-817c-88a5271001af"
  },
  "role": "authenticated",
  "aal": "aal1",
  "amr": [{ "method": "password", "timestamp": 1783414765 }],
  "session_id": "bbf502d7-6474-4799-b3b6-57ea6eb65cd3",
  "is_anonymous": false
}
```

JWT header (this is where the signing key is selected from):

```json
{ "alg": "ES256", "kid": "dac4644e-d959-450c-ba01-b375a671fc27", "typ": "JWT" }
```

| Claim | Type | Meaning for EarnLock |
|---|---|---|
| `sub` | uuid string | **This is `user_id`.** The only claim the backend needs to identify the caller; it's the FK target for every `public.*` table (see [`architecture.md`](./architecture.md#9-database-schema-mvp)). |
| `aud` | string | Always `"authenticated"` for a logged-in user. `require_auth` checks this explicitly. |
| `exp` / `iat` | unix timestamp | Standard expiry/issued-at. `pyjwt` rejects expired tokens automatically (`jwt.ExpiredSignatureError`). |
| `role` | string | Postgres role Supabase uses for RLS (`authenticated` vs `anon`). Not used by the Flask backend directly since it connects with the service role key, but relevant if the client ever queries Postgres directly (it currently doesn't — server-authoritative). |
| `user_metadata` | object | Arbitrary data supplied at signup via `options.data`, plus a few fields Supabase echoes back (`email`, `email_verified`, `sub`). This is where `grade_or_age` lives — **not** a top-level claim. |
| `app_metadata` | object | Supabase-managed (provider info). Not used by EarnLock today. |
| `session_id` | uuid | Identifies the refresh-token session. Not used by the backend (stateless verification), but useful if we ever add server-side session revocation. |

**Signing/verification:** ES256, verified against the project's JWKS endpoint
(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) — no shared secret to configure. The
backend fetches and caches the signing key by `kid` via `PyJWKClient`
(`backend/app/__init__.py`), then verifies with it in
`backend/app/middleware/auth.py`:

```python
signing_key = current_app.jwks_client.get_signing_key_from_jwt(token)
payload = jwt.decode(token, signing_key.key, algorithms=["ES256"], audience="authenticated")
```

`PyJWKClient` caches fetched keys in memory per app instance, so this doesn't hit the
network on every request — only on cache misses (new `kid`, e.g. after a key rotation).

## 4. Data contract (frontend ⟷ backend)

Exact request/response shapes are the contract in
[`api-contract.md` §2](./api-contract.md#2-auth) — reproduced here with the auth-specific
notes:

- **`POST /auth/register`** — body: `email`, `password` (min 8 chars, enforced by
  Supabase), `grade_or_age`. `grade_or_age` is required by EarnLock (NOT NULL on
  `public.users`) even though Supabase itself doesn't need it — the backend validates its
  presence before calling Supabase.
- **`POST /auth/login`** — body: `email`, `password`.
- Both return `{ "user": { "id", "email", "grade_or_age" }, "token": "<jwt>" }` on
  success. The frontend never decodes the JWT to get `grade_or_age` — it's flattened into
  the response `user` object directly.
- Client stores `token` in `expo-secure-store` and sends
  `Authorization: Bearer <token>` on every subsequent request. There is no separate
  refresh-token exchange exposed yet — when the access token expires the client
  re-authenticates. (Adding refresh-token support is a follow-up if session length
  becomes a UX problem; Supabase issues one alongside `access_token` if we want it later.)

## 5. Backend validation checklist (for whoever writes/reviews `require_auth`)

- [x] Reject requests with a missing/malformed `Authorization: Bearer <token>` header → 401.
- [x] Resolve the signing key from Supabase's JWKS endpoint by the token's `kid`, verify
      with algorithm **ES256 only** (don't accept `none` or HS256 — `pyjwt`'s
      `algorithms=` allowlist enforces this; a stale/legacy HS256 token would be rejected,
      which is correct since that key is retired).
- [x] Verify `aud == "authenticated"`.
- [x] Reject expired tokens (`jwt.ExpiredSignatureError` → 401).
- [x] Reject tokens with an unresolvable `kid` / malformed structure
      (`jwt.PyJWKClientError` / `jwt.InvalidTokenError` → 401).
- [x] Extract `user_id` from `sub`, not from the request body.
- [ ] Not yet needed: role/claim-based authorization beyond "is authenticated" — every
      protected route today is owner-scoped by `user_id`, there are no admin/staff roles.

## 6. Known gaps / follow-ups

- **This project has already rotated off the legacy HS256 JWT secret** — an earlier draft
  of this doc (and the original `require_auth` implementation) assumed the legacy secret
  was still current. It wasn't: live-testing against the real project showed the issued
  tokens are ES256, and the dashboard confirmed the HS256 key is listed as a *previous*
  key. If you ever see JWT verification failing for tokens that otherwise look valid,
  check Project Settings → API → JWT Keys first — don't assume the signing algorithm
  without checking.
- **"Confirm email" was found enabled** even though the intent (per this doc and the
  provisioning migration) is to have it off. It has since been turned off and re-verified
  against a live signup. If registration ever starts silently failing (Supabase returning
  `429 over_email_send_rate_limit` from its built-in mailer is a strong signal), check this
  toggle first.
