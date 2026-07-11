-- Migration: 0015_screentime_window
-- Purpose : Make earned screen time actually run out.
--
-- The wallet stored a DURATION (`remaining_seconds`) that only ever went up: /quiz/submit
-- credited it and nothing ever debited it. The client turned it into a deadline on every
-- launch (`unlockUntil = now + remaining_seconds`), so relaunching the app re-granted the
-- full balance. Screen time was effectively unlimited, and the countdown reset itself.
--
-- The fix is to store the thing that is actually true: the INSTANT the shield comes back.
-- Earning extends that instant; wall-clock time consumes it, whether the app is open,
-- backgrounded, or deleted. `remaining` is derived (`unlocked_until - now()`), never
-- stored, so there is nothing left to drift or to re-grant.
--
-- The server's clock is the only clock in this calculation. A device that moves its own
-- clock forward cannot mint seconds, and one that moves it back cannot hoard them.

-- ---------------------------------------------------------------------------
-- 1) screentime_balance: a deadline, not a duration
-- ---------------------------------------------------------------------------
alter table public.screentime_balance
  add column if not exists unlocked_until timestamptz;

-- Backfill honestly: a balance of N seconds stamped at `updated_at` was a window that
-- should have expired at `updated_at + N`. For every existing row that instant is already
-- in the past, which is exactly right — that time was granted hours ago and, under the
-- old model, silently re-granted on every launch since.
update public.screentime_balance
   set unlocked_until = updated_at + make_interval(secs => remaining_seconds)
 where unlocked_until is null;

alter table public.screentime_balance
  alter column unlocked_until set default now();
alter table public.screentime_balance
  alter column unlocked_until set not null;

comment on column public.screentime_balance.unlocked_until is
  'The instant the shield returns. Earning extends it; wall-clock time consumes it. Remaining seconds are derived from this and never stored.';

-- `remaining_seconds` cannot survive: a stored duration alongside a deadline is two
-- sources of truth for one fact, and the stale one is the one callers would reach for.
alter table public.screentime_balance drop column if exists remaining_seconds;

comment on table public.screentime_balance is
  'The screen-time window (server-authoritative). One row per user; `unlocked_until` is the only state.';

-- ---------------------------------------------------------------------------
-- 2) submit_quiz_reward(): extend the window instead of topping up a duration
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_reward(
  p_user_id        uuid,
  p_quiz_id        uuid,
  p_correct_count  integer,
  p_total_count    integer,
  p_earned_seconds integer,
  p_clear_debt     boolean,
  p_subject_stats  jsonb default '[]'::jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submitted timestamptz;
  v_balance   integer;
begin
  if p_correct_count < 0 or p_earned_seconds < 0 or p_total_count < 0 then
    raise exception 'invalid_reward_arguments';
  end if;
  if p_correct_count > p_total_count then
    raise exception 'invalid_reward_arguments';
  end if;
  if jsonb_typeof(p_subject_stats) <> 'array' then
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

  -- Extend the window. `greatest(unlocked_until, now())` is what stops an expired window
  -- from being back-dated: a user who last earned an hour ago starts their new minutes
  -- from now, not from an hour ago, and a user with time still on the clock stacks onto
  -- the end of it rather than losing what is left.
  insert into public.screentime_balance as b (user_id, unlocked_until)
  values (p_user_id, now() + make_interval(secs => p_earned_seconds))
  on conflict (user_id)
  do update
    set unlocked_until = greatest(b.unlocked_until, now()) + make_interval(secs => p_earned_seconds)
  returning greatest(0, ceil(extract(epoch from (b.unlocked_until - now()))))::integer
  into v_balance;

  -- Append the earnings ledger.
  insert into public.quiz_history (user_id, quiz_id, correct_count, total_count, earned_seconds)
  values (p_user_id, p_quiz_id, p_correct_count, p_total_count, p_earned_seconds);

  -- Fold this attempt's per-subject tallies into the lifetime totals.
  insert into public.subject_stats as s (user_id, subject, correct_count, total_count)
  select
    p_user_id,
    item->>'subject',
    (item->>'correct')::integer,
    (item->>'total')::integer
  from jsonb_array_elements(p_subject_stats) as item
  where nullif(item->>'subject', '') is not null
  on conflict (user_id, subject)
  do update
    set correct_count = s.correct_count + excluded.correct_count,
        total_count   = s.total_count + excluded.total_count;

  -- Clear the SOS debt flag if this submit repaid it.
  if p_clear_debt then
    update public.profiles set sos_debt_flag = false where user_id = p_user_id;
  end if;

  return v_balance;
end;
$$;

comment on function public.submit_quiz_reward(uuid, uuid, integer, integer, integer, boolean, jsonb)
  is 'Atomic quiz reward: idempotent submit + window extension + history + subject tallies + debt clear. Returns seconds remaining on the window.';

revoke all on function public.submit_quiz_reward(uuid, uuid, integer, integer, integer, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_quiz_reward(uuid, uuid, integer, integer, integer, boolean, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) user_stats(): derive `remaining_seconds` from the window
-- ---------------------------------------------------------------------------
-- Identical to 0014 apart from how v_remaining is read. Repeated in full because
-- CREATE OR REPLACE FUNCTION has no way to patch a body.
create or replace function public.user_stats(
  p_user_id           uuid,
  p_tz_offset_minutes integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offset    interval;
  v_today     date;
  v_quizzes   bigint  := 0;
  v_correct   bigint  := 0;
  v_answered  bigint  := 0;
  v_earned    bigint  := 0;
  v_remaining integer := 0;
  v_current   integer := 0;
  v_best      integer := 0;
  v_active    boolean := false;
  v_daily     jsonb;
  v_subjects  jsonb;
  v_recent    jsonb;
begin
  if p_tz_offset_minutes is null or p_tz_offset_minutes < -840 or p_tz_offset_minutes > 840 then
    raise exception 'invalid_tz_offset';
  end if;

  v_offset := make_interval(mins => p_tz_offset_minutes);
  v_today  := ((now() at time zone 'UTC') + v_offset)::date;

  select
    count(*),
    coalesce(sum(h.correct_count) filter (where h.total_count is not null), 0),
    coalesce(sum(h.total_count), 0),
    coalesce(sum(h.earned_seconds), 0)
  into v_quizzes, v_correct, v_answered, v_earned
  from public.quiz_history h
  where h.user_id = p_user_id;

  -- Derived, never stored: what is left of the window right now.
  select greatest(0, ceil(extract(epoch from (b.unlocked_until - now()))))::integer
  into v_remaining
  from public.screentime_balance b
  where b.user_id = p_user_id;
  v_remaining := coalesce(v_remaining, 0);

  with active_days as (
    select distinct (((h.created_at at time zone 'UTC') + v_offset)::date) as day
    from public.quiz_history h
    where h.user_id = p_user_id
  ),
  islands as (
    select day, day - (row_number() over (order by day))::integer as island
    from active_days
  ),
  runs as (
    select count(*)::integer as length, max(day) as last_day
    from islands
    group by island
  )
  select
    coalesce(max(r.length), 0),
    coalesce(max(r.length) filter (where r.last_day >= v_today - 1), 0),
    coalesce(bool_or(r.last_day = v_today), false)
  into v_best, v_current, v_active
  from runs r;

  select coalesce(jsonb_agg(bucket order by bucket.date), '[]'::jsonb)
  into v_daily
  from (
    select
      (v_today - 6 + gs.day_offset)                                              as date,
      count(h.id)                                                                as quizzes,
      coalesce(sum(h.correct_count) filter (where h.total_count is not null), 0) as correct,
      coalesce(sum(h.total_count), 0)                                            as total,
      coalesce(sum(h.earned_seconds), 0)                                         as earned_seconds
    from generate_series(0, 6) as gs(day_offset)
    left join public.quiz_history h
      on h.user_id = p_user_id
     and (((h.created_at at time zone 'UTC') + v_offset)::date) = v_today - 6 + gs.day_offset
    group by gs.day_offset
  ) as bucket;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'subject',  s.subject,
        'correct',  s.correct_count,
        'total',    s.total_count,
        'accuracy', case when s.total_count > 0
                         then round(s.correct_count::numeric / s.total_count, 4)
                         else null end
      )
      order by s.total_count desc, s.subject
    ),
    '[]'::jsonb
  )
  into v_subjects
  from public.subject_stats s
  where s.user_id = p_user_id and s.total_count > 0;

  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.created_at desc), '[]'::jsonb)
  into v_recent
  from (
    select h.quiz_id, h.correct_count, h.total_count, h.earned_seconds, h.created_at
    from public.quiz_history h
    where h.user_id = p_user_id
    order by h.created_at desc
    limit 30
  ) as r;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'quizzes',            v_quizzes,
      'questions_answered', v_answered,
      'questions_correct',  v_correct,
      'accuracy',           case when v_answered > 0
                                 then round(v_correct::numeric / v_answered, 4)
                                 else null end,
      'earned_seconds',     v_earned,
      'spent_seconds',      greatest(v_earned - v_remaining, 0),
      'remaining_seconds',  v_remaining
    ),
    'streak', jsonb_build_object(
      'current',      v_current,
      'best',         v_best,
      'active_today', v_active
    ),
    'daily',    v_daily,
    'subjects', v_subjects,
    'recent',   v_recent
  );
end;
$$;

comment on function public.user_stats(uuid, integer)
  is 'Every aggregate the app renders, bucketed in the caller''s local day. `remaining_seconds` is derived from screentime_balance.unlocked_until.';

revoke all on function public.user_stats(uuid, integer) from public, anon, authenticated;
grant execute on function public.user_stats(uuid, integer) to service_role;
