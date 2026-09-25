-- Migration: Add highlight_id column to share_links table
-- Supports sharing specific meeting highlights in addition to whole meetings

begin;

alter table public.share_links add column if not exists highlight_id uuid references public.highlights (id) on delete cascade;
create index if not exists idx_share_links_highlight_id on public.share_links (highlight_id);

commit;
