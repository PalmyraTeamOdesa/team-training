-- Sections (Велоспорт / Плавання / Біг), section coaches, daily boards, marks, points, ratings.
-- Admin = row in public.coaches (only killeroftheroad@gmail.com). Section coaches are ordinary
-- approved accounts with rows in public.section_coaches; only the admin can write those rows.

create table public.sections (
  id text primary key,
  name text not null,
  sport text not null check (sport in ('bike','swim','run')),
  color text not null,
  icon text not null,
  sort smallint not null default 0
);
insert into public.sections (id, name, sport, color, icon, sort) values
  ('bike','Велоспорт','bike','#F2994A','bike',1),
  ('swim','Плавання','swim','#2D9CDB','swim',2),
  ('run','Біг','run','#3DD68C','run',3);
alter table public.sections enable row level security;
create policy sections_select on public.sections for select to authenticated using (true);

create table public.section_coaches (
  section_id text not null references public.sections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (section_id, user_id)
);
create index section_coaches_user_idx on public.section_coaches (user_id);

create table public.section_members (
  section_id text not null references public.sections(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (section_id, athlete_id)
);
create index section_members_athlete_idx on public.section_members (athlete_id);

-- helpers (security definer, empty search_path)
create or replace function private.is_section_coach(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.section_coaches c where c.section_id = s and c.user_id = (select auth.uid()));
$$;
create or replace function private.in_section(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.section_members m where m.section_id = s and m.athlete_id = (select auth.uid()));
$$;
-- can see a section: admin, its coach, or its member
create or replace function private.sees_section(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_coach() or private.is_section_coach(s) or private.in_section(s);
$$;
create or replace function private.can_coach_section(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_coach() or private.is_section_coach(s);
$$;
-- caller coaches a section that athlete a belongs to
create or replace function private.coaches_athlete(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.section_members m join public.section_coaches c on c.section_id = m.section_id
                 where m.athlete_id = a and c.user_id = (select auth.uid()));
$$;
grant execute on function private.is_section_coach(text), private.in_section(text), private.sees_section(text),
  private.can_coach_section(text), private.coaches_athlete(uuid) to authenticated;

alter table public.section_coaches enable row level security;
create policy sc_select on public.section_coaches for select to authenticated using ((select private.is_member()));
create policy sc_admin_ins on public.section_coaches for insert to authenticated with check ((select private.is_coach())
  and exists (select 1 from public.profiles p where p.id = section_coaches.user_id and p.status = 'active'));
create policy sc_admin_del on public.section_coaches for delete to authenticated using ((select private.is_coach()));

alter table public.section_members enable row level security;
create policy sm_select on public.section_members for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.sees_section(section_id)));
create policy sm_admin_ins on public.section_members for insert to authenticated with check ((select private.is_coach())
  and exists (select 1 from public.profiles p where p.id = section_members.athlete_id and p.status = 'active'));
create policy sm_admin_del on public.section_members for delete to authenticated using ((select private.is_coach()));

-- per-coach private flag: show this athlete's full load from other sports to me
create table public.coach_athlete_prefs (
  coach_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  show_full boolean not null default false,
  primary key (coach_id, athlete_id)
);
create index coach_athlete_prefs_athlete_idx on public.coach_athlete_prefs (athlete_id);
alter table public.coach_athlete_prefs enable row level security;
create policy cap_own on public.coach_athlete_prefs for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and private.coaches_athlete(athlete_id));

create or replace function private.coach_sees_full(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.coaches_athlete(a) and exists (select 1 from public.coach_athlete_prefs p
    where p.coach_id = (select auth.uid()) and p.athlete_id = a and p.show_full);
$$;
grant execute on function private.coach_sees_full(uuid) to authenticated;

-- section coaches can read profiles of their athletes (basic card); full load only when flagged
create policy profiles_select_section_coach on public.profiles for select to authenticated
  using ((select private.coaches_athlete(id)));
create policy logs_select_section_coach on public.workout_logs for select to authenticated
  using ((select private.coach_sees_full(athlete_id)));
create policy plan_weeks_select_section_coach on public.plan_weeks for select to authenticated
  using ((select private.coach_sees_full(athlete_id)));

-- ---------- daily board ----------
create table public.board_posts (
  id bigint generated always as identity primary key,
  section_id text not null references public.sections(id) on delete cascade,
  day date not null,
  plan text not null default '',
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, day)
);
create index board_posts_author_idx on public.board_posts (author_id);
alter table public.board_posts enable row level security;
create policy bp_select on public.board_posts for select to authenticated using ((select private.sees_section(section_id)));
create policy bp_ins on public.board_posts for insert to authenticated with check ((select private.can_coach_section(section_id)));
create policy bp_upd on public.board_posts for update to authenticated
  using ((select private.can_coach_section(section_id))) with check ((select private.can_coach_section(section_id)));
create policy bp_del on public.board_posts for delete to authenticated using ((select private.can_coach_section(section_id)));

create or replace function private.post_section(p bigint) returns text
language sql stable security definer set search_path = '' as $$
  select section_id from public.board_posts where id = p;
$$;
grant execute on function private.post_section(bigint) to authenticated;

create table public.board_lines (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.board_posts(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  unique (post_id, athlete_id)
);
create index board_lines_athlete_idx on public.board_lines (athlete_id);
alter table public.board_lines enable row level security;
create policy bl_select on public.board_lines for select to authenticated using ((select private.sees_section(private.post_section(post_id))));
create policy bl_write on public.board_lines for all to authenticated
  using ((select private.can_coach_section(private.post_section(post_id))))
  with check ((select private.can_coach_section(private.post_section(post_id)))
    and exists (select 1 from public.section_members m where m.athlete_id = board_lines.athlete_id and m.section_id = private.post_section(post_id)));

create table public.board_marks (
  post_id bigint not null references public.board_posts(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  status text not null check (status in ('done','skip','alt')),
  comment text not null default '' check (length(comment) <= 500),
  time_min numeric(6,1), dist_km numeric(6,2), hr smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, athlete_id)
);
create index board_marks_athlete_idx on public.board_marks (athlete_id);
alter table public.board_marks enable row level security;
create policy bm_select on public.board_marks for select to authenticated using ((select private.sees_section(private.post_section(post_id))));
create policy bm_own on public.board_marks for insert to authenticated
  with check (athlete_id = (select auth.uid()) and (select private.in_section(private.post_section(post_id))));
create policy bm_own_upd on public.board_marks for update to authenticated
  using (athlete_id = (select auth.uid())) with check (athlete_id = (select auth.uid()) and (select private.in_section(private.post_section(post_id))));
create policy bm_own_del on public.board_marks for delete to authenticated using (athlete_id = (select auth.uid()));

create table public.board_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.board_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index board_comments_post_idx on public.board_comments (post_id);
create index board_comments_author_idx on public.board_comments (author_id);
alter table public.board_comments enable row level security;
create policy bc_select on public.board_comments for select to authenticated using ((select private.sees_section(private.post_section(post_id))));
create policy bc_ins on public.board_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.sees_section(private.post_section(post_id))));
create policy bc_del on public.board_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.can_coach_section(private.post_section(post_id))));

create table public.board_points (
  id bigint generated always as identity primary key,
  section_id text not null references public.sections(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  post_id bigint references public.board_posts(id) on delete set null,
  coach_id uuid references public.profiles(id) on delete set null default auth.uid(),
  points int not null default 0 check (points between -50 and 100),
  reaction text not null default '' check (length(reaction) <= 40),
  created_at timestamptz not null default now()
);
create index board_points_section_idx on public.board_points (section_id, created_at);
create index board_points_athlete_idx on public.board_points (athlete_id);
create index board_points_post_idx on public.board_points (post_id);
create index board_points_coach_idx on public.board_points (coach_id);
alter table public.board_points enable row level security;
create policy bpt_select on public.board_points for select to authenticated using ((select private.sees_section(section_id)));
create policy bpt_ins on public.board_points for insert to authenticated
  with check (coach_id = (select auth.uid()) and (select private.can_coach_section(section_id))
    and exists (select 1 from public.section_members m where m.athlete_id = board_points.athlete_id and m.section_id = board_points.section_id));
create policy bpt_del on public.board_points for delete to authenticated
  using (coach_id = (select auth.uid()) or (select private.is_coach()));

create table public.board_templates (
  id bigint generated always as identity primary key,
  section_id text not null references public.sections(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null check (length(title) between 1 and 80),
  plan text not null default '',
  lines text not null default '',
  created_at timestamptz not null default now()
);
create index board_templates_section_idx on public.board_templates (section_id);
create index board_templates_coach_idx on public.board_templates (coach_id);
alter table public.board_templates enable row level security;
create policy bt_select on public.board_templates for select to authenticated using ((select private.can_coach_section(section_id)));
create policy bt_ins on public.board_templates for insert to authenticated
  with check (coach_id = (select auth.uid()) and (select private.can_coach_section(section_id)));
create policy bt_del on public.board_templates for delete to authenticated
  using (coach_id = (select auth.uid()) or (select private.is_coach()));

-- section achievements: awards may carry a section; section coaches may award within their sections
alter table public.awards add column if not exists section_id text references public.sections(id) on delete set null;
create index if not exists awards_section_idx on public.awards (section_id);
create policy awards_select_section on public.awards for select to authenticated
  using (section_id is not null and (select private.can_coach_section(section_id)));
create policy awards_section_coach_ins on public.awards for insert to authenticated
  with check (section_id is not null and (select private.is_section_coach(section_id))
    and exists (select 1 from public.section_members m where m.athlete_id = awards.athlete_id and m.section_id = awards.section_id));

-- ---------- notifications ----------
create or replace function private.on_board_line() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select bp.day, sec.name into s from public.board_posts bp join public.sections sec on sec.id = bp.section_id where bp.id = new.post_id;
  if tg_op = 'INSERT' or new.text is distinct from old.text then
    perform private.notify(new.athlete_id, 'board',
      s.name || ' · ' || to_char(s.day, 'DD.MM') || (case when tg_op = 'UPDATE' then ' (оновлено)' else '' end),
      left(new.text, 200));
  end if;
  return new;
end $$;
create trigger board_lines_notify after insert or update on public.board_lines
  for each row execute function private.on_board_line();

create or replace function private.on_board_mark() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sid text; nm text; st text;
begin
  select section_id into sid from public.board_posts where id = new.post_id;
  select full_name into nm from public.profiles where id = new.athlete_id;
  st := case new.status when 'done' then '✅ виконав' when 'skip' then '❌ пропускає' else '🔁 зробив інакше' end;
  insert into public.notifications (user_id, kind, title, body)
    select c.user_id, 'board_mark', coalesce(nm, 'Спортсмен') || ': ' || st, left(new.comment, 200)
    from public.section_coaches c where c.section_id = sid and c.user_id <> new.athlete_id;
  return new;
end $$;
create trigger board_marks_notify after insert or update of status, comment on public.board_marks
  for each row execute function private.on_board_mark();

create or replace function private.on_board_points() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.athlete_id, 'points',
    (case when new.points <> 0 then '+' || new.points || ' балів' else '' end) ||
    (case when new.points <> 0 and new.reaction <> '' then ' · ' else '' end) || new.reaction,
    (select name from public.sections where id = new.section_id));
  return new;
end $$;
create trigger board_points_notify after insert on public.board_points
  for each row execute function private.on_board_points();

create or replace function private.on_board_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sid text; nm text;
begin
  select section_id into sid from public.board_posts where id = new.post_id;
  select full_name into nm from public.profiles where id = new.author_id;
  insert into public.notifications (user_id, kind, title, body)
    select c.user_id, 'comment', coalesce(nm, 'Учасник') || ' коментує дошку', left(new.body, 200)
    from public.section_coaches c where c.section_id = sid and c.user_id <> new.author_id;
  return new;
end $$;
create trigger board_comments_notify after insert on public.board_comments
  for each row execute function private.on_board_comment();

-- ---------- ratings ----------
-- weekly section rating: points + completion of assigned lines in the week
create or replace function public.section_rating(sec text, ws date)
returns table (athlete_id uuid, full_name text, points bigint, assigned bigint, done bigint, pct int)
language sql stable security definer set search_path = '' as $$
  with mem as (select m.athlete_id from public.section_members m where m.section_id = sec),
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

-- monthly club rating: board points + 10 per completed board session + 10 per completed own workout
create or replace function public.club_rating(ms date)
returns table (athlete_id uuid, full_name text, points bigint, sessions bigint, score bigint)
language sql stable security definer set search_path = '' as $$
  with act as (select p.id, p.full_name from public.profiles p where p.status = 'active'
               and not exists (select 1 from public.coaches c where c.user_id = p.id)),
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
revoke execute on function public.section_rating(text, date) from public, anon;
revoke execute on function public.club_rating(date) from public, anon;
grant execute on function public.section_rating(text, date) to authenticated;
grant execute on function public.club_rating(date) to authenticated;

-- realtime for boards
alter publication supabase_realtime add table public.board_posts, public.board_lines, public.board_marks, public.board_comments;
