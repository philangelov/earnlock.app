-- Migration: 0010_submit_quiz_reward
-- Purpose : Score a quiz's reward ATOMICALLY, in one transaction:
--   1) idempotency guard — lock the quiz row and reject a second submit,
--   2) credit the screen-time balance (create the wallet row if first time),
--   3) append the quiz_history earnings ledger,
--   4) clear the SOS debt flag when the submit repaid it.
-- Returns the new remaining balance in seconds.
--
-- Because it is one transaction, rapid-fire / concurrent submits of the same quiz cannot
-- double-credit: the row lock + submitted_at check serialize them, and the loser gets
-- 'quiz_already_submitted' (the backend maps that to HTTP 409). Debt is a flag, never a
-- negative balance (screentime_balance.remaining_seconds is CHECK >= 0).

create or replace function public.submit_quiz_reward(
  p_user_id        uuid,
  p_quiz_id        uuid,
  p_correct_count  integer,
  p_earned_seconds integer,
  p_clear_debt     boolean
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submitted timestamptz;
  v_balance   integer;
begin
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

comment on function public.submit_quiz_reward(uuid, uuid, integer, integer, boolean)
  is 'Atomic quiz reward: idempotent submit + balance credit + history + debt clear.';

-- Only the backend service role may execute it.
revoke all on function public.submit_quiz_reward(uuid, uuid, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_quiz_reward(uuid, uuid, integer, integer, boolean)
  to service_role;
