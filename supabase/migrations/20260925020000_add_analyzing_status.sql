-- Migration: Add 'analyzing' status to meetings and recordings
-- Updates status check constraints to allow 'analyzing' in the pipeline:
-- pending/uploaded -> transcribing -> analyzing -> ready (or failed)

begin;

-- 1. Update meetings_status_check constraint to include 'analyzing'
alter table public.meetings drop constraint if exists meetings_status_check;
alter table public.meetings add constraint meetings_status_check
  check (status in ('pending', 'uploaded', 'transcribing', 'analyzing', 'processing', 'ready', 'failed'));

-- 2. Update recordings_status_check constraint to include 'analyzing'
alter table public.recordings drop constraint if exists recordings_status_check;
alter table public.recordings add constraint recordings_status_check
  check (status in ('uploading', 'uploaded', 'transcribing', 'analyzing', 'processing', 'ready', 'failed'));

commit;
