-- v3: deep links in notifications, «Зробив інакше» review + comments, readiness, section chats, board marks → feed

-- ===== notifications deep link =====
alter table public.notifications add column if not exists link jsonb;
create or replace function private.notify_link(p_user uuid, p_kind text, p_title text, p_body text, p_link jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
$$;

-- recipients that coach a section: section coaches; admins if the section has no coach
create or replace function private.section_coach_ids(s text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.user_id from public.section_coaches c where c.section_id = s
  union
  select a.user_id from public.coaches a where not exists (select 1 from public.section_coaches c2 where c2.section_id = s);
$$;

-- ===== wellness: pain question =====
alter table public.wellness add column if not exists pain smallint check (pain between 0 and 2);
-- readiness notifies coaches instead of the old wellness trigger
drop trigger if exists wellness_notify on public.wellness;

-- ===== workout logs / posts linked to a section board =====
alter table public.workout_logs add column if not exists board_post_id bigint references public.board_posts(id) on delete set null;
create index if not exists workout_logs_board_post_idx on public.workout_logs (board_post_id);
alter table public.posts add column if not exists section_id text references public.sections(id) on delete set null;
alter table public.posts add column if not exists board_post_id bigint references public.board_posts(id) on delete cascade;
alter table public.posts add column if not exists source text not null default 'app';
create index if not exists posts_board_post_idx on public.posts (board_post_id);
create index if not exists posts_section_idx on public.posts (section_id);
create unique index if not exists posts_board_author_uq on public.posts (board_post_id, author_id) where board_post_id is not null;

-- ===== alt reviews (written by the coach-ai edge function with the service role) =====
create table if not exists public.alt_reviews (
  post_id bigint not null references public.board_posts(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  actual_load integer,
  planned_load integer,
  ratio numeric,
  verdict text,
  source text not null default 'rules',
  updated_at timestamptz not null default now(),
  primary key (post_id, athlete_id)
);
create index if not exists alt_reviews_athlete_idx on public.alt_reviews (athlete_id);
alter table public.alt_reviews enable row level security;
create policy blocked_deny on public.alt_reviews as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
create policy ar_select on public.alt_reviews for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.can_coach_section(private.post_section(post_id))));

-- ===== comments on one athlete's mark (coach ↔ athlete thread) =====
create table if not exists public.mark_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.board_posts(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists mark_comments_thread_idx on public.mark_comments (post_id, athlete_id);
create index if not exists mark_comments_author_idx on public.mark_comments (author_id);
create index if not exists mark_comments_athlete_idx on public.mark_comments (athlete_id);
alter table public.mark_comments enable row level security;
create policy blocked_deny on public.mark_comments as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
create policy mc_select on public.mark_comments for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.can_coach_section(private.post_section(post_id))));
create policy mc_insert on public.mark_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (
    (athlete_id = (select auth.uid()) and (select private.in_section(private.post_section(post_id))))
    or (select private.can_coach_section(private.post_section(post_id)))));
create policy mc_delete on public.mark_comments for delete to authenticated using (author_id = (select auth.uid()));

create or replace function private.on_mark_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sid text; d date; nm text; lk jsonb;
begin
  select section_id, day into sid, d from public.board_posts where id = new.post_id;
  select full_name into nm from public.profiles where id = new.author_id;
  lk := jsonb_build_object('t','alt','s',sid,'post',new.post_id,'a',new.athlete_id,'d',d);
  if new.author_id <> new.athlete_id then
    perform private.notify_link(new.athlete_id, 'mark_comment', coalesce(nm,'Тренер') || ' про «Зробив інакше»', left(new.body,200), lk);
  else
    insert into public.notifications (user_id, kind, title, body, link)
      select r, 'mark_comment', coalesce(nm,'Спортсмен') || ' відповідає про «Зробив інакше»', left(new.body,200), lk
      from private.section_coach_ids(sid) r where r <> new.author_id;
  end if;
  return new;
end $$;
drop trigger if exists mark_comments_notify on public.mark_comments;
create trigger mark_comments_notify after insert on public.mark_comments for each row execute function private.on_mark_comment();

-- board mark notifications now carry a link to the athlete's mark
create or replace function private.on_board_mark() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sid text; d date; nm text; s text;
begin
  select section_id, day into sid, d from public.board_posts where id = new.post_id;
  select full_name into nm from public.profiles where id = new.athlete_id;
  s := case new.status when 'done' then '✅ виконав' when 'skip' then '❌ пропускає' else '🔁 зробив інакше' end;
  insert into public.notifications (user_id, kind, title, body, link)
    select c.user_id, 'board_mark', coalesce(nm, 'Спортсмен') || ': ' || s, left(new.comment, 200),
      jsonb_build_object('t', case when new.status = 'alt' then 'alt' else 'board' end, 's', sid, 'post', new.post_id, 'a', new.athlete_id, 'd', d)
    from public.section_coaches c where c.section_id = sid and c.user_id <> new.athlete_id;
  return new;
end $$;

-- ===== readiness (Garmin-style) =====
create table if not exists public.readiness (
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  score smallint not null check (score between 0 and 100),
  level text not null check (level in ('good','light','recovery','rest')),
  reasons text[] not null default '{}',
  original text,
  adapted text,
  override boolean not null default false,
  coach_reverted boolean not null default false,
  reverted_by uuid references public.profiles(id) on delete set null,
  tip text,
  tip_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (athlete_id, day)
);
create index if not exists readiness_reverted_by_idx on public.readiness (reverted_by);
alter table public.readiness enable row level security;
create policy blocked_deny on public.readiness as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
create policy rd_select on public.readiness for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()) or (select private.coaches_athlete(athlete_id)));
create policy rd_insert on public.readiness for insert to authenticated with check (athlete_id = (select auth.uid()));
create policy rd_update on public.readiness for update to authenticated
  using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()));

-- athletes cannot flip the coach's revert or write the AI tip themselves
create or replace function private.readiness_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then new.updated_at := now(); return new; end if; -- service role / definer RPC
  if tg_op = 'INSERT' then
    new.coach_reverted := false; new.reverted_by := null; new.tip := null; new.tip_source := null;
  else
    if current_setting('private.readiness_rpc', true) = '1' then new.updated_at := now(); return new; end if;
    new.coach_reverted := old.coach_reverted; new.reverted_by := old.reverted_by;
    new.tip := old.tip; new.tip_source := old.tip_source;
    if new.level <> old.level then new.coach_reverted := false; new.reverted_by := null; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists readiness_guard on public.readiness;
create trigger readiness_guard before insert or update on public.readiness for each row execute function private.readiness_guard();

create or replace function private.on_readiness() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nm text; lk jsonb; t text;
begin
  if new.level = 'good' or new.override then return new; end if;
  if tg_op = 'UPDATE' and old.level = new.level and old.override = new.override then return new; end if;
  select full_name into nm from public.profiles where id = new.athlete_id;
  lk := jsonb_build_object('t','ready','a',new.athlete_id,'d',new.day);
  t := coalesce(nm,'Спортсмен') || ': готовність ' || new.score || '% · ' ||
       case new.level when 'light' then 'тренування полегшено' when 'recovery' then 'замінено на відновлення' else 'день відпочинку' end;
  insert into public.notifications (user_id, kind, title, body, link)
    select distinct r, 'ready', t, left(array_to_string(new.reasons, ', '), 200), lk
    from (select c.user_id r from public.coaches c
          union select sc.user_id from public.section_members m join public.section_coaches sc on sc.section_id = m.section_id where m.athlete_id = new.athlete_id) x
    where r <> new.athlete_id;
  return new;
end $$;
drop trigger if exists readiness_notify on public.readiness;
create trigger readiness_notify after insert or update on public.readiness for each row execute function private.on_readiness();

create or replace function public.readiness_revert(a uuid, d date, v boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  if private.is_locked() or not (private.is_coach() or private.coaches_athlete(a)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform set_config('private.readiness_rpc', '1', true);
  update public.readiness set coach_reverted = v, reverted_by = case when v then auth.uid() else null end
   where athlete_id = a and day = d;
  perform set_config('private.readiness_rpc', '0', true);
  select full_name into nm from public.profiles where id = auth.uid();
  perform private.notify_link(a, 'ready', case when v then 'Тренер повернув план на сьогодні' else 'Тренер залишив полегшене тренування' end,
    coalesce(nm,'Тренер') || case when v then ' скасував автоматичне полегшення' else ' погодив полегшення' end,
    jsonb_build_object('t','today'));
end $$;
revoke all on function public.readiness_revert(uuid, date, boolean) from public, anon;
grant execute on function public.readiness_revert(uuid, date, boolean) to authenticated;

-- ===== section chats =====
create table if not exists public.section_messages (
  id bigint generated always as identity primary key,
  section_id text not null references public.sections(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists section_messages_sec_idx on public.section_messages (section_id, created_at desc);
create index if not exists section_messages_sender_idx on public.section_messages (sender_id);
alter table public.section_messages enable row level security;
create policy blocked_deny on public.section_messages as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
create policy smsg_select on public.section_messages for select to authenticated
  using ((select private.sees_section(section_id)));
create policy smsg_insert on public.section_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select private.sees_section(section_id))
              and not (select private.is_paused((select auth.uid()))));
create policy smsg_delete on public.section_messages for delete to authenticated
  using (sender_id = (select auth.uid()) or (select private.can_coach_section(section_id)));

-- one unread notification per section: later messages refresh it instead of piling up
create or replace function private.on_section_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nm text; sn text; lk jsonb; b text;
begin
  select full_name into nm from public.profiles where id = new.sender_id;
  select name into sn from public.sections where id = new.section_id;
  lk := jsonb_build_object('t','secchat','s',new.section_id);
  b := coalesce(split_part(nm,' ',1),'') || ': ' || left(new.body,160);
  with rcpt as (
    select m.athlete_id u from public.section_members m join public.profiles p on p.id = m.athlete_id
      where m.section_id = new.section_id and p.status = 'active' and not coalesce(p.paused,false)
    union select c.user_id from public.section_coaches c where c.section_id = new.section_id
  ), upd as (
    update public.notifications n set body = b, created_at = now()
      from rcpt where n.user_id = rcpt.u and rcpt.u <> new.sender_id and n.kind = 'sec_chat' and not n.read and n.link->>'s' = new.section_id
      returning n.user_id
  )
  insert into public.notifications (user_id, kind, title, body, link)
    select r.u, 'sec_chat', 'Чат секції «' || coalesce(sn, new.section_id) || '»', b, lk
    from rcpt r where r.u <> new.sender_id and r.u not in (select user_id from upd);
  return new;
end $$;
drop trigger if exists section_messages_notify on public.section_messages;
create trigger section_messages_notify after insert on public.section_messages for each row execute function private.on_section_message();

-- ===== board marks → team feed =====
create or replace function private.fmt_min(m numeric) returns text language sql immutable set search_path = '' as $$
  select case when round(m) < 60 then round(m)::int || ' хв'
    else (floor(round(m)/60))::int || ' год' || case when round(m)::int % 60 > 0 then ' ' || (round(m)::int % 60) || ' хв' else '' end end;
$$;

create or replace function private.sync_mark_post(p_post bigint, p_athlete uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.board_marks; bp public.board_posts; sec public.sections; pr public.profiles; ln text;
  v_stats jsonb := '[]'::jsonb; v_ttl text; v_bdy text; pid bigint;
begin
  select * into m from public.board_marks where post_id = p_post and athlete_id = p_athlete;
  select * into bp from public.board_posts where id = p_post;
  select * into pr from public.profiles where id = p_athlete;
  if m.post_id is null or m.status not in ('done','alt') or bp.id is null or pr.id is null
     or pr.status <> 'active' or coalesce(pr.paused,false) then
    delete from public.posts where board_post_id = p_post and author_id = p_athlete and source = 'board';
    update public.posts set board_post_id = null, section_id = null where board_post_id = p_post and author_id = p_athlete;
    return;
  end if;
  select * into sec from public.sections where id = bp.section_id;
  select text into ln from public.board_lines where post_id = p_post and athlete_id = p_athlete limit 1;
  if not coalesce(pr.hide_numbers,false) then
    if m.time_min is not null and m.time_min > 0 then v_stats := v_stats || jsonb_build_array(jsonb_build_array(private.fmt_min(m.time_min), 'час')); end if;
    if m.dist_km is not null and m.dist_km > 0 then v_stats := v_stats || jsonb_build_array(jsonb_build_array(replace(trim(to_char(m.dist_km,'FM999990.0')),'.',',') || ' км', 'дистанція')); end if;
    if m.hr is not null and m.hr > 0 then v_stats := v_stats || jsonb_build_array(jsonb_build_array(m.hr::text, 'пульс')); end if;
  end if;
  v_ttl := case m.status when 'done' then '✅ ' else '🔁 Інакше: ' end || coalesce(sec.name, bp.section_id) || coalesce(' · ' || nullif(left(ln, 80), ''), '');
  v_bdy := nullif(m.comment, '');
  select id into pid from public.posts where board_post_id = p_post and author_id = p_athlete limit 1;
  if pid is null then
    -- adopt a workout the athlete already shared from «Сьогодні» for the same sport and day: no duplicates
    select id into pid from public.posts
     where author_id = p_athlete and board_post_id is null and kind = 'workout' and sport = coalesce(sec.sport, bp.section_id)
       and (created_at at time zone 'Europe/Kyiv')::date = bp.day
     order by created_at desc limit 1;
    if pid is not null then
      update public.posts set board_post_id = p_post, section_id = bp.section_id,
        stats = case when jsonb_array_length(posts.stats) > 0 then posts.stats else v_stats end
       where id = pid;
      return;
    end if;
    insert into public.posts (author_id, kind, sport, title, body, stats, section_id, board_post_id, source, created_at)
    values (p_athlete, 'workout', coalesce(sec.sport, bp.section_id), v_ttl, v_bdy, v_stats, bp.section_id, p_post, 'board',
            greatest(coalesce(m.created_at, now()), (bp.day::timestamp at time zone 'Europe/Kyiv')));
  else
    update public.posts set title = case when posts.source = 'board' then v_ttl else posts.title end,
      body = case when posts.source = 'board' then v_bdy else posts.body end,
      stats = case when posts.source = 'board' or jsonb_array_length(posts.stats) = 0 then v_stats else posts.stats end
     where posts.id = pid;
  end if;
end $$;

create or replace function private.on_mark_feed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then perform private.sync_mark_post(old.post_id, old.athlete_id); return old; end if;
  perform private.sync_mark_post(new.post_id, new.athlete_id);
  return new;
end $$;
drop trigger if exists board_marks_feed on public.board_marks;
create trigger board_marks_feed after insert or update or delete on public.board_marks for each row execute function private.on_mark_feed();

-- backfill the last 7 days
do $$ declare r record; begin
  for r in select m.post_id, m.athlete_id from public.board_marks m join public.board_posts b on b.id = m.post_id
           where b.day >= (now() at time zone 'Europe/Kyiv')::date - 7 loop
    perform private.sync_mark_post(r.post_id, r.athlete_id);
  end loop;
end $$;

-- realtime
alter publication supabase_realtime add table public.section_messages, public.mark_comments, public.alt_reviews;
