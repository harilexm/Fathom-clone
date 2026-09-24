-- Migration: create meetings, recordings, transcript_segments, summary_versions, action_items, highlights, share_links
-- Covers full relational hierarchy, foreign keys, cascade deletes, useful indexes, and Row-Level Security (RLS).
-- Cleanly supports the pipeline flow:
-- meeting -> recording -> transcript -> summary/actions -> highlights -> share link

begin;

-- 1. MEETINGS
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  owner uuid references auth.users (id) on delete cascade,
  title text not null default 'Untitled Meeting',
  source text not null default 'upload',
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  participants jsonb not null default '[]'::jsonb,
  meeting_time timestamptz not null default now(),
  meeting_at timestamptz not null default now(),
  duration integer not null default 0 check (duration >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meetings is 'Core meeting records owned by authenticated users.';

-- 2. RECORDINGS
create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  r2_object_key text not null constraint recordings_r2_object_key_unique unique,
  mime_type text not null default 'video/mp4',
  size bigint not null default 0 check (size >= 0),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  duration integer not null default 0 check (duration >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'ready' check (status in ('uploading', 'uploaded', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recordings is 'Media recordings stored in Cloudflare R2 attached to meetings.';

-- 3. TRANSCRIPT SEGMENTS
create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  recording_id uuid references public.recordings (id) on delete set null,
  speaker text not null default '',
  speaker_initials text,
  speaker_color text,
  text text not null,
  start_time numeric(10, 3) not null default 0 check (start_time >= 0),
  end_time numeric(10, 3) not null default 0 check (end_time >= start_time),
  sequence integer not null default 0 check (sequence >= 0),
  sequence_number integer default 0 check (sequence_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.transcript_segments is 'Chronological transcript turns and speaker utterances.';

-- 4. SUMMARY VERSIONS
create table public.summary_versions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  version text not null check (version in ('enhanced', 'standard', 'concise')),
  summary_type text check (summary_type in ('enhanced', 'standard', 'concise')),
  summary text not null default '',
  content text,
  overview jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint summary_versions_meeting_version_unique unique (meeting_id, version)
);

comment on table public.summary_versions is 'Multiple summary formats per meeting: enhanced, standard, and concise.';

-- 5. ACTION ITEMS
create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  task text not null default '',
  text text,
  owner text not null default '',
  due_date text,
  due_at timestamptz,
  completed boolean not null default false,
  is_completed boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.action_items is 'Extracted meeting follow-ups with owner, due date, and completion state.';

-- 6. HIGHLIGHTS
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  title text not null,
  start_timestamp numeric(10, 3) not null default 0 check (start_timestamp >= 0),
  end_timestamp numeric(10, 3) not null default 0 check (end_timestamp >= start_timestamp),
  start_time numeric(10, 3) not null default 0 check (start_time >= 0),
  end_time numeric(10, 3) not null default 0 check (end_time >= start_time),
  kind text default 'Highlight',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.highlights is 'Key meeting moments and bookmark clips with timestamps.';

-- 7. SHARE LINKS
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  token text not null constraint share_links_token_unique unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'active' check (status in ('active', 'revoked')),
  state text not null default 'active' check (state in ('active', 'revoked')),
  is_active boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.share_links is 'Meeting share tokens supporting active and revoked states.';

--------------------------------------------------------------------------------
-- USEFUL INDEXES
--------------------------------------------------------------------------------

-- 1. Meeting lists, sorting, user filtering
create index idx_meetings_user_id on public.meetings (user_id);
create index idx_meetings_meeting_time on public.meetings (meeting_time desc);
create index idx_meetings_user_meeting_time on public.meetings (user_id, meeting_time desc);
create index idx_meetings_user_created_at on public.meetings (user_id, created_at desc);
create index idx_meetings_user_status_time on public.meetings (user_id, status, meeting_time desc);

-- 2. Recordings (FK cascade, object lookups, and status)
create index idx_recordings_meeting_id on public.recordings (meeting_id);
create index idx_recordings_r2_object_key on public.recordings (r2_object_key);
create index idx_recordings_meeting_status on public.recordings (meeting_id, status);

-- 3. Transcript ordering & turn lookups
create index idx_transcript_segments_meeting_id on public.transcript_segments (meeting_id);
create index idx_transcript_segments_meeting_seq on public.transcript_segments (meeting_id, sequence asc);
create index idx_transcript_segments_meeting_start on public.transcript_segments (meeting_id, start_time asc);
create index idx_transcript_segments_order on public.transcript_segments (meeting_id, sequence asc, start_time asc);
create index idx_transcript_segments_recording_id on public.transcript_segments (recording_id);

-- 4. Summary versions
create index idx_summary_versions_meeting_id on public.summary_versions (meeting_id);
create index idx_summary_versions_meeting_version on public.summary_versions (meeting_id, version);

-- 5. Action items
create index idx_action_items_meeting_id on public.action_items (meeting_id);
create index idx_action_items_meeting_completed on public.action_items (meeting_id, completed);
create index idx_action_items_meeting_due on public.action_items (meeting_id, due_at);

-- 6. Highlights
create index idx_highlights_meeting_id on public.highlights (meeting_id);
create index idx_highlights_meeting_start on public.highlights (meeting_id, start_timestamp asc);

-- 7. Share-token lookup, status filtering, and FK cascade
create index idx_share_links_meeting_id on public.share_links (meeting_id);
create index idx_share_links_token on public.share_links (token);
create index idx_share_links_token_status on public.share_links (token, status, is_active);
create index idx_share_links_active_token on public.share_links (token) where (status = 'active' and is_active = true);
create index idx_share_links_meeting_status on public.share_links (meeting_id, status);

--------------------------------------------------------------------------------
-- COMPATIBILITY & FIELD SYNC TRIGGERS
--------------------------------------------------------------------------------

create or replace function public.sync_meetings_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Meeting ownership cannot be changed';
  end if;

  v_user_id := coalesce(new.user_id, new.owner_id, new.owner, auth.uid());
  new.user_id := v_user_id;
  new.owner_id := v_user_id;
  new.owner := v_user_id;

  if new.status is not null then
    new.status := lower(new.status);
  end if;

  if new.duration != 0 and (new.duration_seconds = 0 or new.duration_seconds is null) then
    new.duration_seconds := new.duration;
  elsif new.duration_seconds != 0 and (new.duration = 0 or new.duration is null) then
    new.duration := new.duration_seconds;
  end if;

  if new.meeting_time is not null and new.meeting_at is null then
    new.meeting_at := new.meeting_time;
  elsif new.meeting_at is not null and new.meeting_time is null then
    new.meeting_time := new.meeting_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_meetings_sync
before insert or update on public.meetings
for each row execute function public.sync_meetings_fields();

create or replace function public.sync_recordings_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not null then
    new.status := lower(new.status);
  end if;

  if new.size != 0 and (new.size_bytes = 0 or new.size_bytes is null) then
    new.size_bytes := new.size;
  elsif new.size_bytes != 0 and (new.size = 0 or new.size is null) then
    new.size := new.size_bytes;
  end if;

  if new.duration != 0 and (new.duration_seconds = 0 or new.duration_seconds is null) then
    new.duration_seconds := new.duration;
  elsif new.duration_seconds != 0 and (new.duration = 0 or new.duration is null) then
    new.duration := new.duration_seconds;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_recordings_sync
before insert or update on public.recordings
for each row execute function public.sync_recordings_fields();

create or replace function public.sync_transcript_segments_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sequence := coalesce(new.sequence, new.sequence_number, 0);
  new.sequence_number := new.sequence;

  if new.end_time < new.start_time then
    new.end_time := new.start_time;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_transcript_segments_sync
before insert or update on public.transcript_segments
for each row execute function public.sync_transcript_segments_fields();

create or replace function public.sync_summary_versions_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := lower(coalesce(new.version, new.summary_type, 'standard'));
  new.summary_type := new.version;

  if (new.summary is null or new.summary = '') and new.content is not null then
    new.summary := new.content;
  elsif (new.content is null or new.content = '') and new.summary is not null then
    new.content := new.summary;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_summary_versions_sync
before insert or update on public.summary_versions
for each row execute function public.sync_summary_versions_fields();

create or replace function public.sync_action_items_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.task is null or new.task = '') and new.text is not null then
    new.task := new.text;
  elsif (new.text is null or new.text = '') and new.task is not null then
    new.text := new.task;
  end if;

  if new.due_date is not null and new.due_at is null then
    begin
      new.due_at := new.due_date::timestamptz;
    exception when others then
      null;
    end;
  elsif new.due_at is not null and new.due_date is null then
    new.due_date := new.due_at::text;
  end if;

  if new.done is true or new.is_completed is true or new.completed is true then
    new.completed := true;
    new.is_completed := true;
    new.done := true;
  else
    new.completed := false;
    new.is_completed := false;
    new.done := false;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_action_items_sync
before insert or update on public.action_items
for each row execute function public.sync_action_items_fields();

create or replace function public.sync_highlights_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.start_timestamp != 0 and (new.start_time = 0 or new.start_time is null) then
    new.start_time := new.start_timestamp;
  elsif new.start_time != 0 and (new.start_timestamp = 0 or new.start_timestamp is null) then
    new.start_timestamp := new.start_time;
  end if;

  if new.end_timestamp != 0 and (new.end_time = 0 or new.end_time is null) then
    new.end_time := new.end_timestamp;
  elsif new.end_time != 0 and (new.end_timestamp = 0 or new.end_timestamp is null) then
    new.end_timestamp := new.end_time;
  end if;

  if new.end_timestamp < new.start_timestamp then
    new.end_timestamp := new.start_timestamp;
  end if;

  if new.end_time < new.start_time then
    new.end_time := new.start_time;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_highlights_sync
before insert or update on public.highlights
for each row execute function public.sync_highlights_fields();

create or replace function public.sync_share_links_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      new.state := new.status;
    elsif new.state is distinct from old.state then
      new.status := new.state;
    elsif new.is_active is distinct from old.is_active then
      if new.is_active is true then
        new.status := 'active';
        new.state := 'active';
      else
        new.status := 'revoked';
        new.state := 'revoked';
      end if;
    end if;
  elsif new.state is not null and new.state != new.status then
    new.status := new.state;
  end if;

  if new.status = 'revoked' or new.state = 'revoked' or new.is_active is false then
    new.status := 'revoked';
    new.state := 'revoked';
    new.is_active := false;
    new.revoked_at := coalesce(new.revoked_at, now());
  else
    new.status := 'active';
    new.state := 'active';
    new.is_active := true;
    new.revoked_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_share_links_sync
before insert or update on public.share_links
for each row execute function public.sync_share_links_fields();

--------------------------------------------------------------------------------
-- PUBLIC SHARING HELPER (READ ONLY VIA VALID TOKEN)
--------------------------------------------------------------------------------

create or replace function public.get_shared_meeting(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'meeting', jsonb_build_object(
      'id', m.id,
      'title', m.title,
      'meeting_time', m.meeting_time,
      'duration', m.duration,
      'duration_seconds', m.duration_seconds,
      'participants', m.participants,
      'source', m.source,
      'status', m.status
    ),
    'summary', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'version', s.version,
        'summary', s.summary,
        'overview', s.overview
      )) from public.summary_versions s where s.meeting_id = m.id
    ), '[]'::jsonb),
    'action_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'task', a.task,
        'owner', a.owner,
        'due_date', a.due_date,
        'completed', a.completed
      )) from public.action_items a where a.meeting_id = m.id
    ), '[]'::jsonb),
    'highlights', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'title', h.title,
        'start_timestamp', h.start_timestamp,
        'end_timestamp', h.end_timestamp,
        'kind', h.kind
      ) order by h.start_timestamp) from public.highlights h where h.meeting_id = m.id
    ), '[]'::jsonb),
    'transcript', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'speaker', t.speaker,
        'speaker_initials', t.speaker_initials,
        'speaker_color', t.speaker_color,
        'text', t.text,
        'start_time', t.start_time,
        'end_time', t.end_time,
        'sequence', t.sequence
      ) order by t.sequence) from public.transcript_segments t where t.meeting_id = m.id
    ), '[]'::jsonb)
  ) into v_result
  from public.share_links sl
  join public.meetings m on m.id = sl.meeting_id
  where sl.token = p_token
    and sl.status = 'active'
    and sl.is_active = true;

  return v_result;
end;
$$;

revoke all on function public.get_shared_meeting(text) from public;
grant execute on function public.get_shared_meeting(text) to anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) & PRIVILEGES
--------------------------------------------------------------------------------

alter table public.meetings enable row level security;
alter table public.recordings enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.summary_versions enable row level security;
alter table public.action_items enable row level security;
alter table public.highlights enable row level security;
alter table public.share_links enable row level security;

-- Revoke broad defaults from anonymous/public roles
revoke all on table public.meetings from public, anon;
revoke all on table public.recordings from public, anon;
revoke all on table public.transcript_segments from public, anon;
revoke all on table public.summary_versions from public, anon;
revoke all on table public.action_items from public, anon;
revoke all on table public.highlights from public, anon;
revoke all on table public.share_links from public, anon;

-- Grant authenticated users access to owned rows and service_role full maintenance
grant select, insert, update, delete on table public.meetings to authenticated;
grant select, insert, update, delete on table public.recordings to authenticated;
grant select, insert, update, delete on table public.transcript_segments to authenticated;
grant select, insert, update, delete on table public.summary_versions to authenticated;
grant select, insert, update, delete on table public.action_items to authenticated;
grant select, insert, update, delete on table public.highlights to authenticated;
grant select, insert, update, delete on table public.share_links to authenticated;

grant all on table public.meetings to service_role;
grant all on table public.recordings to service_role;
grant all on table public.transcript_segments to service_role;
grant all on table public.summary_versions to service_role;
grant all on table public.action_items to service_role;
grant all on table public.highlights to service_role;
grant all on table public.share_links to service_role;

-- 1. MEETINGS POLICIES
create policy "Users can select meetings they own"
on public.meetings for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert meetings they own"
on public.meetings for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update meetings they own"
on public.meetings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete meetings they own"
on public.meetings for delete
to authenticated
using ((select auth.uid()) = user_id);

-- 2. RECORDINGS POLICIES
create policy "Users can select recordings for meetings they own"
on public.recordings for select
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = recordings.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can insert recordings for meetings they own"
on public.recordings for insert
to authenticated
with check (
  exists (
    select 1 from public.meetings m
    where m.id = recordings.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can update recordings for meetings they own"
on public.recordings for update
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = recordings.meeting_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.meetings m
    where m.id = recordings.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can delete recordings for meetings they own"
on public.recordings for delete
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = recordings.meeting_id
      and m.user_id = (select auth.uid())
  )
);

-- 3. TRANSCRIPT SEGMENTS POLICIES
create policy "Users can select transcript segments for meetings they own"
on public.transcript_segments for select
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = transcript_segments.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can insert transcript segments for meetings they own"
on public.transcript_segments for insert
to authenticated
with check (
  exists (
    select 1 from public.meetings m
    where m.id = transcript_segments.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can update transcript segments for meetings they own"
on public.transcript_segments for update
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = transcript_segments.meeting_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.meetings m
    where m.id = transcript_segments.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can delete transcript segments for meetings they own"
on public.transcript_segments for delete
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = transcript_segments.meeting_id
      and m.user_id = (select auth.uid())
  )
);

-- 4. SUMMARY VERSIONS POLICIES
create policy "Users can select summary versions for meetings they own"
on public.summary_versions for select
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = summary_versions.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can insert summary versions for meetings they own"
on public.summary_versions for insert
to authenticated
with check (
  exists (
    select 1 from public.meetings m
    where m.id = summary_versions.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can update summary versions for meetings they own"
on public.summary_versions for update
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = summary_versions.meeting_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.meetings m
    where m.id = summary_versions.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can delete summary versions for meetings they own"
on public.summary_versions for delete
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = summary_versions.meeting_id
      and m.user_id = (select auth.uid())
  )
);

-- 5. ACTION ITEMS POLICIES
create policy "Users can select action items for meetings they own"
on public.action_items for select
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = action_items.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can insert action items for meetings they own"
on public.action_items for insert
to authenticated
with check (
  exists (
    select 1 from public.meetings m
    where m.id = action_items.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can update action items for meetings they own"
on public.action_items for update
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = action_items.meeting_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.meetings m
    where m.id = action_items.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can delete action items for meetings they own"
on public.action_items for delete
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = action_items.meeting_id
      and m.user_id = (select auth.uid())
  )
);

-- 6. HIGHLIGHTS POLICIES
create policy "Users can select highlights for meetings they own"
on public.highlights for select
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = highlights.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can insert highlights for meetings they own"
on public.highlights for insert
to authenticated
with check (
  exists (
    select 1 from public.meetings m
    where m.id = highlights.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can update highlights for meetings they own"
on public.highlights for update
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = highlights.meeting_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.meetings m
    where m.id = highlights.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can delete highlights for meetings they own"
on public.highlights for delete
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = highlights.meeting_id
      and m.user_id = (select auth.uid())
  )
);

-- 7. SHARE LINKS POLICIES
create policy "Users can select share links for meetings they own"
on public.share_links for select
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = share_links.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can insert share links for meetings they own"
on public.share_links for insert
to authenticated
with check (
  exists (
    select 1 from public.meetings m
    where m.id = share_links.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can update share links for meetings they own"
on public.share_links for update
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = share_links.meeting_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.meetings m
    where m.id = share_links.meeting_id
      and m.user_id = (select auth.uid())
  )
);

create policy "Users can delete share links for meetings they own"
on public.share_links for delete
to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = share_links.meeting_id
      and m.user_id = (select auth.uid())
  )
);

commit;
