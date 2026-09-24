-- Let completed users manage Calendar from Settings and save the connected account label.
begin;

alter table public.calendar_connections
  add column account_email text
  constraint calendar_account_email_length check (account_email is null or char_length(account_email) <= 320);

-- Replace the four-argument service-role RPC with an atomic connection update.
drop function public.record_calendar_outcome(uuid, text, text, text);

create function public.record_calendar_outcome(
  p_user_id uuid,
  p_status text,
  p_refresh_token_ciphertext text default null,
  p_scope text default null,
  p_account_email text default null
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
    insert into public.calendar_connections (user_id, refresh_token_ciphertext, scope, account_email)
    values (p_user_id, p_refresh_token_ciphertext, p_scope, p_account_email)
    on conflict (user_id) do update
    set refresh_token_ciphertext = excluded.refresh_token_ciphertext,
        scope = excluded.scope,
        account_email = excluded.account_email,
        connected_at = now(),
        updated_at = now();
  else
    delete from public.calendar_connections where user_id = p_user_id;
  end if;

  update public.profiles
  set calendar_connected = (p_status = 'connected'),
      calendar_status = p_status,
      onboarding_step = case when onboarding_completed then onboarding_step else greatest(onboarding_step, 1) end
  where id = p_user_id;
  if not found then
    raise exception 'Profile required';
  end if;
end;
$$;

revoke all on function public.record_calendar_outcome(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_calendar_outcome(uuid, text, text, text, text) to service_role;

commit;