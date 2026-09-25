-- Migration: Add credit_transactions table and media processing credit deduction logic
-- Rules:
-- 1 started minute = 1 credit: credits_required = ceil(duration_seconds / 60)
-- Before processing starts, check user has enough credits and block if insufficient.
-- If processing completes successfully, deduct credits once.
-- Failed processing must deduct 0 credits.
-- Unique credit_transactions record per processed meeting so retries, duplicate webhooks, or refreshes can never charge twice.

begin;

-- 1. Create credit_transactions table
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  recording_id uuid references public.recordings (id) on delete set null,
  amount integer not null check (amount >= 0),
  credits_deducted integer not null default 0 check (credits_deducted >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  type text not null default 'media_processing' check (type in ('media_processing', 'refund', 'bonus', 'purchase')),
  status text not null default 'completed' check (status in ('completed', 'pending', 'failed', 'refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credit_transactions_meeting_id_unique unique (meeting_id)
);

comment on table public.credit_transactions is 'Records of credit deductions for media processing, guaranteeing idempotency per meeting.';

-- 2. Indexes for fast lookup by user and meeting
create index if not exists idx_credit_transactions_user_id on public.credit_transactions (user_id);
create index if not exists idx_credit_transactions_meeting_id on public.credit_transactions (meeting_id);
create index if not exists idx_credit_transactions_created_at on public.credit_transactions (created_at desc);

-- 3. Row Level Security
alter table public.credit_transactions enable row level security;

revoke all on table public.credit_transactions from public, anon, authenticated;
grant select on table public.credit_transactions to authenticated;
grant all on table public.credit_transactions to service_role;

drop policy if exists "Users can read their own credit transactions" on public.credit_transactions;
create policy "Users can read their own credit transactions"
on public.credit_transactions for select
to authenticated
using ((select auth.uid()) = user_id);

-- 4. Atomic credit deduction function
create or replace function public.deduct_media_processing_credits(
  p_user_id uuid,
  p_meeting_id uuid,
  p_duration_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credits_required integer;
  v_existing_tx record;
  v_current_balance integer;
  v_new_balance integer;
  v_new_tx_id uuid;
begin
  -- 1. Idempotency check: Has this meeting already been charged?
  select id, amount, credits_deducted into v_existing_tx
  from public.credit_transactions
  where meeting_id = p_meeting_id
  limit 1;

  if v_existing_tx.id is not null then
    select credits_balance into v_current_balance
    from public.profiles
    where id = p_user_id;

    return jsonb_build_object(
      'success', true,
      'already_charged', true,
      'credits_deducted', 0,
      'balance', coalesce(v_current_balance, 0),
      'transaction_id', v_existing_tx.id
    );
  end if;

  -- 2. Calculate required credits: 1 started minute = 1 credit -> ceil(duration_seconds / 60)
  v_credits_required := greatest(1, ceil(coalesce(p_duration_seconds, 0)::numeric / 60.0)::integer);

  -- 3. Lock profile row and check balance
  select credits_balance into v_current_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_current_balance is null then
    return jsonb_build_object(
      'success', false,
      'already_charged', false,
      'credits_deducted', 0,
      'error', 'Profile not found'
    );
  end if;

  if v_current_balance < v_credits_required then
    return jsonb_build_object(
      'success', false,
      'already_charged', false,
      'credits_deducted', 0,
      'error', 'Insufficient credits',
      'credits_required', v_credits_required,
      'balance', v_current_balance
    );
  end if;

  -- 4. Deduct credits from user's balance
  v_new_balance := v_current_balance - v_credits_required;
  update public.profiles
  set credits_balance = v_new_balance
  where id = p_user_id;

  -- 5. Insert unique transaction record
  insert into public.credit_transactions (
    user_id,
    meeting_id,
    amount,
    credits_deducted,
    duration_seconds,
    type,
    status
  ) values (
    p_user_id,
    p_meeting_id,
    v_credits_required,
    v_credits_required,
    coalesce(p_duration_seconds, 0),
    'media_processing',
    'completed'
  )
  returning id into v_new_tx_id;

  return jsonb_build_object(
    'success', true,
    'already_charged', false,
    'credits_deducted', v_credits_required,
    'balance', v_new_balance,
    'transaction_id', v_new_tx_id
  );
exception
  when unique_violation then
    -- Concurrent attempt already charged this meeting
    select credits_balance into v_current_balance
    from public.profiles
    where id = p_user_id;

    return jsonb_build_object(
      'success', true,
      'already_charged', true,
      'credits_deducted', 0,
      'balance', coalesce(v_current_balance, 0)
    );
end;
$$;

revoke all on function public.deduct_media_processing_credits(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.deduct_media_processing_credits(uuid, uuid, integer) to service_role;

commit;
