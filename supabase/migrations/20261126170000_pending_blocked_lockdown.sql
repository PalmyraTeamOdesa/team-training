-- Pending (not yet approved) and blocked (expelled) accounts must see nothing but their own pending/blocked status.
create or replace function private.is_blocked() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'blocked')
     and not exists (select 1 from public.coaches c where c.user_id = (select auth.uid()));
$$;
grant execute on function private.is_blocked() to authenticated;

-- blocked accounts: restrictive deny on every public table (ANDed with all permissive policies),
-- except SELECT of their own profile row so the app can tell them access is closed
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'profiles' loop
    execute format('drop policy if exists blocked_deny on public.%I', t);
    execute format('create policy blocked_deny on public.%I as restrictive for all to authenticated using (not (select private.is_blocked())) with check (not (select private.is_blocked()))', t);
  end loop;
end $$;
drop policy if exists blocked_deny_ins on public.profiles; drop policy if exists blocked_deny_upd on public.profiles; drop policy if exists blocked_deny_del on public.profiles;
create policy blocked_deny_upd on public.profiles as restrictive for update to authenticated using (not (select private.is_blocked())) with check (not (select private.is_blocked()));
create policy blocked_deny_del on public.profiles as restrictive for delete to authenticated using (not (select private.is_blocked()));

-- storage: blocked cannot read or write files either
drop policy if exists blocked_deny_storage on storage.objects;
create policy blocked_deny_storage on storage.objects as restrictive for all to authenticated
  using (not (select private.is_blocked())) with check (not (select private.is_blocked()));

-- section names are only for members
drop policy sections_select on public.sections;
create policy sections_select on public.sections for select to authenticated using ((select private.is_member()));
