-- Persist onboarding choices and the outcome of the separate Calendar consent flow.
alter table public.profiles
  add column calendar_connected boolean not null default false,
  add column calendar_status text not null default 'pending' check (calendar_status in ('pending', 'connected', 'skipped', 'denied')),
  add column onboarding_step smallint not null default 0 check (onboarding_step between 0 and 5),
  add column usage_type text check (usage_type in ('individual', 'team')),
  add column meeting_preference text check (meeting_preference in ('manual', 'automatic')),
  add column sharing_preference text check (sharing_preference in ('private', 'team')),
  add column job_function text check (job_function in ('engineering', 'product', 'sales', 'customer-success', 'operations', 'other')),
  add constraint calendar_status_matches_connection check ((calendar_status = 'connected') = calendar_connected);

-- Existing completed accounts stay completed after the new progress column is added.
update public.profiles set onboarding_step = 5 where onboarding_completed;
alter table public.profiles add constraint completed_requires_saved_steps check (not onboarding_completed or onboarding_step = 5);

-- Refresh tokens are encrypted by the server before storage. This table is never
-- readable or writable with a user's Supabase session.
create table public.calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token_ciphertext text not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_connections enable row level security;
revoke all on table public.calendar_connections from public, anon, authenticated;
grant all on table public.calendar_connections to service_role;

-- Keep the token row and visible profile status in the same transaction.
-- Only a verified server call with the service role may invoke this function.
create function public.record_calendar_outcome(
  p_user_id uuid,
  p_status text,
  p_refresh_token_ciphertext text default null,
  p_scope text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_status not in ('connected', 'skipped', 'denied') then
    raise exception 'Invalid Calendar outcome';
  end if;

  if p_status = 'connected' then
    if nullif(p_refresh_token_ciphertext, '') is null or nullif(p_scope, '') is null then
      raise exception 'Calendar credential required';
    end if;
    insert into public.calendar_connections (user_id, refresh_token_ciphertext, scope)
    values (p_user_id, p_refresh_token_ciphertext, p_scope)
    on conflict (user_id) do update
    set refresh_token_ciphertext = excluded.refresh_token_ciphertext,
        scope = excluded.scope,
        connected_at = now(),
        updated_at = now();
  else
    delete from public.calendar_connections where user_id = p_user_id;
  end if;

  update public.profiles
  set calendar_connected = (p_status = 'connected'),
      calendar_status = p_status,
      onboarding_step = greatest(onboarding_step, 1)
  where id = p_user_id and onboarding_completed = false;
  if not found then
    raise exception 'Incomplete profile required';
  end if;
end;
$$;

revoke all on function public.record_calendar_outcome(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_calendar_outcome(uuid, text, text, text) to service_role;
