-- Migration: 0001_helper_functions
-- Purpose : Shared trigger helper(s) used by later migrations.
--
-- `set_updated_at()` stamps an `updated_at` column on every UPDATE so callers never
-- have to remember to. Runs as a BEFORE trigger with the invoker's privileges and
-- pins an empty search_path so it can't be hijacked by a malicious object on the path.
--
-- Idempotent: safe to re-run.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger helper: stamps NEW.updated_at with the current time.';
