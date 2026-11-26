-- Strict lockdown: anyone who is not an active member (pending, blocked/expelled, profile missing)
-- and not the admin can read/write NOTHING except their own profile row (needed for the onboarding form and the status screen).

create or replace function private.is_locked()
returns boolean language sql stable security definer set search_path = '' as $$
  select not (
    exists (select 1 from public.coaches c where c.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active')
  );
$$;
revoke all on function private.is_locked() from public, anon;
grant execute on function private.is_locked() to authenticated;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where policyname in ('blocked_deny', 'blocked_deny_storage')
  loop
    execute format('alter policy %I on %I.%I using (not (select private.is_locked())) with check (not (select private.is_locked()))',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- the team directory (incl. the admin row) is for members only
create or replace function public.team_members()
returns table(id uuid, full_name text, group_name text, is_kid boolean, is_coach boolean, avatar_path text, hide_numbers boolean, paused boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.group_name, coalesce(p.age, 30) < 18,
         exists (select 1 from public.coaches c where c.user_id = p.id),
         p.avatar_path, p.hide_numbers, p.paused
  from public.profiles p
  where private.is_member()
    and (p.status = 'active' or exists (select 1 from public.coaches c where c.user_id = p.id));
$$;

-- first weight entry is created on approval (pending users cannot write to `weights`)
create or replace function private.seed_weight_on_approve()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' and new.weight_kg is not null then
    insert into public.weights (athlete_id, day, kg)
    values (new.id, (now() at time zone 'Europe/Kiev')::date, new.weight_kg)
    on conflict (athlete_id, day) do nothing;
  end if;
  return new;
end $$;
revoke all on function private.seed_weight_on_approve() from public, anon, authenticated;
drop trigger if exists profiles_seed_weight on public.profiles;
create trigger profiles_seed_weight after update of status on public.profiles
  for each row execute function private.seed_weight_on_approve();
