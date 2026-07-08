-- Migration: 0012_revoke_truncate_from_clients
-- Purpose : Make the "clients cannot write" guarantee airtight.
--
-- Supabase's default `GRANT ALL` to anon/authenticated includes TRUNCATE, REFERENCES
-- and TRIGGER. Migrations 0002-0009 revoked INSERT/UPDATE/DELETE (and 0011 revoked
-- everything from anon), but authenticated still held TRUNCATE — and crucially,
-- **TRUNCATE is NOT filtered by RLS**. It is not reachable through the PostgREST /
-- GoTrue data API (no client can issue a raw TRUNCATE), so this is defense-in-depth,
-- not a live hole. We revoke TRUNCATE/REFERENCES/TRIGGER so the only privilege any
-- client role retains is the owner-scoped SELECT the policies grant.

revoke truncate, references, trigger on public.users              from authenticated;
revoke truncate, references, trigger on public.profiles           from authenticated;
revoke truncate, references, trigger on public.knowledge_materials from authenticated;
revoke truncate, references, trigger on public.screentime_balance from authenticated;
revoke truncate, references, trigger on public.quiz_history       from authenticated;
revoke truncate, references, trigger on public.quizzes            from authenticated;
