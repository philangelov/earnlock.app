-- Migration: 0009_quizzes
-- Purpose : Persist a generated quiz + its answer key so POST /quiz/submit can score it
--           server-side. The answer key must NEVER reach the client, so authenticated
--           users get zero access to this table — only the backend (service_role, which
--           bypasses RLS) reads/writes it.
--
-- A quiz is created by POST /quiz/generate and scored once by POST /quiz/submit. The
-- `questions` jsonb holds the full items INCLUDING correct_index (and any concept text
-- used for Learning Mode remediation). `submitted_at` is the idempotency guard.

create table if not exists public.quizzes (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.users (id) on delete cascade,
  questions    jsonb       not null,
  submitted_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on table  public.quizzes is 'Generated quizzes (questions + answer keys); scored once by /quiz/submit.';
comment on column public.quizzes.questions is 'Full quiz items incl. correct_index and concept — never exposed to clients.';
comment on column public.quizzes.submitted_at is 'Set the first time the quiz is scored; the idempotency guard for rewards.';

create index if not exists idx_quizzes_user_id on public.quizzes (user_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security: NO client access at all (answers are secret). The backend
-- uses the service role, which bypasses RLS.
-- ---------------------------------------------------------------------------
revoke select, insert, update, delete on public.quizzes from authenticated;

alter table public.quizzes enable row level security;
alter table public.quizzes force row level security;
