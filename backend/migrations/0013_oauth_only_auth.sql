-- Migration: 0013_oauth_only_auth
-- Purpose : Make the account graph safe for OAuth-only sign-in (Apple / Google).
--
-- EarnLock dropped password auth. The client now obtains an Apple/Google identity token
-- natively and the backend exchanges it through Supabase's id_token grant
-- (see backend/app/routes/auth.py). Two consequences reach the schema:
--
--   1) An Apple account can arrive with no email at all. "Hide My Email" still yields a
--      private-relay address, but a user who declines the email scope yields none, and
--      auth.users.email is nullable. public.users.email was NOT NULL, so
--      handle_new_user() would raise 23502 and fail the entire sign-in — the account
--      would be half-created in auth.users with no app rows behind it. Relax the column.
--
--      The UNIQUE constraint stays. Postgres treats NULLs as distinct under a unique
--      index, so any number of email-less accounts coexist while real addresses remain
--      unique — which is exactly what 0011's email-sync trigger relies on.
--
--   2) The id_token grant has no signup-metadata channel, so grade_or_age always falls
--      back to 'unspecified' on first sign-in. handle_new_user() already does that; the
--      client corrects it with PUT /profile as soon as onboarding knows the age. No
--      schema change needed, noted here so the fallback doesn't look accidental.

alter table public.users alter column email drop not null;

comment on column public.users.email is
  'Mirror of auth.users.email. NULL when the identity provider withheld it (Apple). '
  'UNIQUE still holds for real addresses: NULLs are distinct under a unique index.';
