-- Migration: Add Soniox async transcription support to meetings and recordings
-- Updates status check constraints to allow 'uploaded' and 'transcribing'
-- Adds soniox_job_id and transcription_job_id to meetings and recordings

begin;

-- 1. Update meetings_status_check constraint
alter table public.meetings drop constraint if exists meetings_status_check;
alter table public.meetings add constraint meetings_status_check
  check (status in ('pending', 'uploaded', 'transcribing', 'processing', 'ready', 'failed'));

-- 2. Update recordings_status_check constraint
alter table public.recordings drop constraint if exists recordings_status_check;
alter table public.recordings add constraint recordings_status_check
  check (status in ('uploading', 'uploaded', 'transcribing', 'processing', 'ready', 'failed'));

-- 3. Add Soniox job tracking columns to meetings
alter table public.meetings add column if not exists soniox_job_id text;
alter table public.meetings add column if not exists transcription_job_id text;

-- 4. Add Soniox job tracking columns to recordings
alter table public.recordings add column if not exists soniox_job_id text;
alter table public.recordings add column if not exists transcription_job_id text;

-- 5. Indexes for fast job lookup
create index if not exists idx_meetings_soniox_job_id on public.meetings (soniox_job_id);
create index if not exists idx_meetings_transcription_job_id on public.meetings (transcription_job_id);
create index if not exists idx_recordings_soniox_job_id on public.recordings (soniox_job_id);
create index if not exists idx_recordings_transcription_job_id on public.recordings (transcription_job_id);

commit;
