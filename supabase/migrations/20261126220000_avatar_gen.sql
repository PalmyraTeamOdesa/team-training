-- AI avatar generations: 5 per user per rolling 7 days, enforced in avatar_gen_take (called by the avatar-gen edge function)
create table if not exists public.avatar_gens (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('generate','edit')),
  prompt text not null default '',
  status text not null default 'pending' check (status in ('pending','ok','failed')),
  model text,
  cost_usd numeric(6,3),
  created_at timestamptz not null default now()
);
create index if not exists avatar_gens_user_idx on public.avatar_gens (user_id, created_at desc);
alter table public.avatar_gens enable row level security;
create policy blocked_deny on public.avatar_gens as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
create policy ag_select on public.avatar_gens for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_coach()));
-- no insert/update/delete policies: only the service role (edge function) writes

create or replace function public.avatar_gen_take(p_user uuid, p_mode text, p_prompt text, p_limit int default 5)
returns table (allowed boolean, used int, gen_id bigint)
language plpgsql security definer set search_path = '' as $$
declare n int; gid bigint;
begin
  perform pg_advisory_xact_lock(hashtext('avatar_gen:' || p_user::text));
  select count(*) into n from public.avatar_gens
   where user_id = p_user and status <> 'failed' and created_at > now() - interval '7 days';
  if n >= p_limit then return query select false, n, null::bigint; return; end if;
  -- failed attempts are free for the user but capped too (xAI may still bill moderated requests)
  if (select count(*) from public.avatar_gens where user_id = p_user and created_at > now() - interval '7 days') >= p_limit * 2 then
    return query select false, n, null::bigint; return;
  end if;
  insert into public.avatar_gens (user_id, mode, prompt) values (p_user, p_mode, left(coalesce(p_prompt,''), 500)) returning id into gid;
  return query select true, n + 1, gid;
end $$;
revoke all on function public.avatar_gen_take(uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.avatar_gen_take(uuid, text, text, int) to service_role;

create or replace function public.avatar_gen_left()
returns int language sql stable security definer set search_path = '' as $$
  select greatest(0, 5 - (select count(*)::int from public.avatar_gens
    where user_id = (select auth.uid()) and status <> 'failed' and created_at > now() - interval '7 days'));
$$;
revoke all on function public.avatar_gen_left() from public, anon;
grant execute on function public.avatar_gen_left() to authenticated;
