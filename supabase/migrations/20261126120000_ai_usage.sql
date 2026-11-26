-- AI assistant: per-user daily usage counters + server-side secret access (Vault).
create extension if not exists supabase_vault;

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  msgs int not null default 0,
  tokens int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- read: own row or coach; no write policies (service role only, via functions below)
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_coach()));
grant select on public.ai_usage to authenticated;

-- Atomically count one message for today (Europe/Kyiv); refuse past the limit.
create or replace function public.ai_usage_take(p_user uuid, p_limit int)
returns table(allowed boolean, used int)
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Kyiv')::date; n int;
begin
  insert into public.ai_usage(user_id, day, msgs) values (p_user, d, 0)
    on conflict (user_id, day) do nothing;
  update public.ai_usage set msgs = msgs + 1
    where user_id = p_user and day = d and (p_limit <= 0 or msgs < p_limit)
    returning msgs into n;
  if n is null then
    return query select false, (select msgs from public.ai_usage where user_id = p_user and day = d);
  else
    return query select true, n;
  end if;
end $$;

create or replace function public.ai_usage_add_tokens(p_user uuid, p_tokens int)
returns void language sql security definer set search_path = '' as $$
  update public.ai_usage set tokens = tokens + greatest(p_tokens, 0)
  where user_id = p_user and day = (now() at time zone 'Europe/Kyiv')::date;
$$;

-- Read a Vault secret by name (service role only).
create or replace function public.get_app_secret(p_name text)
returns text language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

revoke all on function public.ai_usage_take(uuid, int) from public, anon, authenticated;
revoke all on function public.ai_usage_add_tokens(uuid, int) from public, anon, authenticated;
revoke all on function public.get_app_secret(text) from public, anon, authenticated;
grant execute on function public.ai_usage_take(uuid, int) to service_role;
grant execute on function public.ai_usage_add_tokens(uuid, int) to service_role;
grant execute on function public.get_app_secret(text) to service_role;
