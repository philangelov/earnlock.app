-- Migration: 0006_quiz_history
-- Purpose : Audit of each completed quiz, per docs/api-contract.md (§Database schema).
--
-- One row per submitted quiz, appended by POST /quiz/submit. Records how many answers
-- were correct and how many seconds were earned, for progress/metrics over time.
--
-- Note: at the time of this migration quizzes were ephemeral, so `quiz_id` was a plain
-- UUID with no foreign key. Migration 0009 later persisted quizzes in their own table;
-- 0011 updates this column's comment accordingly (the FK is still intentionally absent
-- so history survives any future quiz-row cleanup).

create table if not exists public.quiz_history (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.users (id) on delete cascade,
  quiz_id        uuid        not null,
  correct_count  integer     not null check (correct_count >= 0),
  earned_seconds integer     not null check (earned_seconds >= 0),
  created_at     timestamptz not null default now()
);

comment on table  public.quiz_history is 'Audit log of completed quizzes: correct count and screen-time earned over time.';
comment on column public.quiz_history.quiz_id is 'The (ephemeral, non-persisted) generated quiz this attempt belongs to.';

-- Index the RLS predicate column and the "newest first" progress query.
create index if not exists idx_quiz_history_user_id     on public.quiz_history (user_id);
create index if not exists idx_quiz_history_user_recent on public.quiz_history (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-Level Security: owner may read own history; only the backend appends to it.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.quiz_history from authenticated;

alter table public.quiz_history enable row level security;
alter table public.quiz_history force row level security;

create policy "quiz_history_select_own"
  on public.quiz_history for select
  to authenticated
  using ((select auth.uid()) = user_id);
