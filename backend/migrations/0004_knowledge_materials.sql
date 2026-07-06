-- Migration: 0004_knowledge_materials
-- Purpose : Imported study text, per docs/api-contract.md (§4 Knowledge Import).
--
-- One row per imported material. `raw_text` is the normalized plain text (HTML
-- stripped, whitespace collapsed, capped at KNOWLEDGE_MAX_CHARS by the backend).
-- source_type records whether it came from pasted text or a fetched link. Written by
-- POST /knowledge/import, listed by GET /knowledge, read by /quiz/generate
-- (source=material) — all backend endpoints using the service_role.

create table if not exists public.knowledge_materials (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users (id) on delete cascade,
  raw_text    text        not null,
  source_type text        not null check (source_type in ('text', 'link')),
  created_at  timestamptz not null default now()
);

comment on table  public.knowledge_materials is 'Imported study text used as a source for quiz generation.';
comment on column public.knowledge_materials.source_type is 'Origin of the text: text (pasted) | link (fetched + stripped).';

-- Index the RLS predicate column and the "newest first" list query (GET /knowledge).
create index if not exists idx_knowledge_materials_user_id     on public.knowledge_materials (user_id);
create index if not exists idx_knowledge_materials_user_recent on public.knowledge_materials (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-Level Security: owner may read own rows; all writes go through the backend.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.knowledge_materials from authenticated;

alter table public.knowledge_materials enable row level security;
alter table public.knowledge_materials force row level security;

create policy "knowledge_materials_select_own"
  on public.knowledge_materials for select
  to authenticated
  using ((select auth.uid()) = user_id);
