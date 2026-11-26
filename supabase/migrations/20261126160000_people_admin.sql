-- People admin: pause, expel, role RPCs, rewards (points / prizes / achievements) and admin = athlete = coach.

-- ---------- pause (reversible, admin only) ----------
alter table public.profiles add column if not exists paused boolean not null default false;
alter table public.profiles add column if not exists paused_note text not null default '' check (length(paused_note) <= 200);
alter table public.profiles add column if not exists paused_at timestamptz;

create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_coach() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.paused := false; new.paused_note := ''; new.paused_at := null;
      new.group_name := case when coalesce(new.age, 30) < 18 then 'Діти' else 'Новачки' end;
    else
      new.status := old.status;
      new.paused := old.paused; new.paused_note := old.paused_note; new.paused_at := old.paused_at;
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

create or replace function private.is_paused(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.paused from public.profiles p where p.id = a), false);
$$;
grant execute on function private.is_paused(uuid) to authenticated;

-- paused people are hidden from boards: no new lines for them, they cannot mark
drop policy bl_write on public.board_lines;
create policy bl_write on public.board_lines for all to authenticated
  using ((select private.can_coach_section(private.post_section(post_id))))
  with check ((select private.can_coach_section(private.post_section(post_id)))
    and not (select private.is_paused(athlete_id))
    and exists (select 1 from public.section_members m where m.athlete_id = board_lines.athlete_id and m.section_id = private.post_section(post_id)));
drop policy bm_own on public.board_marks;
create policy bm_own on public.board_marks for insert to authenticated
  with check (athlete_id = (select auth.uid()) and not (select private.is_paused(athlete_id))
    and (select private.in_section(private.post_section(post_id))));
drop policy bm_own_upd on public.board_marks;
create policy bm_own_upd on public.board_marks for update to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()) and not (select private.is_paused(athlete_id))
    and (select private.in_section(private.post_section(post_id))));

-- ---------- admin-only role / pause / expel RPCs ----------
create or replace function public.admin_set_roles(uid uuid, coach_sections text[], member_sections text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_coach() then raise exception 'Лише адміністратор' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = uid and p.status = 'active') then
    raise exception 'Акаунт не активний' using errcode = '22023'; end if;
  coach_sections := coalesce(coach_sections, '{}'); member_sections := coalesce(member_sections, '{}');
  delete from public.section_coaches where user_id = uid and not (section_id = any (coach_sections));
  insert into public.section_coaches (section_id, user_id)
    select s.id, uid from public.sections s where s.id = any (coach_sections) on conflict do nothing;
  delete from public.section_members where athlete_id = uid and not (section_id = any (member_sections));
  insert into public.section_members (section_id, athlete_id)
    select s.id, uid from public.sections s where s.id = any (member_sections) on conflict do nothing;
end $$;

create or replace function public.admin_set_paused(uid uuid, p boolean, note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_coach() then raise exception 'Лише адміністратор' using errcode = '42501'; end if;
  update public.profiles set paused = p, paused_note = case when p then left(coalesce(note, ''), 200) else '' end,
    paused_at = case when p then now() else null end where id = uid;
  if p and uid <> (select auth.uid()) then
    perform private.notify(uid, 'pause', 'Ви на паузі', coalesce(nullif(note, ''), 'Тренер тимчасово прибрав вас з дощок і рейтингів. Це можна скасувати.'));
  elsif not p and uid <> (select auth.uid()) then
    perform private.notify(uid, 'pause', 'Пауза завершена', 'Ви знову на дошках і в рейтингах.');
  end if;
end $$;

-- expel keeps all history (logs, marks, points, awards); removes section roles and blocks access
create or replace function public.admin_expel(uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_coach() then raise exception 'Лише адміністратор' using errcode = '42501'; end if;
  if exists (select 1 from public.coaches c where c.user_id = uid) then raise exception 'Адміністратора виключити не можна' using errcode = '22023'; end if;
  delete from public.section_coaches where user_id = uid;
  delete from public.section_members where athlete_id = uid;
  update public.profiles set status = 'blocked', paused = false, paused_note = '', paused_at = null where id = uid;
end $$;

create or replace function public.admin_restore(uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_coach() then raise exception 'Лише адміністратор' using errcode = '42501'; end if;
  update public.profiles set status = 'active' where id = uid and status = 'blocked';
end $$;
revoke execute on function public.admin_set_roles(uuid, text[], text[]), public.admin_set_paused(uuid, boolean, text),
  public.admin_expel(uuid), public.admin_restore(uuid) from public, anon;
grant execute on function public.admin_set_roles(uuid, text[], text[]), public.admin_set_paused(uuid, boolean, text),
  public.admin_expel(uuid), public.admin_restore(uuid) to authenticated;

-- ---------- rewards ----------
alter table public.awards add column if not exists kind text not null default 'achievement' check (kind in ('achievement','prize'));
-- nobody rewards himself (admin included)
drop policy awards_coach on public.awards;
create policy awards_coach on public.awards for all to authenticated
  using ((select private.is_coach()))
  with check ((select private.is_coach()) and athlete_id <> (select auth.uid()));
drop policy awards_section_coach_ins on public.awards;
create policy awards_section_coach_ins on public.awards for insert to authenticated
  with check (section_id is not null and (select private.is_section_coach(section_id)) and athlete_id <> (select auth.uid())
    and exists (select 1 from public.section_members m where m.athlete_id = awards.athlete_id and m.section_id = awards.section_id));

create or replace function private.on_award() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.athlete_id, 'award',
    (case when new.kind = 'prize' then 'Приз від тренера: ' else 'Нове досягнення від тренера: ' end) || new.name, new.description);
  return new;
end $$;

-- points: comments up to 200 chars; club-level points (section_id null) are admin-only
alter table public.board_points alter column section_id drop not null;
alter table public.board_points drop constraint if exists board_points_reaction_check;
alter table public.board_points add constraint board_points_reaction_check check (length(reaction) <= 200);
drop policy bpt_ins on public.board_points;
create policy bpt_ins on public.board_points for insert to authenticated
  with check (section_id is not null and coach_id = (select auth.uid()) and athlete_id <> (select auth.uid())
    and (select private.can_coach_section(section_id))
    and exists (select 1 from public.section_members m where m.athlete_id = board_points.athlete_id and m.section_id = board_points.section_id));
create policy bpt_ins_club on public.board_points for insert to authenticated
  with check (section_id is null and coach_id = (select auth.uid()) and athlete_id <> (select auth.uid()) and (select private.is_coach())
    and exists (select 1 from public.profiles p where p.id = board_points.athlete_id and p.status = 'active'));
create policy bpt_select_own on public.board_points for select to authenticated using (athlete_id = (select auth.uid()));

create or replace function private.on_board_points() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.athlete_id, 'points',
    (case when new.points <> 0 then '+' || new.points || ' балів' else '' end) ||
    (case when new.points <> 0 and new.reaction <> '' then ' · ' else '' end) || left(new.reaction, 120),
    coalesce((select name from public.sections where id = new.section_id), 'Клуб'));
  return new;
end $$;

-- do not notify a person about a board line he wrote himself (admin = athlete = coach)
create or replace function private.on_board_line() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  if new.athlete_id is not distinct from (select auth.uid()) then return new; end if;
  select bp.day, sec.name into s from public.board_posts bp join public.sections sec on sec.id = bp.section_id where bp.id = new.post_id;
  if tg_op = 'INSERT' or new.text is distinct from old.text then
    perform private.notify(new.athlete_id, 'board',
      s.name || ' · ' || to_char(s.day, 'DD.MM') || (case when tg_op = 'UPDATE' then ' (оновлено)' else '' end),
      left(new.text, 200));
  end if;
  return new;
end $$;

-- ---------- ratings: skip paused; admin counts when he is a section member ----------
create or replace function public.section_rating(sec text, ws date)
returns table (athlete_id uuid, full_name text, points bigint, assigned bigint, done bigint, pct int)
language sql stable security definer set search_path = '' as $$
  with mem as (select m.athlete_id from public.section_members m join public.profiles q on q.id = m.athlete_id
               where m.section_id = sec and not q.paused and q.status = 'active'),
  lines as (select l.athlete_id, l.post_id from public.board_lines l join public.board_posts p on p.id = l.post_id
            where p.section_id = sec and p.day >= ws and p.day < ws + 7 and p.day <= (now() at time zone 'Europe/Kyiv')::date),
  marks as (select k.athlete_id, k.post_id, k.status from public.board_marks k join public.board_posts p on p.id = k.post_id
            where p.section_id = sec and p.day >= ws and p.day < ws + 7),
  pts as (select b.athlete_id, sum(b.points) s from public.board_points b
          where b.section_id = sec and b.created_at >= ws and b.created_at < ws + 7 group by b.athlete_id)
  select mem.athlete_id, pr.full_name,
    coalesce(pts.s, 0)::bigint,
    (select count(*) from lines l where l.athlete_id = mem.athlete_id),
    (select count(*) from marks k where k.athlete_id = mem.athlete_id and k.status in ('done','alt')),
    case when (select count(*) from lines l where l.athlete_id = mem.athlete_id) = 0 then 0
      else least(100, round(100.0 * (select count(*) from marks k where k.athlete_id = mem.athlete_id and k.status in ('done','alt'))
           / (select count(*) from lines l where l.athlete_id = mem.athlete_id)))::int end
  from mem join public.profiles pr on pr.id = mem.athlete_id
  left join pts on pts.athlete_id = mem.athlete_id
  where private.sees_section(sec)
  order by 3 desc, 6 desc;
$$;

create or replace function public.club_rating(ms date)
returns table (athlete_id uuid, full_name text, points bigint, sessions bigint, score bigint)
language sql stable security definer set search_path = '' as $$
  with act as (select p.id, p.full_name from public.profiles p where p.status = 'active' and not p.paused
               and not ((exists (select 1 from public.coaches c where c.user_id = p.id)
                         or exists (select 1 from public.section_coaches sc where sc.user_id = p.id))
                        and not exists (select 1 from public.section_members sm where sm.athlete_id = p.id))),
  pts as (select b.athlete_id, sum(b.points) s from public.board_points b
          where b.created_at >= ms and b.created_at < (ms + interval '1 month') group by b.athlete_id),
  bm as (select k.athlete_id, count(*) n from public.board_marks k join public.board_posts p on p.id = k.post_id
         where k.status in ('done','alt') and p.day >= ms and p.day < (ms + interval '1 month') group by k.athlete_id),
  wl as (select w.athlete_id, count(*) n from public.workout_logs w
         where w.status = 'done' and w.day >= ms and w.day < (ms + interval '1 month') group by w.athlete_id)
  select act.id, act.full_name, coalesce(pts.s, 0)::bigint,
         (coalesce(bm.n, 0) + coalesce(wl.n, 0))::bigint,
         (coalesce(pts.s, 0) + 10 * (coalesce(bm.n, 0) + coalesce(wl.n, 0)))::bigint
  from act left join pts on pts.athlete_id = act.id left join bm on bm.athlete_id = act.id left join wl on wl.athlete_id = act.id
  where private.is_member()
  order by 5 desc;
$$;

create or replace function public.weekly_rating(ws date)
returns table (athlete_id uuid, full_name text, group_name text, is_kid boolean, sports text[], planned int, done int, active_days int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.group_name, coalesce(p.age, 30) < 18,
         array(select k from jsonb_object_keys(coalesce(p.q->'sports','{}'::jsonb)) k where coalesce((p.q->'sports'->k->>'on')::boolean, false)),
         coalesce(pw.planned_count, 0),
         (select count(*)::int from public.workout_logs l where l.athlete_id = p.id and l.status = 'done' and l.day between ws and ws + 6),
         (select count(distinct d)::int from (
            select l.day d from public.workout_logs l where l.athlete_id = p.id and l.day between ws and ws + 6
            union select w.day from public.wellness w where w.athlete_id = p.id and w.day between ws and ws + 6) x)
  from public.profiles p
  left join public.plan_weeks pw on pw.athlete_id = p.id and pw.week_start = ws
  where p.status = 'active' and not p.paused and private.is_member();
$$;

-- team list: paused flag for the UI (teammates only see it as «пауза»)
drop function public.team_members();
create function public.team_members()
returns table (id uuid, full_name text, group_name text, is_kid boolean, is_coach boolean, avatar_path text, hide_numbers boolean, paused boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.group_name, coalesce(p.age, 30) < 18, exists (select 1 from public.coaches c where c.user_id = p.id),
         p.avatar_path, p.hide_numbers, p.paused
  from public.profiles p
  where (p.status = 'active' or exists (select 1 from public.coaches c where c.user_id = p.id))
    and (private.is_member() or exists (select 1 from public.coaches c where c.user_id = p.id));
$$;
revoke execute on function public.team_members() from public, anon;
grant execute on function public.team_members() to authenticated;
