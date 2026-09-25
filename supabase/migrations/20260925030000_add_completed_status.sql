-- Migration: Add 'completed' status to meetings and recordings
-- Allows meeting status to transition:
-- pending/uploaded -> transcribing -> analyzing -> completed

begin;

-- 1. Update meetings_status_check constraint to include 'completed'
alter table public.meetings drop constraint if exists meetings_status_check;
alter table public.meetings add constraint meetings_status_check
  check (status in ('pending', 'uploaded', 'transcribing', 'analyzing', 'processing', 'ready', 'completed', 'failed'));

-- 2. Update recordings_status_check constraint to include 'completed'
alter table public.recordings drop constraint if exists recordings_status_check;
alter table public.recordings add constraint recordings_status_check
  check (status in ('uploading', 'uploaded', 'transcribing', 'analyzing', 'processing', 'ready', 'completed', 'failed'));

commit;
