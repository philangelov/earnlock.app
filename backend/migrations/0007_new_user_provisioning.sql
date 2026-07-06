-- Migration: 0007_new_user_provisioning
-- Purpose : Auto-provision the account graph on signup (Issue #2's "automatic mechanism").
--
-- An AFTER INSERT trigger on auth.users gives every new authenticated user their
-- three baseline rows in one shot: users -> profiles -> screentime_balance (in FK
-- order). The function is SECURITY DEFINER so it can write tables the signing-up user
-- has no grant on, and pins search_path = '' against path-hijacking. Every insert is
-- ON CONFLICT DO NOTHING so a reprovision or race can never fail a signup.
--
-- grade_or_age is NOT NULL in public.users. The recommended registration flow is for
-- POST /auth/register to pass it in the Supabase signup metadata
-- (options.data.grade_or_age), which this trigger reads. If it is ever absent we fall
-- back to 'unspecified' so signup still succeeds; the backend can correct it later.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, grade_or_age)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'grade_or_age', ''), 'unspecified')
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.screentime_balance (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT on auth.users: provisions users + profiles + screentime_balance rows for the new user.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
