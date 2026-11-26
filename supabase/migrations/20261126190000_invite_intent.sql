-- Invite-by-link: optional sections (and coach role) chosen by the admin are stored on the
-- pending profile and applied automatically when the admin approves the person.
-- Pending users still cannot change these fields or approve themselves.

alter table public.profiles
  add column if not exists invite_member text[] not null default '{}',
  add column if not exists invite_coach  text[] not null default '{}';

create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_coach() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.paused := false; new.paused_note := ''; new.paused_at := null;
      new.invite_member := '{}'; new.invite_coach := '{}';
      new.group_name := case when coalesce(new.age, 30) < 18 then 'Діти' else 'Новачки' end;
    else
      new.status := old.status;
      new.paused := old.paused; new.paused_note := old.paused_note; new.paused_at := old.paused_at;
      new.invite_member := old.invite_member; new.invite_coach := old.invite_coach;
      if not old.onboarded then
        new.group_name := case when coalesce(new.age, 30) < 18 then 'Діти' else old.group_name end;
      else
        new.group_name := old.group_name;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

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
  end if;
  return new;
end $$;
revoke all on function private.apply_invite_on_approve() from public, anon, authenticated;
drop trigger if exists profiles_apply_invite on public.profiles;
create trigger profiles_apply_invite after update of status on public.profiles
  for each row execute function private.apply_invite_on_approve();
