# Row-Level Security (RLS) — Research & Best Practices

This document is the reference for how EarnLock isolates each user's data in
Postgres/Supabase. It covers what RLS is, why we use it, the best practices we
applied, and the exact policy matrix for every table.

The schema this describes is the one defined in
[`docs/api-contract.md`](../../docs/api-contract.md#database-schema) and
[`docs/architecture.md`](../../docs/architecture.md) — `users`, `profiles`,
`knowledge_materials`, `screentime_balance`, `quiz_history`, `quizzes`.

---

## 1. What RLS is and how it works

Row-Level Security is a PostgreSQL feature that attaches a **security predicate** to
a table. Once RLS is enabled, every query is silently rewritten so that only rows
matching the predicate are visible/affected. A policy like:

```sql
create policy "knowledge_materials_select_own"
  on public.knowledge_materials for select
  to authenticated
  using ((select auth.uid()) = user_id);
```

turns `select * from knowledge_materials` into
`select * from knowledge_materials where auth.uid() = user_id`. The user cannot opt
out of it — the filter is enforced by the database, not the application.

Two clauses drive policies:

| Clause | Runs on | Meaning |
| --- | --- | --- |
| `USING` | `SELECT`, `UPDATE`, `DELETE` | Which existing rows the role may *see / target*. |
| `WITH CHECK` | `INSERT`, `UPDATE` | Which new/updated row values are *allowed to be written*. |

### Why it matters in Supabase

Supabase issues each client a key for the `anon` / `authenticated` Postgres roles and
exposes the tables directly over PostgREST. Without RLS, anyone with the (public) anon
key could read or write every row. RLS is therefore the authorization boundary of last
resort. `auth.uid()` returns the UUID of the logged-in user (from the request JWT),
which we compare against each row's `user_id`.

> ⚠️ Enabling RLS with **no policies** = deny-all. Adding policies without enabling RLS
> = the policies are ignored. You need both.

---

## 2. How RLS fits EarnLock's architecture

EarnLock is **server-authoritative** ([architecture.md](../../docs/architecture.md)
§3, §11):

- The mobile client **never writes to Postgres directly** — it only calls the Flask
  backend (and Supabase Auth to get a JWT).
- The **Flask backend performs all writes using the `service_role` key**, which
  **bypasses RLS entirely**. All currency math, SOS/debt logic and the server-managed
  profile flags live there.
- Several fields are explicitly *server-managed* — the API contract says
  `sos_debt_flag`, `last_sos_date` and `wakeup_completed_date` are "ignored if sent"
  by the client.

So the RLS posture is: **authenticated clients get owner-scoped `SELECT` and no direct
write path at all.** Every documented mutation (`PUT /profile`, `/knowledge/import`,
`/quiz/submit`, `/sos`, `/wakeup/complete`) is a backend operation on the service role.
This makes the architecture's guarantees true at the database layer:

- *"Clients cannot mint seconds"* — there is no client write path to
  `screentime_balance`.
- *Server-managed flags can't be cheated* — a client can't flip its own
  `sos_debt_flag` or backdate `wakeup_completed_date`.

> **Note on the contract's RLS sketch.** `api-contract.md` shows an illustrative
> `for all using (user_id = auth.uid())` sketch. We implement the stricter,
> read-only-for-clients form here because the same document also states writes are
> server-side and specific fields are server-managed — the prose ("a user can only
> **see** their own rows") and §11 win over the shorthand sketch. If the team later
> decides clients should write some tables directly, add scoped `INSERT`/`UPDATE`
> policies (and re-grant the privilege) on just those tables.

---

## 3. Best practices we applied

Following the official Supabase guidance
(<https://supabase.com/docs/guides/database/postgres/row-level-security>).

### 3.1 Wrap `auth.uid()` in a subquery — `(select auth.uid())`
Wrapping the auth function in a scalar subquery lets the planner compute it **once per
statement** (an `initPlan`) instead of **once per row** — a large win on big tables.
Every policy uses `(select auth.uid())`, never a bare `auth.uid()`.

### 3.2 Always scope policies with `TO authenticated`
The policy is then only evaluated for signed-in users; `anon` skips it (and, with no
policy, is denied). It also documents intent.

### 3.3 Index every column used in a policy
An RLS predicate is a `WHERE` clause and needs an index. `knowledge_materials` and
`quiz_history` have `idx_*_user_id` (and a `(user_id, created_at desc)` index for the
"newest first" list queries). `users`, `profiles` and `screentime_balance` key on the
user id as their **primary key**, so it is already indexed.

### 3.4 `enable` **and** `force` row level security
`enable` applies policies to normal roles; `force` also applies them to the table
owner, so a stray owner-role query can't bypass isolation. Both are set on all tables.
(`service_role` has the `BYPASSRLS` attribute, so the backend is intentionally
unaffected.)

### 3.5 Defense-in-depth: revoke the write grants too
Supabase grants `authenticated`/`anon` full privileges on new public tables by default.
Because our clients are read-only, we strip everything except the owner-scoped `SELECT`:
**`INSERT`/`UPDATE`/`DELETE` are revoked from `authenticated`** (migrations 0002-0009),
**all `anon` privileges are revoked** (0011), and **`TRUNCATE`/`REFERENCES`/`TRIGGER` are
revoked from `authenticated`** (0012). `TRUNCATE` matters specifically because it is *not*
filtered by RLS — even though it isn't reachable through the PostgREST data API, we remove
the grant so the "clients cannot write" guarantee holds at the privilege layer too. Net
result: a client write is denied by *both* a missing grant and a missing policy — a later
accidental policy alone can't reopen a hole.

### 3.6 `SECURITY DEFINER` functions must be pinned and not publicly callable
`handle_new_user()` intentionally bypasses RLS to provision new accounts. It:
- pins `set search_path = ''` and schema-qualifies every object, so it can't be
  hijacked by a malicious object earlier on the search path; and
- has its `EXECUTE` grant **revoked** from `anon`/`authenticated`/`public`
  (migration `0008`) so it can't be invoked directly as a PostgREST RPC — it only runs
  from its trigger.

`submit_quiz_reward()` (migration `0010`) follows the same rules: pinned
`search_path`, schema-qualified objects, and `EXECUTE` granted **only** to
`service_role` — clients cannot invoke the reward RPC.

---

## 4. Policy & privilege matrix

Every policy is scoped `to authenticated` and keyed on `(select auth.uid())`.
"Own" = `(select auth.uid()) = user_id` (or `= id` for `users`). All writes are
performed by the backend via `service_role`, which bypasses RLS.

| Table | Client SELECT | Client INSERT/UPDATE/DELETE | Notes |
| --- | :---: | :---: | --- |
| `users` | own | — (revoked) | Account record; created by the signup trigger. |
| `profiles` | own | — (revoked) | Preferences + **server-managed** hook flags. |
| `knowledge_materials` | own | — (revoked) | Written by `/knowledge/import`. |
| `screentime_balance` | own | — (revoked) | **Currency** — credited only by the backend. |
| `quiz_history` | own | — (revoked) | Appended by `/quiz/submit`. |
| `quizzes` | **— (no policy: deny-all)** | — (revoked) | Holds the **answer keys** — clients get zero access; only the backend (`service_role`) reads/writes it (migration `0009`). |

> The `quizzes` table intentionally has RLS enabled with **no policies** (deny-all for
> `anon`/`authenticated`). The Supabase security advisor reports this as an INFO-level
> `rls_enabled_no_policy` lint — that is expected and correct here: exposing any part of
> a quiz row would leak `questions[].correct_index`.

---

## 5. Auto-provisioning (signup)

`handle_new_user()` runs `AFTER INSERT ON auth.users` (SECURITY DEFINER) and creates,
in FK order, the three baseline rows: `users` → `profiles` → `screentime_balance`.
`grade_or_age` is read from the signup metadata
(`raw_user_meta_data->>'grade_or_age'`), with an `'unspecified'` fallback so a signup can
never fail. Since EarnLock moved to OAuth-only sign-in the id_token grant carries no
metadata, so that fallback is now the normal path and `PUT /profile` corrects it. Every insert is
`ON CONFLICT DO NOTHING`.

---

## 6. How this was verified (live database)

By impersonating two authenticated users (`set local role authenticated` + a
JWT-claims `sub`) and confirming:

1. **Provisioning** — inserting an `auth.users` row auto-created `users` + `profiles` +
   `screentime_balance`; `grade_or_age` came from metadata (`"5th grade"`), with the
   `'unspecified'` fallback when metadata was absent.
2. **Read isolation** — user B saw **0** of user A's `knowledge_materials` /
   `quiz_history` (only B's own account rows); user A saw exactly their own, including
   a balance of 720s.
3. **Write denial (server-authoritative)** — as an authenticated client, updating
   `screentime_balance` (mint attempt), inserting `knowledge_materials`, and clearing
   `sos_debt_flag` / backdating `wakeup_completed_date` were **all** rejected with
   `42501 permission denied`.
4. **Cascade** — deleting the `auth.users` rows removed every dependent row.
5. **Advisors** — `get_advisors(security)` returns no unexpected lints. Two known
   items remain by design/configuration: the INFO-level `rls_enabled_no_policy` on
   `quizzes` (intentional deny-all, see §4) and the WARN that Supabase Auth
   leaked-password protection is disabled (a dashboard Auth setting worth enabling —
   Authentication → Providers → Password).

See [`../migrations/README.md`](../migrations/README.md) for the migration list.
