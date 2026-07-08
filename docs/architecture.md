# EarnLock — Technical Architecture

> Status: MVP blueprint. This document is the source of truth for how the system
> is put together. The companion docs are [`api-contract.md`](./api-contract.md)
> (endpoint schemas) and [`ui-ux.md`](./ui-ux.md) (design system + screens).

## 1. Product in one paragraph

EarnLock locks distracting apps on a child's iPhone and gives back **screen time as
a currency** that is earned by answering AI-generated multiple-choice quizzes. Answer
correctly → earn seconds → apps unlock until the balance runs out, then they lock again.
Quizzes are generated from the child's grade/subjects or from study material they import.
Extra "hooks" shape behaviour: a once-a-day **SOS** emergency unlock (that raises a quiz
"debt"), a morning **Wake-Up Lock**, and a forced-reading **Learning Mode** on wrong answers.

## 2. Scope of the MVP

- **Platform: iOS only.** The lock mechanism depends on Apple's Family Controls /
  Screen Time frameworks, which have no Android equivalent. Android is explicitly out of
  scope for the MVP. (Everything except the native lock module is cross-platform-capable,
  so the app still runs on web/Android for development, just without real locking.)
- **AI is stubbed for now.** Quiz generation returns **static/dummy questions** behind a
  provider interface. A real model is wired in later without changing the API contract or
  any client code (see §6).

## 3. High-level topology

```
┌─────────────────────────────┐        HTTPS + JWT        ┌──────────────────────────┐
│  frontend/  (Expo SDK 57)    │ ────────────────────────▶ │  backend/  (Flask)       │
│                              │                           │                          │
│  Expo Router (file routes)   │        Supabase JWT       │  JWT middleware (JWKS)   │
│  React Native 0.86 / RN-Web  │ ◀──────────────────────── │  Blueprints per domain   │
│                              │      JSON responses       │  Quiz engine + currency  │
│  Native iOS module (Swift):  │                           │  Question bank (stub)    │
│   FamilyControls / Screen    │                           │                          │
│   Time — PLANNED, not yet    │                           └───────────┬──────────────┘
└──────────────┬──built────────┘                                       │ Postgres (SQL + RLS)
               │                                                        ▼
               │  Screen Time authorization                 ┌──────────────────────────┐
               │  (local, on-device)                        │  Supabase                │
               ▼                                             │   Auth (email/password)  │
        iOS Screen Time API                                  │   PostgreSQL + RLS       │
                                                             └──────────────────────────┘
```

Three independently deployable parts, one contract between them:

1. **Mobile client** — Expo app in `frontend/`. Owns UI, local Screen Time enforcement
   (native module planned, not yet implemented), and calls the backend for everything
   data-related. Never talks to Postgres directly for app logic; it obtains its JWT
   through the backend's `/auth` passthrough to Supabase Auth (§7.1).
2. **Backend** — Flask API. Owns all business rules (currency math, SOS debt, wake-up
   status, quiz generation). Validates the Supabase JWT on every protected request and
   reads/writes Postgres.
3. **Supabase** — managed Postgres + Auth. Issues JWTs, stores all persistent data, and
   enforces per-user isolation with Row-Level Security.

**Why the backend owns the currency, not the client:** earned-seconds math and SOS/debt
rules must not be forgeable from a jailbroken or patched client. The client displays the
balance and enforces the lock locally, but the *number* is always authoritative from the
server.

## 4. Repository layout (monorepo)

```
earnlock/
├── frontend/                   # Expo app (SDK 57)
│   ├── src/
│   │   ├── app/                # Expo Router file-based routes (incl. (tabs) group)
│   │   ├── components/         # Screen, PrimaryButton, ProgressRing, TabBar, Icon
│   │   ├── store/              # zustand store (useEarnLock) + static content
│   │   └── theme/              # tokens.ts design tokens (see ui-ux.md) + theme.tsx
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
├── backend/                    # Flask API
│   ├── app/
│   │   ├── __init__.py         # app factory (CORS, JWKS client, blueprints)
│   │   ├── routes/             # blueprints: auth, health, profile, quiz
│   │   ├── middleware/         # JWT auth middleware (require_auth)
│   │   ├── services/           # Supabase PostgREST client (service-role)
│   │   ├── repos/              # data access (quiz_repo)
│   │   ├── ai/                 # Explainer interface + DummyExplainer stub
│   │   ├── config.py           # env config + quiz reward rule constants
│   │   ├── validation.py       # shared grade_or_age validation
│   │   └── quiz_content.py     # stubbed static question bank
│   ├── migrations/             # SQL migrations 0001..0011 (checked in; 0001–0010 applied to the live DB so far)
│   ├── tests/                  # pytest suite
│   ├── docs/rls.md             # RLS design notes
│   ├── run.py                  # entrypoint: `python run.py` → port 5000
│   └── requirements.txt
├── docs/                       # this folder
└── README.md                   # how to run both halves
```

> **Planned, not yet implemented:** a local Expo native module in Swift at
> `frontend/modules/earnlock-screentime/` (§ Native below), a `frontend/src/lib/` API
> client layer, and backend blueprints for `/knowledge`, `/screentime/balance`, `/sos`
> and `/wakeup` (see §7).

## 5. Technology stack

### Mobile (`/frontend`)
| Concern | Choice | Version / notes |
|---|---|---|
| Framework | Expo | SDK **57** (`~57.0.1`) — read `docs.expo.dev/versions/v57.0.0` before coding |
| Runtime | React Native / React | 0.86.0 / 19.2.3 |
| Routing | Expo Router | v57, `typedRoutes` + React Compiler enabled |
| Language | TypeScript | ~6.0.3, `strict: true` |
| Package manager | **Bun** | `bun.lock` is authoritative (ignore README's `npm`) |
| Web target | react-native-web | `output: static` |
| Animation | react-native-reanimated | 4.5.0 (used by the quiz, home, journey, recap and import screens) |
| Path aliases | `@/*` → `src/*` | from `tsconfig.json` |

**Not yet installed, needed:** a data-fetching layer, a Supabase client, and secure token
storage. Recommended additions:
- `@supabase/supabase-js` — Auth only (login/register → JWT).
- `expo-secure-store` — persist the JWT securely.
- A thin `fetch` wrapper in `frontend/src/lib/api.ts` (no need for a heavy client). Optionally
  `@tanstack/react-query` if we want caching/retries for `balance`/`profile`.

### Backend (`/backend`)
| Concern | Choice | Notes |
|---|---|---|
| Framework | **Flask** | app factory + blueprints per domain |
| Auth | Supabase JWT validation | verify signature against Supabase's JWKS endpoint (ES256); no session state |
| CORS | flask-cors | origins from `ALLOWED_ORIGINS` (Expo dev origins + production scheme) |
| DB access | PostgREST over HTTPS | thin stdlib-`urllib` client in `app/services/supabase.py`; writes use the service role (bypasses RLS), so the backend is the only writer |
| Config | env vars | `FLASK_ENV` **defaults to `production`** (fail closed — debug only when explicitly `development`); secrets never committed |
| Tests | pytest | currency edge cases are the priority target |

### Data & Auth
- **Supabase**: PostgreSQL + Auth (email/password). Row-Level Security on every table so a
  user can only ever read/write their own rows.

### Native (iOS, `frontend/modules/earnlock-screentime`) — planned, not yet implemented
- A **local Expo native module in Swift** exposing a clean TypeScript surface (the
  directory does not exist yet). Uses:
  - **FamilyControls** — `AuthorizationCenter.requestAuthorization()` and
    `FamilyActivityPicker` for choosing which apps to lock (the "Blacklist").
  - **ManagedSettings** — apply/remove the shield that actually blocks apps.
  - **DeviceActivity** — schedule the 07:30 Wake-Up Lock and time-limited shields.
- **Requires the Apple Family Controls entitlement**, whose approval is slow. Requesting it
  is a day-one, critical-path task and a potential blocker — surface early if denied.

TypeScript surface (what the rest of the app is allowed to call — no Swift leaks upward):
```ts
requestAuthorization(): Promise<'approved' | 'denied'>
pickApps(): Promise<AppSelectionToken>          // FamilyActivityPicker
lockApps(selection: AppSelectionToken): Promise<void>
unlockApps(): Promise<void>
startShield(durationSeconds: number): Promise<void>   // lock again after time runs out
scheduleWakeUpLock(time: '07:30'): Promise<void>       // DeviceActivitySchedule
```

## 6. AI question generation (pluggable, stubbed now)

The backend keeps AI behind interfaces and swaps the implementation later — the API
contract in [`api-contract.md`](./api-contract.md) does not change when a real model is
connected.

**Implemented today:**
- **Question generation is a static stub.** `POST /quiz/generate` builds quizzes from a
  curated question bank in `backend/app/quiz_content.py` (`build_questions`), cycling
  through the bank when the configured quiz length exceeds it. There is no profile- or
  material-driven generation yet.
- **Wrong-answer remediation is behind a real interface.** `backend/app/ai/explainer.py`
  defines an `Explainer` protocol with a deterministic `DummyExplainer` stub;
  `/quiz/submit` uses it to attach an `explanation` string to every wrong answer, which
  feeds **Learning Mode**. A model-backed implementation slots in without changing any
  caller.

**Planned, not yet implemented** — the full generator interface:

```
QuestionGenerator (interface)
  generate(input) -> Question[]
      input: { grade_or_age, focus_subject, material_text?, question_count }
             # source = "profile"  -> material_text = null
             # source = "material" -> material_text = normalized text of a stored material
             # source = "text"     -> material_text = normalized text passed inline
      Question: { prompt, options[4], correct_index, explanation }
  # exact internal contract: api-contract.md "Internal data-interchange contract"

Implementations:
  DummyGenerator   (MVP now)  -> returns curated static questions per subject
  ModelGenerator   (later)    -> wraps a real LLM; same output shape
```

When that lands, validation will be applied to **every** generator's output, so a real
model can't break clients: exactly 4 options, exactly 1 correct index, no duplicate
options, non-empty prompt. On invalid output: retry once, then fall back to a dummy
question.

## 7. Core flows

### 7.1 Auth
1. Mobile calls the backend (`POST /auth/register` / `POST /auth/login`), which passes
   through to Supabase Auth → receives a **JWT**. (Register also validates `grade_or_age`
   against the same whitelist as `PUT /profile`; a Supabase 5xx surfaces as
   `502 upstream_error`.)
2. JWT is stored in `expo-secure-store` (planned — the library is not installed yet).
3. Every backend request sends `Authorization: Bearer <jwt>`.
4. Backend middleware verifies the signature/expiry against Supabase's JWKS endpoint
   (ES256) and extracts the `user_id` (the `sub` claim). No server-side sessions. Full
   claim anatomy: [`docs/auth.md`](./auth.md).

### 7.2 Earn screen time (the main loop)
```
Locked State screen shows balance (GET /screentime/balance — planned blueprint, §4 note)
      │  user taps "Start Quiz"
      ▼
POST /quiz/generate   (auth required; takes NO request body today)
      │  N questions (N = QUIZ_LEN_DEBT = 7 if SOS debt is set, else QUIZ_LEN_NORMAL = 5)
      │  response: { quiz_id, user_id, question_count, questions[{id,prompt,options}],
      │              generated_at } — answer keys never leave the server
      ▼
Client collects answers, wrong answers trigger Learning Mode (10s locked Continue)
      ▼
POST /quiz/submit  { quiz_id, answers: [{ id, selected_index|null }] }
      │  server scores against the stored key, applies rule (5 correct = 900s, configurable),
      │  credits screentime_balance atomically, clears SOS debt when
      │  correct_count >= QUIZ_CORRECT_TARGET; a second submit of the same quiz → 409
      ▼
Result screen shows earned_seconds  ──▶  native startShield(balance) keeps apps unlocked
                                          until the countdown hits 0, then locks
                                          (native module planned, not yet built)
```

A future `source: "profile" | "material"` request field on `/quiz/generate` is part of
the planned generator work (§6) and is **not yet implemented** — today the endpoint
ignores any body and draws from the static bank.

### 7.3 SOS (emergency unlock) — endpoint planned, not yet implemented
`POST /sos` → if not used today: grant 120s emergency unlock and set `sos_debt_flag`.
The next `/quiz/generate` then returns **7** questions instead of 5, and a successful submit
clears the flag. A second SOS the same day is refused.

The `/sos` blueprint does not exist yet, but the debt machinery around it is live:
`profiles.sos_debt_flag` and `last_sos_date` are in the schema, `/quiz/generate` already
sizes the quiz by the flag, and `/quiz/submit` already clears it.

### 7.4 Wake-Up Lock — planned, not yet implemented
Native `DeviceActivitySchedule` shields apps at 07:30. `GET /wakeup/status` says whether the
lock is active today; the user solves 3 questions; `POST /wakeup/complete` marks the day done
and the shield is lifted. Status resets daily. (Only the `profiles.wakeup_completed_date`
column exists so far; neither the endpoints nor the native scheduling are built.)

## 8. Business rules (single source of truth)

These live as **backend config constants** so they can be tuned without a client release.
The first four are implemented in `backend/app/config.py` and overridable via env vars:

| Rule | Default | Config key |
|---|---|---|
| Correct answers required for full reward | 5 | `QUIZ_CORRECT_TARGET` |
| Reward for a full correct quiz | 900 s (15 min) | `REWARD_SECONDS` |
| Questions per normal quiz | 5 | `QUIZ_LEN_NORMAL` |
| Questions per SOS-debt quiz | 7 | `QUIZ_LEN_DEBT` |
| Seconds per correct answer (derived, not a key) | 180 s | `REWARD_SECONDS / QUIZ_CORRECT_TARGET` |

**Planned, not yet implemented** (will follow the same pattern when their features land;
none of these keys exist in `config.py` today):

| Rule | Default | Config key |
|---|---|---|
| SOS emergency unlock | 120 s, once/day | `SOS_SECONDS`, `SOS_DAILY_LIMIT` |
| Wake-Up Lock questions | 3 | `WAKEUP_QUESTIONS` |
| Wake-Up Lock time | 07:30 local | `WAKEUP_TIME` |
| Learning Mode forced-read | 10 s locked Continue | `LEARNING_LOCK_SECONDS` (client) |
| Knowledge Import stored-text cap | 12,000 chars | `KNOWLEDGE_MAX_CHARS` |
| Knowledge Import link-fetch timeout | 10 s | `KNOWLEDGE_FETCH_TIMEOUT_SECONDS` |
| Knowledge Import link-fetch size cap | 2,000,000 bytes | `KNOWLEDGE_FETCH_MAX_BYTES` |
| Global request body cap | 1,000,000 bytes | `MAX_CONTENT_LENGTH` |

### Earned-seconds formula

Reward is **linear per correct answer, capped at the full reward**:

```
seconds_per_correct = REWARD_SECONDS / QUIZ_CORRECT_TARGET          # 900 / 5 = 180 s
earned_seconds      = min(correct_count, QUIZ_CORRECT_TARGET) * seconds_per_correct
```

- Each correct answer is worth `180 s`; a perfect 5-correct quiz yields the full `900 s`.
- The cap means answers beyond `QUIZ_CORRECT_TARGET` earn nothing — so a **7-question
  SOS-debt quiz** still tops out at `900 s`; the extra two questions are pure penalty, not
  extra reward. Getting `>= QUIZ_CORRECT_TARGET` correct also clears the debt flag.
- The formula is expressed in terms of the config constants, so retuning `REWARD_SECONDS`
  or `QUIZ_CORRECT_TARGET` rescales it automatically.

## 9. Data model (owned by Supabase, detailed in api-contract.md)

Six tables, all with RLS enabled and keyed on `user_id`:

- **users** `(id, email, grade_or_age, created_at)`
- **profiles** `(user_id, focus_subjects[], sos_debt_flag, last_sos_date, wakeup_completed_date)`
- **knowledge_materials** `(id, user_id, raw_text, source_type, created_at)`
- **screentime_balance** `(user_id, remaining_seconds, updated_at)`
- **quizzes** `(id, user_id, questions jsonb, submitted_at, created_at)` — generated
  quizzes *including answer keys*; RLS revokes **all** client access (answers are
  secret; only the service role reads it). `submitted_at` is the idempotency guard
  behind the 409 on double submit.
- **quiz_history** `(id, user_id, quiz_id, correct_count, earned_seconds, created_at)`

Scoring + reward is atomic: the `submit_quiz_reward` Postgres function (migration 0010)
marks the quiz submitted, credits the balance, appends history, and clears the debt flag
in one transaction.

Full column types, constraints, and the migration approach are in
[`api-contract.md`](./api-contract.md#database-schema).

## 10. Environments & configuration

Backend env vars (see `backend/.env.example`):

| Variable | Where | Purpose |
|---|---|---|
| `FLASK_ENV` | backend | `development` enables DEBUG; anything else (including unset) runs as **production** — fail closed |
| `SUPABASE_URL` | backend | project URL; the JWKS endpoint is derived from this (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) — there is no separate JWKS env var |
| `SUPABASE_ANON_KEY` | backend | `/auth/register` and `/auth/login` passthrough to Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | backend only (secret) | privileged DB access (bypasses RLS) |
| `ALLOWED_ORIGINS` | backend | comma-separated CORS origins (defaults to the Expo dev origin) |
| Rule constants (§8) | backend | `QUIZ_CORRECT_TARGET`, `REWARD_SECONDS`, `QUIZ_LEN_NORMAL`, `QUIZ_LEN_DEBT` |

**Planned (mobile — the app reads no env vars yet):** `EARNLOCK_API_URL` (backend base
URL) once the `src/lib/api.ts` client layer exists.

Secrets are provided via env / EAS secrets and are **never** committed. Mobile will only
ever hold public values; the anon key and the service role key stay server-side.

## 11. Security notes

- **Server-authoritative currency** — clients cannot mint seconds; all math is server-side.
- **RLS everywhere** — even if the backend has a bug, Postgres refuses cross-user reads.
- **JWT verified per request** — stateless, signature-checked against Supabase's JWKS
  endpoint (ES256).
- **Screen Time authorization is local** — the native module never sends the app list off
  device beyond what the user chooses to lock.

## 12. Open technical risks

1. **Family Controls entitlement** — Apple approval is slow and can be denied; it gates the
   entire lock feature. Request on day one; have a "demo without real lock" fallback.
2. **On-device testing required** — FamilyControls does not work in the iOS Simulator.
3. **Reanimated 4 + React Compiler** — both are enabled; verify no conflicts with the quiz
   timer/countdown animations.
