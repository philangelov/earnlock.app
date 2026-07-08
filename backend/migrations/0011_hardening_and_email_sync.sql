-- Migration: 0011_hardening_and_email_sync
-- Purpose : Post-audit hardening batch:
--   1) keep public.users.email in sync when a user changes their email in Supabase
--      Auth (previously only the INSERT trigger existed, so email edits drifted and
--      could later collide with the users.email UNIQUE constraint on re-signup),
--   2) defense-in-depth: revoke table privileges from `anon` as well as
--      `authenticated` (Supabase grants both roles CRUD on new public tables),
--   3) pin submit_quiz_reward's search_path to '' (repo convention for SECURITY
--      DEFINER, see 0007/rls.md §3.6) and validate its numeric inputs,
--   4) drop two single-column indexes fully covered by their composite twins,
--   5) correct the stale quiz_history.quiz_id comment (quizzes persist since 0009).

-- ---------------------------------------------------------------------------
-- 1) Email sync: auth.users UPDATE OF email -> public.users.email
-- ---------------------------------------------------------------------------
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;

comment on function public.handle_user_email_change() is
  'AFTER UPDATE OF email on auth.users: mirrors the new email into public.users.';

-- Trigger functions never need direct EXECUTE (see 0008).
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- 2) Defense-in-depth: anon must have no table privileges at all
-- ---------------------------------------------------------------------------
revoke all on public.users              from anon;
revoke all on public.profiles           from anon;
revoke all on public.knowledge_materials from anon;
revoke all on public.screentime_balance from anon;
revoke all on public.quiz_history       from anon;
revoke all on public.quizzes            from anon;

-- ---------------------------------------------------------------------------
-- 3) submit_quiz_reward: pin search_path = '' and validate inputs
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_reward(
  p_user_id        uuid,
  p_quiz_id        uuid,
  p_correct_count  integer,
  p_earned_seconds integer,
  p_clear_debt     boolean
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submitted timestamptz;
  v_balance   integer;
begin
  if p_correct_count < 0 or p_earned_seconds < 0 then
    raise exception 'invalid_reward_arguments';
  end if;

  -- Lock the quiz row; verify ownership + not-yet-submitted within the transaction.
  select submitted_at into v_submitted
  from public.quizzes
  where id = p_quiz_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'quiz_not_found';
  end if;

  if v_submitted is not null then
    raise exception 'quiz_already_submitted';
  end if;

  update public.quizzes set submitted_at = now() where id = p_quiz_id;

  -- Credit the wallet (server-authoritative currency).
  insert into public.screentime_balance (user_id, remaining_seconds)
  values (p_user_id, p_earned_seconds)
  on conflict (user_id)
  do update
    set remaining_seconds = public.screentime_balance.remaining_seconds + excluded.remaining_seconds
  returning remaining_seconds into v_balance;

  -- Append the earnings ledger.
  insert into public.quiz_history (user_id, quiz_id, correct_count, earned_seconds)
  values (p_user_id, p_quiz_id, p_correct_count, p_earned_seconds);

  -- Clear the SOS debt flag if this submit repaid it.
  if p_clear_debt then
    update public.profiles set sos_debt_flag = false where user_id = p_user_id;
  end if;

  return v_balance;
end;
$$;

-- Re-assert the execute grants (CREATE OR REPLACE preserves them, but be explicit).
revoke all on function public.submit_quiz_reward(uuid, uuid, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_quiz_reward(uuid, uuid, integer, integer, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4) Drop redundant single-column indexes (leading column of composite twins)
-- ---------------------------------------------------------------------------
drop index if exists public.idx_knowledge_materials_user_id;
drop index if exists public.idx_quiz_history_user_id;

-- ---------------------------------------------------------------------------
-- 5) Correct the stale column comment (quizzes persist since migration 0009)
-- ---------------------------------------------------------------------------
comment on column public.quiz_history.quiz_id is
  'The generated quiz (public.quizzes.id) this attempt belongs to.';
