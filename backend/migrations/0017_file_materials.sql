-- Migration: 0017_file_materials
-- Purpose : Allow a third material source — an uploaded file (PDF or photo).
--
-- POST /knowledge/import can now accept source_type='file': the client sends the file
-- bytes (base64) and the backend transcribes the study text out of it with the AI model
-- (app/ai/extractor.py), then stores that text in the same `raw_text` column every other
-- material uses. So nothing downstream changes — quiz generation, material_stats, and the
-- understanding % all read `raw_text` exactly as they do for pasted text or a fetched link.
-- This migration only widens the source_type CHECK so a 'file' row is allowed to exist.

alter table public.knowledge_materials
  drop constraint if exists knowledge_materials_source_type_check;

alter table public.knowledge_materials
  add constraint knowledge_materials_source_type_check
  check (source_type in ('text', 'link', 'file'));

comment on column public.knowledge_materials.source_type is
  'Origin of the text: text (pasted) | link (fetched + stripped) | file (uploaded PDF/photo, transcribed).';
