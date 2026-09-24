-- Create profiles lazily at the first authenticated workspace request.
-- Trial dates come from auth.users.created_at, so a delayed first login does not restart the trial.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free',
  credits_balance integer not null default 50 check (credits_balance >= 0),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Revoke broad defaults before granting only the operations users need.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (onboarding_completed) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Only this function can insert a profile. It takes no user ID or mutable defaults.
create function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  signup_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if exists (select 1 from public.profiles where id = current_user_id) then
    return;
  end if;

  select users.created_at into signup_at
  from auth.users as users
  where users.id = current_user_id;

  if signup_at is null then
    raise exception 'Authenticated user not found' using errcode = '28000';
  end if;

  insert into public.profiles (id, trial_started_at, trial_ends_at)
  values (current_user_id, signup_at, signup_at + interval '14 days')
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_profile() from public, anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;
