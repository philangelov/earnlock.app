-- Migration: 0003_profiles
-- Purpose : User preferences + behavioural-hook state, per docs/api-contract.md.
--
-- Keyed 1:1 to public.users. Holds the learner's focus subjects plus the
-- server-managed hook state that drives the gameplay rules:
--   * sos_debt_flag         set by POST /sos, read by /quiz/generate, cleared by /quiz/submit
--   * last_sos_date         enforces the once-per-day SOS limit
--   * wakeup_completed_date set by /wakeup/complete, read by /wakeup/status
--
-- These flags are anti-cheat state: the API contract says they are "server-managed
-- and ignored if sent" by the client. RLS therefore keeps them read-only to clients
-- (owner SELECT only); the backend mutates them via the service_role.

create table if not exists public.profiles (
  user_id               uuid    primary key references public.users (id) on delete cascade,
  focus_subjects        text[]  not null default '{}',
  sos_debt_flag         boolean not null default false,
  last_sos_date         date,
  wakeup_completed_date date
);

comment on table  public.profiles is 'Per-user preferences and server-managed hook state (SOS debt, wake-up lock).';
comment on column public.profiles.focus_subjects is 'Subjects used by /quiz/generate (source=profile); editable via PUT /profile.';
comment on column public.profiles.sos_debt_flag is 'Server-managed: true while an SOS debt quiz is outstanding.';

-- ---------------------------------------------------------------------------
-- Row-Level Security: owner may read own row; all writes go through the backend.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.profiles from authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);
