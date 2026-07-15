-- Migration: 0016_material_understanding
-- Purpose : Track how well a learner has understood each imported material.
--
-- Materials could be imported and quizzed on, but nothing recorded which material a quiz
-- came from, so "how well do I understand this material" was unanswerable. This migration:
--
--   1) adds knowledge_materials.title — a short display name for the Materials manager,
--   2) adds quizzes.material_id — the material a quiz was generated from (NULL for a
--      profile/text quiz), so the reward path knows which material to credit,
--   3) adds material_stats — a per-user, per-material correct/total tally (the same shape
--      and posture as subject_stats),
--   4) widens submit_quiz_reward() to fold the attempt into material_stats when the quiz
--      came from a material — still one atomic transaction, and WITHOUT changing the
--      function's signature (the material id is read from the locked quizzes row),
--   5) extends user_stats() with a `materials` array: every material with its
--      understanding, so the Learn journey can show per-material progress from real data.
--
-- Ships together with the backend that sets quizzes.material_id and reads the new shape:
-- deploying one without the other leaves GET /stats or /quiz/generate inconsistent.

-- ---------------------------------------------------------------------------
-- 1) knowledge_materials.title — a name for the Materials manager
-- ---------------------------------------------------------------------------
alter table public.knowledge_materials
  add column if not exists title text not null default '';

comment on column public.knowledge_materials.title is
  'Short display name for the material (derived from its text if the client sends none).';

-- Backfill existing rows from the first words of their text, so nothing shows up nameless.
update public.knowledge_materials
   set title = left(regexp_replace(raw_text, '\s+', ' ', 'g'), 48)
 where title = '';

-- ---------------------------------------------------------------------------
-- 2) quizzes.material_id — which material a quiz was generated from
-- ---------------------------------------------------------------------------
-- ON DELETE SET NULL, not CASCADE: deleting a material must not erase the quiz history
-- (and therefore the streak / earned time) that was built while studying it.
alter table public.quizzes
  add column if not exists material_id uuid
  references public.knowledge_materials (id) on delete set null;

comment on column public.quizzes.material_id is
  'The imported material this quiz was generated from (source=material); NULL otherwise.';

create index if not exists idx_quizzes_material_id
  on public.quizzes (material_id) where material_id is not null;

-- ---------------------------------------------------------------------------
-- 3) material_stats — lifetime correct/total per material, per user
-- ---------------------------------------------------------------------------
create table if not exists public.material_stats (
  user_id       uuid        not null references public.users (id) on delete cascade,
  material_id   uuid        not null references public.knowledge_materials (id) on delete cascade,
  correct_count integer     not null default 0 check (correct_count >= 0),
  total_count   integer     not null default 0 check (total_count >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, material_id),
  constraint material_stats_correct_within_total check (correct_count <= total_count)
);

comment on table public.material_stats is
  'Lifetime per-material answer tally (correct/total), upserted by submit_quiz_reward(). Drives the Learn journey''s per-material understanding.';

drop trigger if exists trg_material_stats_updated_at on public.material_stats;
create trigger trg_material_stats_updated_at
  before update on public.material_stats
  for each row execute function public.set_updated_at();

-- Same posture as subject_stats: owner-scoped SELECT, no client writes.
revoke all on public.material_stats from anon;
revoke insert, update, delete on public.material_stats from authenticated;

alter table public.material_stats enable row level security;
alter table public.material_stats force row level security;

drop policy if exists "material_stats_select_own" on public.material_stats;
create policy "material_stats_select_own"
  on public.material_stats for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 4) submit_quiz_reward(): also fold the attempt into material_stats
-- ---------------------------------------------------------------------------
-- Signature is unchanged (still 7 args) — the material id is read from the quizzes row
-- that is already locked here, so nothing about the backend call or its grants changes.
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
  v_submitted   timestamptz;
  v_material_id uuid;
  v_balance     integer;
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

  -- Lock the quiz row; verify ownership + not-yet-submitted, and learn which material it
  -- came from, all within the transaction.
  select submitted_at, material_id into v_submitted, v_material_id
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

  -- Fold the whole attempt into the material's understanding, when it came from one.
  if v_material_id is not null then
    insert into public.material_stats as m (user_id, material_id, correct_count, total_count)
    values (p_user_id, v_material_id, p_correct_count, p_total_count)
    on conflict (user_id, material_id)
    do update
      set correct_count = m.correct_count + excluded.correct_count,
          total_count   = m.total_count + excluded.total_count;
  end if;

  -- Clear the SOS debt flag if this submit repaid it.
  if p_clear_debt then
    update public.profiles set sos_debt_flag = false where user_id = p_user_id;
  end if;

  return v_balance;
end;
$$;

comment on function public.submit_quiz_reward(uuid, uuid, integer, integer, integer, boolean, jsonb)
  is 'Atomic quiz reward: idempotent submit + window extension + history + subject & material tallies + debt clear. Returns seconds remaining on the window.';

revoke all on function public.submit_quiz_reward(uuid, uuid, integer, integer, integer, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_quiz_reward(uuid, uuid, integer, integer, integer, boolean, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5) user_stats(): add a `materials` array (understanding per imported material)
-- ---------------------------------------------------------------------------
-- Identical to 0015 apart from the new v_materials block and its slot in the result.
-- Repeated in full because CREATE OR REPLACE FUNCTION has no way to patch a body.
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
  v_materials jsonb;
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

  -- Every material the learner owns, with its understanding. LEFT JOIN so a freshly
  -- imported material appears immediately at 0/0 rather than only after its first quiz.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'material_id', m.id,
        'title',       m.title,
        'source_type', m.source_type,
        'preview',     left(m.raw_text, 140),
        'correct',     coalesce(ms.correct_count, 0),
        'total',       coalesce(ms.total_count, 0),
        'accuracy',    case when coalesce(ms.total_count, 0) > 0
                            then round(ms.correct_count::numeric / ms.total_count, 4)
                            else null end,
        'created_at',  m.created_at
      )
      order by m.created_at desc
    ),
    '[]'::jsonb
  )
  into v_materials
  from public.knowledge_materials m
  left join public.material_stats ms
    on ms.material_id = m.id and ms.user_id = m.user_id
  where m.user_id = p_user_id;

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
    'daily',     v_daily,
    'subjects',  v_subjects,
    'materials', v_materials,
    'recent',    v_recent
  );
end;
$$;

comment on function public.user_stats(uuid, integer)
  is 'Every aggregate the app renders (totals, streak, 7-day series, subject mastery, material understanding, recent attempts), bucketed in the caller''s local day.';

revoke all on function public.user_stats(uuid, integer) from public, anon, authenticated;
grant execute on function public.user_stats(uuid, integer) to service_role;
