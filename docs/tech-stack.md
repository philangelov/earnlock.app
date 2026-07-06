# Tech Stack

## Frontend

- `Expo` for cross-platform mobile and web development
- `React Native` for UI rendering
- `expo-router` for file-based routing
- `TypeScript` for static typing and developer confidence
- `React` for component architecture
- `expo-status-bar`, `expo-constants`, and other Expo packages for native APIs

## Backend

- `Python` 3.14
- `Flask` for a lightweight REST API
- `Flask-CORS` for cross-origin request support during local development

## Tooling

- `npm` / `bun` for frontend dependency management
- `pip` for backend dependency management
- `eslint` via `expo lint` for frontend code quality

## Project Layout

- `frontend/` - Expo app and UI code
- `backend/` - Flask API
- `docs/` - architecture, tech stack, design assets
# EarnLock — Tech Stack & Environment (Finalized)

> Status: MVP stack decisions with justifications. Companion docs:
> [`architecture.md`](./architecture.md), [`api-contract.md`](./api-contract.md),
> [`ui-ux.md`](./ui-ux.md). Changes to this file follow the
> [change-management process](#change-management).

## Summary

| Layer | Choice | Version |
|---|---|---|
| Mobile framework | Expo (managed) | SDK **57** (`~57.0.1`) |
| Mobile runtime | React Native / React | 0.86.0 / 19.2.3 |
| Routing | Expo Router | v57 (`typedRoutes`, React Compiler on) |
| Mobile language | TypeScript | ~6.0.3, `strict: true` |
| **Package manager (mobile)** | **Bun** | `bun.lock` is authoritative |
| Backend framework | **Flask** | 3.x |
| Backend language | **Python** | **3.12** |
| Backend deps manager | pip + `requirements.txt` (venv) | — |
| Database + Auth | **Supabase** (PostgreSQL + Auth) | managed |
| Auth tokens | Supabase JWT (email/password) | verified server-side |
| Native lock (iOS) | Swift Expo module, FamilyControls | iOS-only |
| AI quiz generation | Pluggable interface, **stubbed** for MVP | — |
| Backend tests | pytest | — |

## Decisions & justifications

### Package manager: Bun (mobile)
- **Decision:** Bun is the single package manager for `/mobile`. `bun.lock` is committed and
  authoritative; do **not** run `npm install` / `yarn` (they'd create competing lockfiles).
- **Why:** the repo already ships a `bun.lock`; Bun installs are fast and its lockfile is
  deterministic. Expo/Metro work with Bun for install and script running.
- **How:** `bun install`, `bunx expo start`, `bun run <script>`. The `package.json` scripts
  (`start`, `android`, `ios`, `web`, `lint`, `reset-project`) are runner-agnostic.

### Backend framework: Flask + Python 3.12
- **Decision:** Flask (app factory + blueprints per domain), Python **3.12**.
- **Why Flask:** small, explicit, fast to scaffold for a hackathon-scale API; the surface is
  a dozen JSON endpoints, so a full framework (Django) is overkill and FastAPI's async isn't
  needed for this I/O profile. Blueprints keep each person's domain isolated.
- **Why 3.12:** current stable, broad library support, good performance; avoids 3.13 edge
  cases in dependencies. Pin it in `backend/README.md` and CI. *(Confirm with the team if a
  different minor is already standardized on your machines.)*
- **How:** `python -m venv .venv`, `pip install -r requirements.txt`, `flask run`. Config via
  environment variables with a `dev`/`prod` split; secrets never committed.

### Database & Auth: Supabase (PostgreSQL + Auth)
- **Decision:** Supabase provides Postgres **and** Auth. Row-Level Security on every table.
- **Why:** one managed service for DB + email/password auth + JWT issuance, with RLS giving
  per-user data isolation enforced at the database, not just the app layer.
- **Integration strategy:**
  - **Mobile** uses `@supabase/supabase-js` **only for auth** (login/register → JWT). It does
    not query app tables directly; all app data goes through the Flask API.
  - **Backend** uses the Supabase service-role key (server-side only) or `psycopg` for data
    access, and validates the user's JWT on every request.
  - **Migrations** are plain SQL in `backend/migrations/`, checked into the repo (schema in
    [`api-contract.md`](./api-contract.md#database-schema)).

### Authentication flow (Supabase JWT ↔ Flask)
```
Mobile ──login/register──▶ Supabase Auth ──JWT──▶ Mobile (stored in expo-secure-store)
Mobile ──Authorization: Bearer <JWT>──▶ Flask
Flask  ──verify signature/expiry against Supabase JWKS──▶ user_id = JWT `sub` claim
```
- **Stateless:** no server-side sessions; the JWT is the identity on every request.
- **Server-authoritative:** clients never send `user_id` in a body — it comes from the token.
- Full description in [`architecture.md` §7.1](./architecture.md#71-auth).

### Mobile dependencies to add
Not yet in `package.json`, required by the architecture:
- `@supabase/supabase-js` — auth only.
- `expo-secure-store` — persist the JWT securely.
- A thin `fetch` wrapper in `mobile/src/lib/api.ts` (optionally `@tanstack/react-query` for
  caching `balance`/`profile`).

### Native (iOS): Swift Expo module, FamilyControls
- **Decision:** a local Expo native module in Swift using FamilyControls / ManagedSettings /
  DeviceActivity. **iOS-only** for the MVP.
- **Why:** these are the only APIs that can actually block apps; there is no Android
  equivalent, so Android is out of scope for the lock feature.
- **Risk:** the Apple Family Controls entitlement approval is slow and can block the feature —
  request on day one. Must be tested on a real device (not the Simulator).

### AI quiz generation: pluggable, stubbed
- **Decision:** one `QuestionGenerator` interface; MVP ships a `DummyGenerator` returning
  static questions. A real model is wired in later **without changing the API contract**.
- **Why:** unblocks the whole quiz flow immediately; provider choice is deferred.
- Details + validation rules in [`architecture.md` §6](./architecture.md#6-ai-question-generation-pluggable-stubbed-now).

### Testing
- **Backend:** pytest, with the currency/scoring edge cases (0 correct, all correct, SOS
  debt, cap) as the priority targets.

## Environment variables
See [`architecture.md` §10](./architecture.md#10-environments--configuration) for the full
list (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL`,
`EARNLOCK_API_URL`, and the rule constants). Public keys only on mobile; the service-role key
stays server-side.

## Change management

Contract and stack changes go through a single, dedicated channel so all five members stay in
sync. **This channel must be created by the team** (Claude cannot create it):

- **Recommended:** a **GitHub Discussions** category named `contracts` in this repo (keeps the
  discussion next to the code and PRs), *or* a dedicated `#earnlock-contracts` Slack/Discord
  channel.
- **Process:** propose a change in the channel → discuss → on agreement, open a PR editing the
  relevant `docs/*.md` → merge only after review. No contract changes land silently.

> **TODO (team):** create the channel and paste its link here.
