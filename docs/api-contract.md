# EarnLock — API Blueprint & Data Contract

> Status: MVP contract. Frontend builds against these schemas (mocked at first), backend
> implements them for real — neither side waits on the other. Companion docs:
> [`architecture.md`](./architecture.md), [`ui-ux.md`](./ui-ux.md).
>
> **Any change to this file must be agreed by the whole team before code changes.**

## Conventions

- **Base URL:** `EARNLOCK_API_URL` (e.g. `https://api.earnlock.app`). All paths below are
  relative to it.
- **Format:** JSON in, JSON out. `Content-Type: application/json`.
- **Auth:** every endpoint except `/health`, `/auth/oauth`, `/auth/refresh` requires:
  ```
  Authorization: Bearer <supabase_jwt>
  ```
  The backend verifies the JWT's ES256 signature against Supabase's JWKS endpoint
  (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) and derives `user_id` from the `sub`
  claim. Clients never send `user_id` in the body — the token is the identity. Full claim
  schema: [`docs/auth.md`](./auth.md).
- **Times:** all durations are **seconds** (integers). Timestamps are ISO-8601 UTC.
- **IDs:** UUID v4 strings.

### Standard error shape
Every non-2xx response uses this body:
```json
{ "error": { "code": "string_code", "message": "Human readable message" } }
```

| HTTP | `code` examples | When |
|---|---|---|
| 400 | `validation_error` | malformed body / invalid field |
| 401 | `unauthorized` | missing/invalid/expired JWT |
| 403 | `forbidden` | authenticated but not allowed |
| 404 | `not_found` | resource does not exist / not owned by user |
| 409 | `conflict` | e.g. quiz already submitted, email already registered, SOS already used today |
| 500 | `internal_error` | unexpected server failure |
| 502 | `upstream_error` | Supabase Auth returned a 5xx during register/login |

---

## Endpoint index

| Method | Path | Auth | Purpose | Status |
|---|---|---|---|---|
| GET | `/health` | no | liveness check | implemented |
| POST | `/auth/oauth` | no | sign in with Apple/Google, obtain JWT | implemented |
| POST | `/auth/refresh` | no | trade a refresh token for a new JWT | implemented |
| GET | `/profile` | yes | read profile | implemented |
| PUT | `/profile` | yes | update profile | implemented |
| POST | `/knowledge/import` | yes | import study material (text or link) | **not yet implemented** |
| GET | `/knowledge` | yes | list imported materials | **not yet implemented** |
| POST | `/quiz/generate` | yes | generate a quiz | implemented (stub question bank) |
| POST | `/quiz/submit` | yes | submit answers, earn time | implemented |
| GET | `/screentime/balance` | yes | remaining earned seconds | **not yet implemented** |
| POST | `/sos` | yes | emergency unlock (once/day) | **not yet implemented** |
| GET | `/wakeup/status` | yes | is the morning lock active today | **not yet implemented** |
| POST | `/wakeup/complete` | yes | clear the morning lock | **not yet implemented** |

Endpoints marked *not yet implemented* are contract-only: the frontend mocks them and the
backend has not shipped them yet.

---

## 1. Health

### `GET /health`
**Response 200**
```json
{ "status": "ok" }
```

---

## 2. Auth

Auth is backed by Supabase Auth. **EarnLock has no passwords** — the only way in is Sign in
with Apple or Sign in with Google. The client obtains an OpenID Connect identity token from
the native provider SDK and posts it here; the backend exchanges it with Supabase's
`/auth/v1/token?grant_type=id_token`, which verifies the token against the provider's JWKS.

Doing the exchange server-side keeps the Supabase anon key out of the app bundle. Full JWT
claim schema and rationale: [`docs/auth.md`](./auth.md).

### `POST /auth/oauth`
**Request**
```json
{
  "provider": "apple | google",
  "id_token": "the provider's OIDC identity token",
  "nonce": "raw nonce (Apple only; omit for Google)"
}
```
**Response 200**
```json
{
  "user": { "id": "uuid", "email": "kid@example.com | null", "grade_or_age": "5th grade" },
  "token": "jwt",
  "refresh_token": "opaque",
  "expires_in": 3600
}
```

`email` is `null` when the provider withholds it (an Apple user may decline the email
scope). `grade_or_age` is read from `public.users`, not from the token: the id_token grant
carries no signup metadata, so a brand-new account reads `"unspecified"` until the client
follows up with `PUT /profile`.

**Errors:** `400 validation_error` (unknown provider, missing/oversized `id_token`),
`401 unauthorized` (token rejected, nonce mismatch, **or the provider is not enabled on the
Supabase project** — the upstream message is passed through, which is what tells you which),
`502 upstream_error` (Supabase Auth 5xx or unreachable).

### `POST /auth/refresh`
Access tokens are short-lived. Trade a refresh token for a new pair.

**Request**
```json
{ "refresh_token": "opaque" }
```
**Response 200** — identical body to `POST /auth/oauth`.

**Errors:** `400 validation_error`, `401 unauthorized` (expired/revoked/rotated away),
`502 upstream_error`.

> Both tokens are stored client-side in `expo-secure-store`. The access token is sent as the
> Bearer token on every subsequent request; on a `401` the client refreshes once and replays
> the request before surfacing an error.

### Apple's nonce

The client generates a random raw nonce, hands **SHA-256(raw)** to Apple, and sends the
**raw** value here. Supabase hashes it again and compares against the `nonce` claim inside
the signed token. Sending the hash to both ends, or the raw value to Apple, fails the check.

Google's native SDK does not surface a nonce, so it is omitted; the Supabase Google provider
must have *Skip nonce check* enabled for iOS.

---

## 3. Profile

### `GET /profile`
**Response 200**
```json
{
  "user_id": "uuid",
  "grade_or_age": "5th grade",
  "focus_subjects": ["Math", "History"],
  "sos_debt_flag": false,
  "last_sos_date": "2026-07-05",
  "wakeup_completed_date": "2026-07-06"
}
```
`last_sos_date` / `wakeup_completed_date` are `null` if never set.

### `PUT /profile`
Updates only the user-editable fields. `sos_debt_flag` and the dates are server-managed and
ignored if sent.
**Request**
```json
{
  "grade_or_age": "6th grade",
  "focus_subjects": ["Math", "Biology", "English"]
}
```
**Response 200** — same shape as `GET /profile`.
**Validation:** `focus_subjects` must be a non-empty subset of the known subject list
(`Math`, `History`, `Biology`, `English`, `Physics`, `Chemistry`, `Geography`, `Coding`); `grade_or_age` must be a recognised grade/age.
**Errors:** `400 validation_error`, `404 not_found` (profile rows missing),
`500 internal_error` (datastore failure). `GET /profile` can return the same `404`/`500`.

---

## 4. Knowledge Import

### `POST /knowledge/import`
Accepts pasted text **or** a link. If a link, the server fetches the page, strips HTML, and
stores clean text (length-capped).
**Request** (one of the two)
```json
{ "source_type": "text", "raw_text": "Photosynthesis is the process by which..." }
```
```json
{ "source_type": "link", "url": "https://en.wikipedia.org/wiki/Photosynthesis" }
```
**Response 201**
```json
{
  "material_id": "uuid",
  "source_type": "link",
  "preview": "Photosynthesis is the process by which plants...",
  "created_at": "2026-07-06T09:12:00Z"
}
```
`preview` is the first ~200 chars of the normalized text.
**Validation:** `source_type ∈ {text, link}`; for `text`, `raw_text` non-empty; for `link`,
a valid URL. Extracted text is truncated to `KNOWLEDGE_MAX_CHARS`.
**Errors:** `400 validation_error`, `422 unprocessable` (link couldn't be fetched/parsed).

### `GET /knowledge`
Lists the user's materials for the Knowledge Hub UI (newest first).
**Response 200**
```json
{
  "materials": [
    {
      "material_id": "uuid",
      "source_type": "link",
      "preview": "Photosynthesis is the process by which plants...",
      "created_at": "2026-07-06T09:12:00Z"
    }
  ]
}
```

---

## 5. Quiz

### `POST /quiz/generate`
Generates a quiz. The **number of questions is decided by the server** — clients must not
assume 5: `QUIZ_LEN_DEBT` (default 7) if the caller's `sos_debt_flag` is set, otherwise
`QUIZ_LEN_NORMAL` (default 5).

**Request:** no body. The endpoint takes **no request fields** in the current
implementation — the server decides everything from the caller's identity (JWT) and
their debt flag. Questions currently come from a **stubbed static question bank**
(`backend/app/quiz_content.py`), not from AI generation or imported materials.

**Response 200**
```json
{
  "quiz_id": "uuid",
  "user_id": "uuid",
  "question_count": 5,
  "questions": [
    {
      "id": "q1",
      "prompt": "What is 7 × 8?",
      "options": ["54", "56", "48", "64"]
    }
  ],
  "generated_at": "2026-07-06T09:15:00Z"
}
```
> **Security:** the response deliberately **omits** `correct_index` and `explanation`.
> Scoring happens on the server at submit time so answers can't be read from the payload.
> The full quiz (including the answer key) is persisted server-side in the `quizzes` table.

**Errors:** `401 unauthorized`. (No request body means no body validation errors today.)

#### Future extension: `source` selection — **not yet implemented**

The planned request body lets the client select where questions come from. **None of this
is implemented yet** — the server currently ignores any request body. When it ships, the
contract is:

```json
{ "source": "profile", "focus_subject": "Math" }
```
```json
{ "source": "material", "material_id": "uuid" }
```
```json
{ "source": "text", "raw_text": "Photosynthesis converts light energy...", "focus_subject": "Biology" }
```
- `source: "profile"` → questions from the user's grade + focus subjects. `focus_subject` is
  optional and narrows it to one subject.
- `source: "material"` → questions from a previously imported material (`material_id` from
  `/knowledge/import`). Must be owned by the caller.
- `source: "text"` → questions generated directly from **raw imported text / a prompt** passed
  inline (`raw_text`), without first persisting a material. `focus_subject` optional.
  `raw_text` is capped at `KNOWLEDGE_MAX_CHARS`; longer input is rejected with `400`.

The response would then also echo a `source` field, and add these errors:
`400 validation_error` (bad source / missing `material_id` / missing or oversized
`raw_text`), `404 not_found` (material not owned by user).

#### Internal data-interchange contract (text extraction → AI generator) — **not yet implemented**

This is the format the **knowledge/text-extraction module** will hand to the **AI question
generator** module, regardless of which `source` triggered it. It is an internal boundary
(not exposed over HTTP), but it is fixed here so P2 (extraction) and P1 (generation) agree.
Neither module exists yet — the current stub bank replaces both.

**Generator input**
```json
{
  "source": "profile | material | text",
  "grade_or_age": "5th grade",
  "focus_subject": "Biology | null",
  "material_text": "normalized plain text, HTML stripped, capped at KNOWLEDGE_MAX_CHARS | null",
  "question_count": 5
}
```
- For `source: "profile"`, `material_text` is `null` and the generator uses
  `grade_or_age` + `focus_subject`.
- For `source: "material"` / `"text"`, `material_text` is the **normalized** text: HTML
  removed, whitespace collapsed, truncated to `KNOWLEDGE_MAX_CHARS`. The generator never
  receives raw HTML or a URL.
- `question_count` is already resolved by the caller (5, or 7 under SOS debt).

**Generator output** (before the server strips answers for the HTTP response)
```json
{
  "questions": [
    {
      "prompt": "Which organelle carries out photosynthesis?",
      "options": ["Chloroplast", "Mitochondrion", "Nucleus", "Ribosome"],
      "correct_index": 0,
      "explanation": "Chloroplasts contain chlorophyll, which captures light energy."
    }
  ]
}
```
Validation applied to every generator's output: exactly 4 `options`, exactly one
`correct_index` in `0..3`, no duplicate options, non-empty `prompt`. On invalid output: retry
once, then fall back to a dummy question. The server assigns each question an `id`, then
**omits `correct_index` and `explanation`** from the `/quiz/generate` HTTP response.

### `POST /quiz/submit`
Submits answers for a generated quiz. The server scores, computes earned time, credits the
balance, records history, and — for the current MVP — returns per-question correctness plus
an `explanation` for every **wrong** answer (used by Learning Mode).

**Request**
```json
{
  "quiz_id": "uuid",
  "answers": [
    { "id": "q1", "selected_index": 1 },
    { "id": "q2", "selected_index": 0 },
    { "id": "q3", "selected_index": null }
  ]
}
```
- `quiz_id` must be a **UUID string**. A malformed (non-UUID) `quiz_id` is answered with
  `404 not_found` — a malformed id cannot exist, and this spares the datastore a
  guaranteed uuid-cast error.
- Each answer is `{ "id": string, "selected_index": integer | null }`. `null` means the
  question was skipped (graded as wrong). JSON booleans (`true`/`false`) for
  `selected_index` are **explicitly rejected** with `400 validation_error` — they must not
  be silently graded as index 1/0.

**Response 200**
```json
{
  "quiz_id": "uuid",
  "user_id": "uuid",
  "correct_count": 4,
  "total": 5,
  "earned_seconds": 720,
  "new_balance_seconds": 1320,
  "sos_debt_cleared": true,
  "results": [
    { "id": "q1", "correct": true,  "selected_index": 1, "correct_index": 1,
      "explanation": null },
    { "id": "q2", "correct": false, "selected_index": 0, "correct_index": 2,
      "explanation": "6 × 8 is 48, not 40 — count by sixes: 6, 12, 18..." }
  ],
  "submitted_at": "2026-07-06T09:20:00Z"
}
```
- `earned_seconds` is **linear per correct answer, capped at the full reward**:
  `min(correct_count, QUIZ_CORRECT_TARGET) * (REWARD_SECONDS / QUIZ_CORRECT_TARGET)`
  — i.e. `180 s` per correct answer, maxing at `900 s` for 5+ correct. A 7-question SOS-debt
  quiz still tops out at `900 s`. See [architecture §8](./architecture.md#earned-seconds-formula).
- `new_balance_seconds` is the authoritative balance the client should display and pass to
  the native `startShield`.
- `sos_debt_cleared` is `true` when this submit satisfied an outstanding SOS debt.
**Errors:** `400 validation_error`, `404 not_found` (unknown quiz_id), `409 conflict`
(quiz already submitted).

---

## 6. Screen Time balance

### `GET /screentime/balance`
Read by both the native lock (P3) and the countdown timer (P4).
**Response 200**
```json
{ "remaining_seconds": 1320, "updated_at": "2026-07-06T09:20:00Z" }
```
If no balance row exists yet, returns `remaining_seconds: 0`.

---

## 7. SOS (emergency unlock)

### `POST /sos`
Grants a one-per-day emergency unlock and raises the quiz debt.
**Request:** empty body `{}`.
**Response 200**
```json
{
  "granted": true,
  "unlock_seconds": 120,
  "debt_raised": true,
  "next_quiz_length": 7
}
```
**Response 409** — already used today:
```json
{ "error": { "code": "conflict", "message": "SOS already used today." } }
```
Behaviour: sets `last_sos_date = today` and `sos_debt_flag = true`; the next
`/quiz/generate` returns `next_quiz_length` questions; a successful submit clears the flag.

---

## 8. Wake-Up Lock

### `GET /wakeup/status`
**Response 200**
```json
{ "active": true, "required_questions": 3, "completed_today": false }
```
`active` = the morning lock applies today and hasn't been cleared. Resets daily.

### `POST /wakeup/complete`
Marks the 3 morning questions solved for today. Call after the user passes the wake-up quiz.
**Request**
```json
{ "quiz_id": "uuid" }
```
**Response 200**
```json
{ "completed": true, "wakeup_completed_date": "2026-07-06" }
```
**Errors:** `400 validation_error`, `409 conflict` (already completed today).

---

## Database schema

PostgreSQL on Supabase. Every table has **Row-Level Security** enabled (and forced).
Clients (the `authenticated` role) get owner-scoped **SELECT-only** access — policies of
the form `(select auth.uid()) = user_id` — and their `INSERT`/`UPDATE`/`DELETE` privileges
are **revoked**: all writes go through the backend's `service_role` key, which bypasses
RLS. The `quizzes` table is stricter still: **deny-all** (no policies), because it stores
the answer keys. Full policy matrix and rationale:
[`backend/docs/rls.md`](../backend/docs/rls.md). Migrations are plain SQL, checked into
`backend/migrations/`.

```sql
-- users: app-level profile of the account (mirrors auth.users)
create table users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  grade_or_age text not null,
  created_at   timestamptz not null default now()
);

-- profiles: preferences + hook state
create table profiles (
  user_id               uuid primary key references users(id) on delete cascade,
  focus_subjects        text[] not null default '{}',
  sos_debt_flag         boolean not null default false,
  last_sos_date         date,
  wakeup_completed_date date
);

-- knowledge_materials: imported study text
create table knowledge_materials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  raw_text    text not null,
  source_type text not null check (source_type in ('text', 'link')),
  created_at  timestamptz not null default now()
);

-- screentime_balance: the currency (server-authoritative)
create table screentime_balance (
  user_id           uuid primary key references users(id) on delete cascade,
  remaining_seconds integer not null default 0 check (remaining_seconds >= 0),
  updated_at        timestamptz not null default now()
);

-- quizzes: generated quizzes + answer keys (migration 0009) — deny-all RLS
create table quizzes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  questions    jsonb not null,  -- full items incl. correct_index; never exposed to clients
  submitted_at timestamptz,     -- set on first score; idempotency guard for /quiz/submit
  created_at   timestamptz not null default now()
);

-- quiz_history: audit of each completed quiz
create table quiz_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  quiz_id        uuid not null,
  correct_count  integer not null,
  earned_seconds integer not null,
  created_at     timestamptz not null default now()
);
```

RLS sketch (repeat per table — read-only for clients, writes only via `service_role`):
```sql
alter table profiles enable row level security;
alter table profiles force row level security;
revoke insert, update, delete on profiles from authenticated;
create policy "profiles_select_own" on profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);
```
`quizzes` gets the same `revoke` + `enable`/`force` but **no policy at all** — deny-all
for clients, since any exposed row would leak `questions[].correct_index`. (The Supabase
advisor's INFO-level `rls_enabled_no_policy` lint on it is intentional.)

### Field ↔ endpoint map
| Table.field | Set/used by |
|---|---|
| `screentime_balance.remaining_seconds` | credited by `/quiz/submit`, `/sos`; read by `/screentime/balance` |
| `profiles.sos_debt_flag` | set by `/sos`, read by `/quiz/generate`, cleared by `/quiz/submit` |
| `profiles.last_sos_date` | enforces SOS once/day in `/sos` |
| `profiles.wakeup_completed_date` | set by `/wakeup/complete`, read by `/wakeup/status` |
| `profiles.focus_subjects` | set by `PUT /profile`; will be used by `/quiz/generate` (future `source=profile` — not yet implemented) |
| `knowledge_materials` | written by `/knowledge/import`, listed by `/knowledge`; will be read by `/quiz/generate` (future `source=material` — not yet implemented) |
| `quizzes` | written by `/quiz/generate` (questions + answer key); read and stamped (`submitted_at`) by `/quiz/submit` |
| `quiz_history` | appended by `/quiz/submit` |
