-- AI food estimates: shared cache of identical queries + separate daily counter.
create table if not exists public.food_cache (
  q text primary key,              -- normalized query text
  items jsonb not null,
  model text,
  hits int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.food_cache enable row level security;  -- no policies: service role only

alter table public.ai_usage add column if not exists food_msgs int not null default 0;

create or replace function public.ai_food_take(p_user uuid, p_limit int)
returns table(allowed boolean, used int)
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Kyiv')::date; n int;
begin
  insert into public.ai_usage(user_id, day) values (p_user, d) on conflict (user_id, day) do nothing;
  update public.ai_usage set food_msgs = food_msgs + 1
    where user_id = p_user and day = d and (p_limit <= 0 or food_msgs < p_limit)
    returning food_msgs into n;
  if n is null then
    return query select false, (select food_msgs from public.ai_usage where user_id = p_user and day = d);
  else
    return query select true, n;
  end if;
end $$;
revoke all on function public.ai_food_take(uuid, int) from public, anon, authenticated;
grant execute on function public.ai_food_take(uuid, int) to service_role;
