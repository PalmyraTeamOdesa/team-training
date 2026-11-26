-- Auto-join from questionnaire sports, self-join/leave as athlete, apply sports on approval/onboarding.

create or replace function private.sports_sections(q jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array(
    select s from unnest(array['bike','swim','run']) as s
    where coalesce((q -> 'sports' -> s ->> 'on') in ('true','t','1'), false)
  ), '{}');
$$;
revoke all on function private.sports_sections(jsonb) from public, anon, authenticated;

create or replace function private.apply_sports_membership(uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare q jsonb;
begin
  select p.q into q from public.profiles p where p.id = uid;
  insert into public.section_members (section_id, athlete_id)
    select s.id, uid from public.sections s
    where s.id = any (private.sports_sections(q))
    on conflict do nothing;
end $$;
revoke all on function private.apply_sports_membership(uuid) from public, anon, authenticated;

-- on approval: invite presets + sports from the questionnaire (add only)
create or replace function private.apply_invite_on_approve()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    insert into public.section_members (section_id, athlete_id)
      select s.id, new.id from public.sections s
      where s.id = any (coalesce(new.invite_member, '{}'))
      on conflict do nothing;
    insert into public.section_coaches (section_id, user_id)
      select s.id, new.id from public.sections s
      where s.id = any (coalesce(new.invite_coach, '{}'))
      on conflict do nothing;
    perform private.apply_sports_membership(new.id);
  end if;
  return new;
end $$;

-- already-approved athlete finishes onboarding later: add (never remove)
create or replace function private.apply_sports_on_onboard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and new.onboarded is true and old.onboarded is distinct from true then
    perform private.apply_sports_membership(new.id);
  end if;
  return new;
end $$;
revoke all on function private.apply_sports_on_onboard() from public, anon, authenticated;
drop trigger if exists profiles_apply_sports_onboard on public.profiles;
create trigger profiles_apply_sports_onboard after update of onboarded, q on public.profiles
  for each row execute function private.apply_sports_on_onboard();

-- backfill existing active members (add only)
select private.apply_sports_membership(p.id) from public.profiles p where p.status = 'active';

-- self-join / leave as athlete (active club members only)
create or replace function public.join_section(sec text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member() then
    raise exception 'Лише учасник команди може записатися' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sections s where s.id = sec) then
    raise exception 'Немає такої секції' using errcode = '22023';
  end if;
  insert into public.section_members (section_id, athlete_id)
    values (sec, (select auth.uid()))
    on conflict do nothing;
end $$;

create or replace function public.leave_section(sec text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  delete from public.section_members
    where athlete_id = (select auth.uid()) and section_id = sec;
end $$;

revoke all on function public.join_section(text) from public, anon;
revoke all on function public.leave_section(text) from public, anon;
grant execute on function public.join_section(text) to authenticated;
grant execute on function public.leave_section(text) to authenticated;

-- RLS backup: active member may insert/delete only their own athlete row
drop policy if exists sm_self_ins on public.section_members;
create policy sm_self_ins on public.section_members for insert to authenticated
  with check (athlete_id = (select auth.uid())
    and (select private.is_member())
    and not (select private.is_locked()));
drop policy if exists sm_self_del on public.section_members;
create policy sm_self_del on public.section_members for delete to authenticated
  using (athlete_id = (select auth.uid())
    and (select private.is_member()));
