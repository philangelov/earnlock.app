-- Migration: 0008_harden_function_grants
-- Purpose : Lock down the SECURITY DEFINER trigger function.
--
-- handle_new_user() is a TRIGGER function; a trigger fires regardless of EXECUTE
-- grants, so no client role needs to call it directly. By default functions in the
-- public schema are also exposed as PostgREST RPCs (/rest/v1/rpc/<fn>) callable by
-- anon/authenticated — unnecessary attack surface for a SECURITY DEFINER function
-- (Supabase security linter 0028/0029). Revoke it; the trigger keeps working.

revoke all on function public.handle_new_user() from public, anon, authenticated;
