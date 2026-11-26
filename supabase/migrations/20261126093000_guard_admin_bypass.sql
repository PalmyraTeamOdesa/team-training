-- allow server-side/admin SQL (no end-user JWT) to manage status/group; end users still cannot
create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_coach() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.group_name := case when coalesce(new.age, 30) < 18 then 'Діти' else 'Новачки' end;
    else
      new.status := old.status;
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
