-- Migration: 0002_users
-- Purpose : App-level account record (mirrors auth.users), per docs/api-contract.md.
--
-- The primary key IS auth.users.id, so this is a 1:1 mirror of the Supabase auth
-- record holding the app-level fields the API contract exposes (email + grade/age).
-- ON DELETE CASCADE means deleting the auth user removes the whole account graph.
--
-- RLS POSTURE (applies to every table in this schema — see docs/rls.md):
--   The architecture (docs/architecture.md §3, §11) is server-authoritative: the
--   mobile client never writes to Postgres directly; the Flask backend performs all
--   writes with the service_role key (which bypasses RLS), and several fields are
--   explicitly "server-managed". So each table grants authenticated clients an
--   owner-scoped SELECT ("a user can only see their own rows") and NO direct write
--   path — writes belong to the backend. This is what makes "clients cannot mint
--   seconds" and the server-managed profile flags true at the database layer.

create table if not exists public.users (
  id           uuid        primary key references auth.users (id) on delete cascade,
  email        text        not null unique,
  grade_or_age text        not null,
  created_at   timestamptz not null default now()
);

comment on table  public.users is 'App-level account record; 1:1 mirror of auth.users with app fields (email, grade_or_age).';
comment on column public.users.grade_or_age is 'Grade/age used to target quiz generation; set at registration.';

-- ---------------------------------------------------------------------------
-- Row-Level Security: owner may read own row; all writes go through the backend.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.users from authenticated;

alter table public.users enable row level security;
alter table public.users force row level security;

create policy "users_select_own"
  on public.users for select
  to authenticated
  using ((select auth.uid()) = id);
