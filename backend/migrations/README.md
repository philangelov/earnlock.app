# EarnLock — Database Migrations

Version-controlled SQL for the EarnLock Supabase schema. These files are the
**source of truth** for the database: every table, foreign key, trigger and
Row-Level Security policy is defined here, applied in numeric order, and mirrored on
the live project. Nothing was clicked together by hand in the dashboard.

The schema implements the data model specified in
[`docs/architecture.md`](../../docs/architecture.md) §9 and
[`docs/api-contract.md`](../../docs/api-contract.md#database-schema).

- **Supabase project ref:** `vkscemjmpyabipuyifgf`
- **Project URL:** https://vkscemjmpyabipuyifgf.supabase.co
- **RLS design & best practices:** [`../docs/rls.md`](../docs/rls.md)

## Migration order

Apply strictly in ascending order — later files depend on earlier ones.

| # | File | What it creates |
| --- | --- | --- |
| 0001 | `0001_helper_functions.sql` | `set_updated_at()` trigger helper. |
| 0002 | `0002_users.sql` | `users` (1:1 mirror of `auth.users`) + RLS. |
| 0003 | `0003_profiles.sql` | `profiles` (prefs + server-managed hook state) + RLS. |
| 0004 | `0004_knowledge_materials.sql` | `knowledge_materials` (imported study text) + indexes + RLS. |
| 0005 | `0005_screentime_balance.sql` | `screentime_balance` (currency, seconds) + updated_at trigger + RLS. |
| 0006 | `0006_quiz_history.sql` | `quiz_history` (completed-quiz audit) + indexes + RLS. |
| 0007 | `0007_new_user_provisioning.sql` | `handle_new_user()` + `on_auth_user_created` trigger (auto-provision users + profiles + balance). |
| 0008 | `0008_harden_function_grants.sql` | Revoke direct RPC `EXECUTE` on the `SECURITY DEFINER` trigger function. |
| 0009 | `0009_quizzes.sql` | `quizzes` (generated quizzes incl. answer keys) — RLS enabled with **no policies** (intentional deny-all; service-role only). |
| 0010 | `0010_submit_quiz_reward.sql` | `submit_quiz_reward()` — atomic idempotent scoring: balance credit + history append + debt clear. |
| 0011 | `0011_hardening_and_email_sync.sql` | Email-change sync trigger on `auth.users`, `anon` grant revokes, `search_path=''` + input validation on `submit_quiz_reward()`, redundant index cleanup. |
| 0012 | `0012_revoke_truncate_from_clients.sql` | Revoke `TRUNCATE`/`REFERENCES`/`TRIGGER` from `authenticated` (TRUNCATE bypasses RLS) — clients now retain only owner-scoped `SELECT`. |

## Schema overview

```
auth.users (Supabase-managed)
   │  on signup → handle_new_user() trigger provisions, in FK order:
   │  on email change → handle_user_email_change() keeps users.email in sync (0011)
   ├──1:1──> users                 email, grade_or_age
   │            ├──1:1──> profiles            focus_subjects[], sos_debt_flag, last_sos_date, wakeup_completed_date
   │            ├──1:1──> screentime_balance  remaining_seconds  (server-authoritative currency)
   │            ├──1:N──> knowledge_materials raw_text, source_type ∈ {text, link}
   │            ├──1:N──> quizzes              questions jsonb (incl. answer keys), submitted_at
   │            └──1:N──> quiz_history         quiz_id, correct_count, earned_seconds
```

Every table's `user_id` (or `id` for `users`) is a FK to `public.users(id)` with
`ON DELETE CASCADE`; `users.id` in turn references `auth.users(id)` with cascade — so
deleting an auth user cleanly removes the whole account graph.

## Security posture (important)

EarnLock is **server-authoritative** (see [architecture.md](../../docs/architecture.md)
§3, §11): the mobile client never writes to Postgres directly, and the Flask backend
performs all writes with the `service_role` key (which bypasses RLS). Accordingly:

- Every table has RLS **enabled + forced**, with an owner-scoped `SELECT` policy
  (`(select auth.uid()) = user_id`) — clients can only ever *read their own* rows.
  Exception: `quizzes` has **no policies at all** (deny-all) because its rows contain
  the answer keys; only the backend's service role touches it.
- Client `INSERT`/`UPDATE`/`DELETE` grants are **revoked** on every table (and all
  `anon` grants since 0011), so there is no direct client write path. This is what
  enforces "clients cannot mint seconds" and keeps the server-managed profile flags
  tamper-proof at the DB layer.

Full rationale and the policy matrix are in [`../docs/rls.md`](../docs/rls.md).

## Applying the migrations

**Via the Supabase MCP tools (how this project was built):** call `apply_migration`
once per file, in order, passing the file's exact contents and a snake_case `name`
matching the filename. Each call is recorded in
`supabase_migrations.schema_migrations`.

**Via the Supabase CLI (equivalent, for local/CI):**

```bash
supabase link --project-ref vkscemjmpyabipuyifgf
supabase db push        # applies any migrations not yet on the remote
```

The files use CLI-friendly numeric prefixes; copy them into `supabase/migrations`
(or symlink) if you adopt the CLI workflow. All DDL is idempotent
(`create ... if not exists`, `create or replace`, `drop trigger if exists`), so
re-running is safe.

## Regenerating TypeScript types

The frontend does not currently consume generated Supabase types (it talks only to the
Flask API). If/when it does, generate them into the frontend project:

```bash
supabase gen types typescript --project-id vkscemjmpyabipuyifgf > ../../frontend/src/lib/database.types.ts
```

## Definition of Done — status

- [x] Live Supabase instance mirrors the documented schema (6 tables, all RLS enabled).
- [x] `users` connected to `auth.users`; account graph auto-provisioned on signup via trigger.
- [x] Content ingestion, gamification currency (seconds), quizzes, and quiz metrics modeled.
- [x] RLS enabled + `force`d on all tables; every policy scoped to `auth.uid()`
      (`quizzes` intentionally deny-all).
- [x] Server-authoritative writes enforced (client write grants revoked).
- [x] All DDL captured as ordered SQL migration files in this folder.
- [x] Verified: provisioning, read isolation, write denial, cascade, email-change sync;
      the only remaining advisor items are the expected `quizzes` deny-all INFO, the
      unused `idx_quizzes_user_id` INFO (kept — it indexes the FK, no composite twin),
      and the Auth leaked-password dashboard setting (see `../docs/rls.md` §6).
- [x] Migrations 0001–0012 applied to the live project. **Manual step still open:**
      enable leaked-password protection in the Supabase dashboard
      (Authentication → Providers → Password) to clear the last WARN advisor.
