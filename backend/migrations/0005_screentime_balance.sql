-- Migration: 0005_screentime_balance
-- Purpose : The screen-time currency, per docs/api-contract.md (§6) — SERVER-AUTHORITATIVE.
--
-- One row per user holding the remaining earned screen time in SECONDS. This is the
-- currency the child spends to keep apps unlocked; the number must never be forgeable
-- from the client (architecture.md §11). It is credited by /quiz/submit and /sos and
-- read by /screentime/balance — all backend endpoints using the service_role.
--
-- Clients get owner-scoped SELECT only; there is NO client write path (revoked grants
-- + no write policy), so "clients cannot mint seconds" holds at the database layer.

create table if not exists public.screentime_balance (
  user_id           uuid        primary key references public.users (id) on delete cascade,
  remaining_seconds integer     not null default 0 check (remaining_seconds >= 0),
  updated_at        timestamptz not null default now()
);

comment on table  public.screentime_balance is 'Server-authoritative screen-time wallet (seconds remaining).';
comment on column public.screentime_balance.remaining_seconds is 'Remaining earned screen time in seconds; never negative.';

-- Track when the balance last changed (also settable explicitly by the backend).
drop trigger if exists trg_screentime_balance_updated_at on public.screentime_balance;
create trigger trg_screentime_balance_updated_at
  before update on public.screentime_balance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security: owner may read own balance; only the backend writes it.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.screentime_balance from authenticated;

alter table public.screentime_balance enable row level security;
alter table public.screentime_balance force row level security;

create policy "screentime_balance_select_own"
  on public.screentime_balance for select
  to authenticated
  using ((select auth.uid()) = user_id);
