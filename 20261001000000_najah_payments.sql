-- Najah: subscriptions & payments
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  status text not null default 'none' check (status in ('none','active','grace','canceled','expired')),
  provider text,
  provider_ref text,
  current_period_end timestamptz,
  grace_used_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('chargily','ccp','baridimob','paypal','card','play')),
  amount integer not null,
  currency text not null default 'DZD',
  reference text,
  note_code text,
  receipt_path text,
  status text not null default 'pending' check (status in ('pending','paid','approved','rejected','failed')),
  raw jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
-- the same transaction number / order id can never be used twice
create unique index if not exists payments_provider_reference_uniq on public.payments (provider, reference) where reference is not null;
create index if not exists payments_status_idx on public.payments (status, created_at);

alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments for select to authenticated using ((select auth.uid()) = user_id);
-- no insert/update policies: only Edge Functions (service role) write these tables

-- private bucket for transfer receipts; each user can only write/read inside their own folder
insert into storage.buckets (id, name, public) values ('receipts','receipts', false) on conflict (id) do nothing;
drop policy if exists "upload own receipt" on storage.objects;
create policy "upload own receipt" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "read own receipt" on storage.objects;
create policy "read own receipt" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- +N days of Plus. Extends from the current end if already active, otherwise from now (grace time is not counted).
create or replace function public.grant_plus(p_user uuid, p_days int, p_provider text, p_ref text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_end timestamptz;
begin
  insert into subscriptions as s (user_id, status, provider, provider_ref, current_period_end, updated_at)
  values (p_user, 'active', p_provider, p_ref, now() + make_interval(days => p_days), now())
  on conflict (user_id) do update set
    status = 'active',
    provider = excluded.provider,
    provider_ref = coalesce(excluded.provider_ref, s.provider_ref),
    current_period_end = (case when s.status in ('active','canceled') and s.current_period_end > now()
                               then s.current_period_end else now() end) + make_interval(days => p_days),
    updated_at = now()
  returning current_period_end into v_end;
  return v_end;
end $$;

-- exact end date (Google Play tells us the real expiry)
create or replace function public.set_plus_until(p_user uuid, p_until timestamptz, p_provider text, p_ref text, p_status text default 'active')
returns void language sql security definer set search_path = public as $$
  insert into subscriptions (user_id, status, provider, provider_ref, current_period_end, updated_at)
  values (p_user, p_status, p_provider, p_ref, p_until, now())
  on conflict (user_id) do update set status = excluded.status, provider = excluded.provider,
    provider_ref = excluded.provider_ref, current_period_end = excluded.current_period_end, updated_at = now();
$$;

revoke execute on function public.grant_plus(uuid,int,text,text) from public, anon, authenticated;
revoke execute on function public.set_plus_until(uuid,timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.grant_plus(uuid,int,text,text) to service_role;
grant execute on function public.set_plus_until(uuid,timestamptz,text,text,text) to service_role;
