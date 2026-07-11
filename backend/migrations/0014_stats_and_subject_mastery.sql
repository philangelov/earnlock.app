-- Migration: 0014_stats_and_subject_mastery
-- Purpose : Make the Insights and Learn surfaces readable from real data.
--
-- Until now quiz_history recorded how many answers were correct but not how many were
-- asked, so accuracy was unknowable, and nothing recorded which subject a question
-- belonged to, so "subject mastery" could only ever be invented. This migration:
--
--   1) adds quiz_history.total_count (backfilled from the persisted quizzes rows),
--   2) adds subject_stats — a per-user, per-subject correct/total tally,
--   3) widens submit_quiz_reward() to record both, still in the one atomic transaction,
--   4) adds user_stats() — one read that returns every aggregate the app displays
--      (totals, current/best streak, a 7-day series, subject mastery, recent attempts),
--      bucketed in the caller's local day rather than UTC.
--
-- Day bucketing: a streak is a human, local-calendar notion — a quiz finished at
-- 23:30 in Sofia is "today", not "tomorrow" as UTC would have it. The client passes its
-- UTC offset in minutes and every date here is derived by shifting timestamps by it.

-- ---------------------------------------------------------------------------
-- 1) quiz_history.total_count — how many questions the attempt actually asked
-- ---------------------------------------------------------------------------
alter table public.quiz_history
  add column if not exists total_count integer
  check (total_count is null or total_count >= 0);

comment on column public.quiz_history.total_count is
  'Questions asked in the attempt. NULL for rows written before migration 0014 whose quiz row is gone; accuracy math must treat NULL as unknown, not as zero.';

-- Backfill from the answer key we still hold. Rows from before 0009 (quizzes were
-- ephemeral) have no quiz row to measure and stay NULL — honestly unknown.
update public.quiz_history h
   set total_count = jsonb_array_length(q.questions)
  from public.quizzes q
 where q.id = h.quiz_id
   and h.total_count is null
   and jsonb_typeof(q.questions) = 'array';

-- ---------------------------------------------------------------------------
-- 2) subject_stats — lifetime correct/total per subject, per user
-- ---------------------------------------------------------------------------
-- A running tally rather than a per-answer log: the app only ever renders the ratio,
-- and a tally keeps the read a single indexed row-set instead of a scan over history.
create table if not exists public.subject_stats (
  user_id       uuid        not null references public.users (id) on delete cascade,
  subject       text        not null,
  correct_count integer     not null default 0 check (correct_count >= 0),
  total_count   integer     not null default 0 check (total_count >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, subject),
  constraint subject_stats_correct_within_total check (correct_count <= total_count)
);

comment on table public.subject_stats is
  'Lifetime per-subject answer tally (correct/total), upserted by submit_quiz_reward(). Drives Insights → subject mastery.';

drop trigger if exists trg_subject_stats_updated_at on public.subject_stats;
create trigger trg_subject_stats_updated_at
  before update on public.subject_stats
  for each row execute function public.set_updated_at();

-- Same posture as every other table: owner-scoped SELECT, no client writes.
revoke all on public.subject_stats from anon;
revoke insert, update, delete on public.subject_stats from authenticated;

alter table public.subject_stats enable row level security;
alter table public.subject_stats force row level security;

drop policy if exists "subject_stats_select_own" on public.subject_stats;
create policy "subject_stats_select_own"
  on public.subject_stats for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3) submit_quiz_reward(): also record total_count and the per-subject tallies
-- ---------------------------------------------------------------------------
-- The old 5-argument signature is dropped rather than overloaded: two functions that
-- both "submit a quiz" but disagree about whether history is complete is exactly the
-- kind of ambiguity that outlives the person who introduced it. The backend is the only
-- caller (service_role) and ships with this migration.
drop function if exists public.submit_quiz_reward(uuid, uuid, integer, integer, boolean);

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

  -- Credit the wallet (server-authoritative currency).
  insert into public.screentime_balance (user_id, remaining_seconds)
  values (p_user_id, p_earned_seconds)
  on conflict (user_id)
  do update
    set remaining_seconds = public.screentime_balance.remaining_seconds + excluded.remaining_seconds
  returning remaining_seconds into v_balance;

  -- Append the earnings ledger.
  insert into public.quiz_history (user_id, quiz_id, correct_count, total_count, earned_seconds)
  values (p_user_id, p_quiz_id, p_correct_count, p_total_count, p_earned_seconds);

  -- Fold this attempt's per-subject tallies into the lifetime totals. Rows arrive as
  -- [{"subject": "Math", "correct": 3, "total": 4}, ...]; anything malformed raises and
  -- takes the whole transaction with it, which is the point of doing it here.
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
  is 'Atomic quiz reward: idempotent submit + balance credit + history + subject tallies + debt clear.';

revoke all on function public.submit_quiz_reward(uuid, uuid, integer, integer, integer, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_quiz_reward(uuid, uuid, integer, integer, integer, boolean, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4) user_stats(): every aggregate the app renders, in one round trip
-- ---------------------------------------------------------------------------
-- Returned shape (all durations in seconds, all dates ISO local days):
--   {
--     "totals":   {quizzes, questions_answered, questions_correct, accuracy,
--                  earned_seconds, spent_seconds, remaining_seconds},
--     "streak":   {current, best, active_today},
--     "daily":    [{date, quizzes, correct, total, earned_seconds}]  -- exactly 7, oldest first
--     "subjects": [{subject, correct, total, accuracy}]              -- most-answered first
--     "recent":   [{quiz_id, correct_count, total_count, earned_seconds, created_at}]
--   }
--
-- `accuracy` is null (not 0) when nothing has been answered — "no data" and "got
-- everything wrong" must not render identically.
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
  -- UTC-14:00 .. UTC+14:00 is the real-world range of civil offsets.
  if p_tz_offset_minutes is null or p_tz_offset_minutes < -840 or p_tz_offset_minutes > 840 then
    raise exception 'invalid_tz_offset';
  end if;

  v_offset := make_interval(mins => p_tz_offset_minutes);
  v_today  := ((now() at time zone 'UTC') + v_offset)::date;

  -- Lifetime totals. `correct` and `answered` are both taken from the rows that carry a
  -- denominator, so the pair is always self-consistent. Summing correct_count over ALL
  -- rows while summing total_count over only the measurable ones would let a legacy row
  -- push accuracy above 100%.
  select
    count(*),
    coalesce(sum(h.correct_count) filter (where h.total_count is not null), 0),
    coalesce(sum(h.total_count), 0),
    coalesce(sum(h.earned_seconds), 0)
  into v_quizzes, v_correct, v_answered, v_earned
  from public.quiz_history h
  where h.user_id = p_user_id;

  select coalesce(b.remaining_seconds, 0)
  into v_remaining
  from public.screentime_balance b
  where b.user_id = p_user_id;
  v_remaining := coalesce(v_remaining, 0);

  -- Streaks, by the gaps-and-islands trick: subtracting a dense row number from a dense
  -- run of dates yields a constant, so consecutive days collapse into one group.
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
    -- A streak survives the day you haven't studied yet: it only dies once yesterday
    -- passed without a quiz.
    coalesce(max(r.length) filter (where r.last_day >= v_today - 1), 0),
    coalesce(bool_or(r.last_day = v_today), false)
  into v_best, v_current, v_active
  from runs r;

  -- Exactly 7 buckets, zero-filled, oldest first — the chart must not shift its bars
  -- around just because a day had no activity.
  -- Walked as integers, not as `generate_series(date, date, interval)`: a bare date is
  -- implicitly castable to both timestamp and timestamptz, so that overload resolves to
  -- whichever is the preferred type and then re-reads the session TimeZone on the way
  -- back to a date. Adding an int to a date has exactly one meaning.
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

  -- Newest first. The Learn roadmap walks these in reverse to lay out its path.
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
      -- What's gone from the wallet: everything credited, minus what's still in it.
      -- Clamped because an SOS grant can credit seconds this ledger never saw.
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
  is 'Every aggregate the app renders (totals, streak, 7-day series, subject mastery, recent attempts), bucketed in the caller''s local day.';

revoke all on function public.user_stats(uuid, integer) from public, anon, authenticated;
grant execute on function public.user_stats(uuid, integer) to service_role;
