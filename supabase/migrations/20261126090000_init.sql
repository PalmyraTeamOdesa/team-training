-- TRITON team training: initial schema
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------- roles ----------
create table public.coaches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.coaches enable row level security;
create policy coaches_select_self on public.coaches for select to authenticated
  using ((select auth.uid()) = user_id);
-- no insert/update/delete policies: coach role is granted only by an admin with SQL

create or replace function private.is_coach() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches c where c.user_id = (select auth.uid()));
$$;

create or replace function private.is_coach_id(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches c where c.user_id = u);
$$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  sex text check (sex in ('m','f')),
  age int check (age between 5 and 100),
  height_cm int check (height_cm between 90 and 240),
  weight_kg numeric(5,1) check (weight_kg between 20 and 250),
  city text default '',
  group_name text not null default 'Новачки' check (group_name in ('Шосе','Тріатлон','Новачки','Діти')),
  status text not null default 'pending' check (status in ('pending','active','blocked')),
  onboarded boolean not null default false,
  q jsonb not null default '{}'::jsonb,       -- questionnaire: sports, goals, targets, days, equip, form, health, remind
  hide_numbers boolean not null default false,
  consent boolean not null default false,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches c where c.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active');
$$;

grant execute on function private.is_coach() to authenticated;
grant execute on function private.is_member() to authenticated;

-- full profiles (incl. questionnaire/health) are visible only to the owner and the coach;
-- teammates get name/group/avatar via public.team_members()
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_coach()));
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and status = 'pending');
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_coach()))
  with check (id = (select auth.uid()) or (select private.is_coach()));

-- athletes cannot change their own status/group; coach can
create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_coach() then
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
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function private.profiles_guard();

-- auto-create a profile for every new auth user
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- coach notes ----------
create table public.coach_notes (
  athlete_id uuid primary key references public.profiles(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.coach_notes enable row level security;
create policy coach_notes_all on public.coach_notes for all to authenticated
  using ((select private.is_coach())) with check ((select private.is_coach()));

-- ---------- plans ----------
create table public.plan_weeks (
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  days jsonb not null,               -- [{i, items:[{sport,w,min,int}], tod, rest}]
  planned_count int not null default 0,
  planned_min int not null default 0,
  scale numeric(3,2) not null default 1,
  note text,
  coach_locked boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (athlete_id, week_start)
);
alter table public.plan_weeks enable row level security;

create table public.plan_unlocks (
  athlete_id uuid primary key references public.profiles(id) on delete cascade,
  until timestamptz not null
);
alter table public.plan_unlocks enable row level security;
create policy plan_unlocks_select on public.plan_unlocks for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()));
create policy plan_unlocks_coach on public.plan_unlocks for all to authenticated
  using ((select private.is_coach())) with check ((select private.is_coach()));

create or replace function private.plan_unlocked(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plan_unlocks u where u.athlete_id = a and u.until > now());
$$;
grant execute on function private.plan_unlocked(uuid) to authenticated;

create policy plan_weeks_select on public.plan_weeks for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()));
create policy plan_weeks_insert on public.plan_weeks for insert to authenticated
  with check (athlete_id = (select auth.uid()) or (select private.is_coach()));
create policy plan_weeks_update on public.plan_weeks for update to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()))
  with check (athlete_id = (select auth.uid()) or (select private.is_coach()));

-- athletes may (re)generate their plan only while the coach has not locked it, or while unlocked
create or replace function private.plan_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_coach() then
    new.coach_locked := true;
  else
    if tg_op = 'UPDATE' and old.coach_locked and not private.plan_unlocked(old.athlete_id) then
      raise exception 'План змінює тренер. Надішліть запит на зміну.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then new.coach_locked := old.coach_locked; else new.coach_locked := false; end if;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
create trigger plan_weeks_guard before insert or update on public.plan_weeks
  for each row execute function private.plan_guard();

-- ---------- change requests ----------
create table public.change_requests (
  id bigint generated always as identity primary key,
  athlete_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null,
  body text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','edited','ai_safe')),
  ai_proposal text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create index change_requests_athlete_idx on public.change_requests (athlete_id, created_at desc);
create index change_requests_pending_idx on public.change_requests (created_at) where status = 'pending';
alter table public.change_requests enable row level security;
create policy cr_select on public.change_requests for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()));
create policy cr_insert on public.change_requests for insert to authenticated
  with check (athlete_id = (select auth.uid()) and status = 'pending');
create policy cr_update_coach on public.change_requests for update to authenticated
  using ((select private.is_coach())) with check ((select private.is_coach()));
-- the athlete may accept the AI-safe variant only after 24h without an answer
create policy cr_update_ai_safe on public.change_requests for update to authenticated
  using (athlete_id = (select auth.uid()) and status = 'pending' and created_at < now() - interval '24 hours')
  with check (athlete_id = (select auth.uid()) and status = 'ai_safe');

-- ---------- logs, wellness, weight ----------
create table public.workout_logs (
  id bigint generated always as identity primary key,
  athlete_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  day date not null,
  sport text not null check (sport in ('bike','run','swim','gym')),
  workout_id text,
  title text not null default '',
  status text not null default 'done' check (status in ('done','skipped')),
  skip_reason text,
  duration_min int check (duration_min between 0 and 1440),
  distance numeric(8,2),            -- km for bike/run, metres for swim
  avg_power int, np int, avg_hr int, kcal int,
  rpe int check (rpe between 1 and 10),
  pace_sec int,
  tss int,
  note text,
  source text not null default 'manual' check (source in ('manual','file','strava','garmin')),
  file_path text,
  created_at timestamptz not null default now()
);
create index workout_logs_athlete_day_idx on public.workout_logs (athlete_id, day);
alter table public.workout_logs enable row level security;
create policy logs_own on public.workout_logs for all to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()))
  with check (athlete_id = (select auth.uid()) or (select private.is_coach()));

create table public.wellness (
  athlete_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  day date not null,
  sleep smallint not null check (sleep between 0 and 2),
  energy smallint not null check (energy between 0 and 2),
  legs smallint not null check (legs between 0 and 2),
  primary key (athlete_id, day)
);
alter table public.wellness enable row level security;
create policy wellness_own on public.wellness for all to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()))
  with check (athlete_id = (select auth.uid()));

create table public.weights (
  athlete_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  day date not null,
  kg numeric(5,1) not null check (kg between 20 and 250),
  primary key (athlete_id, day)
);
alter table public.weights enable row level security;
create policy weights_own on public.weights for all to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()))
  with check (athlete_id = (select auth.uid()));

-- ---------- nutrition ----------
create table public.food_entries (
  id bigint generated always as identity primary key,
  athlete_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  day date not null,
  name text not null,
  amount numeric(7,1) not null,
  unit text not null default 'г',
  kcal int not null default 0,
  p numeric(6,1) not null default 0, f numeric(6,1) not null default 0, c numeric(6,1) not null default 0,
  alc numeric(6,1) not null default 0,
  per jsonb,
  created_at timestamptz not null default now()
);
create index food_entries_athlete_day_idx on public.food_entries (athlete_id, day);
alter table public.food_entries enable row level security;
create policy food_own on public.food_entries for all to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()))
  with check (athlete_id = (select auth.uid()));

create table public.daily_counters (
  athlete_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  day date not null,
  water smallint not null default 0, coffee smallint not null default 0, alc smallint not null default 0,
  primary key (athlete_id, day)
);
alter table public.daily_counters enable row level security;
create policy counters_own on public.daily_counters for all to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()))
  with check (athlete_id = (select auth.uid()));

-- ---------- team feed ----------
create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null default 'workout' check (kind in ('workout','plan','text')),
  sport text,
  title text not null default '',
  body text,
  stats jsonb not null default '[]'::jsonb,
  photo_path text,
  created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id);
alter table public.posts enable row level security;
create policy posts_select on public.posts for select to authenticated using ((select private.is_member()));
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.is_member()));
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_coach()));

create table public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id);
alter table public.post_likes enable row level security;
create policy likes_select on public.post_likes for select to authenticated using ((select private.is_member()));
create policy likes_insert on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member()));
create policy likes_delete on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

create table public.post_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id);
create index post_comments_author_idx on public.post_comments (author_id);
alter table public.post_comments enable row level security;
create policy comments_select on public.post_comments for select to authenticated using ((select private.is_member()));
create policy comments_insert on public.post_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.is_member()));
create policy comments_delete on public.post_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_coach()));

-- ---------- rides & challenges ----------
create table public.rides (
  id bigint generated always as identity primary key,
  title text not null,
  details text not null default '',
  starts_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.rides enable row level security;
create policy rides_select on public.rides for select to authenticated using ((select private.is_member()));
create policy rides_coach on public.rides for all to authenticated
  using ((select private.is_coach())) with check ((select private.is_coach()));

create table public.ride_participants (
  ride_id bigint not null references public.rides(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  primary key (ride_id, user_id)
);
create index ride_participants_user_idx on public.ride_participants (user_id);
alter table public.ride_participants enable row level security;
create policy rp_select on public.ride_participants for select to authenticated using ((select private.is_member()));
create policy rp_insert on public.ride_participants for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member()));
create policy rp_delete on public.ride_participants for delete to authenticated using (user_id = (select auth.uid()));

create table public.challenges (
  id bigint generated always as identity primary key,
  title text not null,
  metric text not null default 'km' check (metric in ('km','days','hours','workouts')),
  goal numeric not null check (goal > 0),
  month date not null default date_trunc('month', now())::date,
  created_at timestamptz not null default now()
);
alter table public.challenges enable row level security;
create policy ch_select on public.challenges for select to authenticated using ((select private.is_member()));
create policy ch_coach on public.challenges for all to authenticated
  using ((select private.is_coach())) with check ((select private.is_coach()));

-- ---------- messages ----------
create table public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  recipient_id uuid references public.profiles(id) on delete cascade, -- null = team chat / announcement
  kind text not null default 'chat' check (kind in ('chat','dm','announce')),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_recipient_idx on public.messages (recipient_id, created_at);
create index messages_sender_idx on public.messages (sender_id, created_at);
create index messages_team_idx on public.messages (created_at) where recipient_id is null;
alter table public.messages enable row level security;
create policy msg_select on public.messages for select to authenticated using (
  sender_id = (select auth.uid()) or recipient_id = (select auth.uid())
  or (recipient_id is null and (select private.is_member())));
create policy msg_insert on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and ((select private.is_member()) or private.is_coach_id(recipient_id)) and (
    (kind = 'chat' and recipient_id is null)
    or (kind = 'dm' and recipient_id is not null)
    or (kind = 'announce' and recipient_id is null and (select private.is_coach()))));

-- ---------- notifications ----------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

create or replace function private.notify_coaches(p_kind text, p_title text, p_body text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body)
  select c.user_id, p_kind, p_title, p_body from public.coaches c;
$$;
create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body) values (p_user, p_kind, p_title, p_body);
$$;

-- ---------- awards ----------
create table public.awards (
  id bigint generated always as identity primary key,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text,
  name text not null,
  description text not null default '',
  icon text not null default 'star',
  given_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index awards_athlete_idx on public.awards (athlete_id);
alter table public.awards enable row level security;
create policy awards_select on public.awards for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()));
create policy awards_coach on public.awards for all to authenticated
  using ((select private.is_coach())) with check ((select private.is_coach()));

-- ---------- triggers that notify ----------
create or replace function private.on_request_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  select full_name into n from public.profiles where id = new.athlete_id;
  if tg_op = 'INSERT' then
    perform private.notify_coaches('request', 'Новий запит: ' || coalesce(n,''), new.kind || coalesce(': ' || nullif(new.body,''), ''));
  elsif new.status <> old.status then
    if new.status in ('approved','edited') and private.is_coach() then
      insert into public.plan_unlocks (athlete_id, until) values (new.athlete_id, now() + interval '7 days')
      on conflict (athlete_id) do update set until = excluded.until;
    end if;
    if new.status = 'ai_safe' then
      insert into public.plan_unlocks (athlete_id, until) values (new.athlete_id, now() + interval '7 days')
      on conflict (athlete_id) do update set until = excluded.until;
    end if;
    if private.is_coach() then
      new.decided_by := auth.uid();
      perform private.notify(new.athlete_id, 'request',
        case new.status when 'approved' then 'Тренер підтвердив запит' when 'rejected' then 'Тренер відхилив запит'
          when 'edited' then 'Тренер змінив план за вашим запитом' else 'Запит оновлено' end,
        case when new.status = 'approved' then 'Тепер ви можете редагувати план 7 днів' else new.kind end);
    else
      perform private.notify_coaches('request', coalesce(n,'') || ' прийняв безпечний варіант AI', new.kind);
    end if;
    new.decided_at := now();
  end if;
  return new;
end $$;
create trigger change_requests_notify_ins after insert on public.change_requests
  for each row execute function private.on_request_change();
create trigger change_requests_notify_upd before update on public.change_requests
  for each row execute function private.on_request_change();

create or replace function private.on_wellness() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  if (case when new.sleep = 0 then 1 else 0 end + case when new.energy = 0 then 1 else 0 end + case when new.legs = 0 then 1 else 0 end) >= 2 then
    select full_name into n from public.profiles where id = new.athlete_id;
    perform private.notify_coaches('wellness', coalesce(n,'') || ': погане самопочуття', 'План на сьогодні автоматично полегшено');
  end if;
  return new;
end $$;
create trigger wellness_notify after insert or update on public.wellness
  for each row execute function private.on_wellness();

create or replace function private.on_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  if new.status = 'skipped' then
    select full_name into n from public.profiles where id = new.athlete_id;
    perform private.notify_coaches('skip', coalesce(n,'') || ' пропустив тренування', coalesce(new.skip_reason, ''));
  end if;
  return new;
end $$;
create trigger workout_logs_notify after insert on public.workout_logs
  for each row execute function private.on_log();

create or replace function private.on_award() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.athlete_id, 'award', 'Нове досягнення від тренера: ' || new.name, new.description);
  return new;
end $$;
create trigger awards_notify after insert on public.awards
  for each row execute function private.on_award();

create or replace function private.on_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a uuid; n text;
begin
  select author_id into a from public.posts where id = new.post_id;
  if a is not null and a <> new.author_id then
    select full_name into n from public.profiles where id = new.author_id;
    perform private.notify(a, 'comment', coalesce(n,'') || ' прокоментував ваше тренування', left(new.body, 140));
  end if;
  return new;
end $$;
create trigger post_comments_notify after insert on public.post_comments
  for each row execute function private.on_comment();

create or replace function private.on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  if new.kind = 'dm' then
    select full_name into n from public.profiles where id = new.sender_id;
    perform private.notify(new.recipient_id, 'dm', 'Повідомлення від ' || coalesce(n,''), left(new.body, 140));
  elsif new.kind = 'announce' then
    insert into public.notifications (user_id, kind, title, body)
    select p.id, 'announce', 'Оголошення тренера', left(new.body, 200) from public.profiles p where p.status = 'active' and p.id <> new.sender_id;
  end if;
  return new;
end $$;
create trigger messages_notify after insert on public.messages
  for each row execute function private.on_message();

create or replace function private.on_profile_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.onboarded and not old.onboarded and new.status = 'pending' then
    perform private.notify_coaches('join', 'Нова заявка в команду', coalesce(new.full_name,''));
  end if;
  if new.status = 'active' and old.status = 'pending' then
    perform private.notify(new.id, 'join', 'Вас прийнято в команду', 'Тепер вам доступні стрічка, рейтинг і чат');
  end if;
  return new;
end $$;
create trigger profiles_notify after update on public.profiles
  for each row execute function private.on_profile_signup();

-- ---------- aggregate RPCs (members only, return no private details) ----------
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
  where p.status = 'active' and private.is_member();
$$;
revoke execute on function public.weekly_rating(date) from public, anon;
grant execute on function public.weekly_rating(date) to authenticated;

create or replace function public.challenge_progress(cid bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select case c.metric
    when 'km' then coalesce((select sum(case when l.sport = 'swim' then l.distance / 1000 else l.distance end) from public.workout_logs l
                    where l.status = 'done' and l.day >= c.month and l.day < (c.month + interval '1 month')::date), 0)
    when 'hours' then coalesce((select sum(l.duration_min) / 60.0 from public.workout_logs l
                    where l.status = 'done' and l.day >= c.month and l.day < (c.month + interval '1 month')::date), 0)
    when 'workouts' then (select count(*) from public.workout_logs l
                    where l.status = 'done' and l.day >= c.month and l.day < (c.month + interval '1 month')::date)
    else (select count(distinct l.day) from public.workout_logs l
                    where l.status = 'done' and l.day >= c.month and l.day < (c.month + interval '1 month')::date)
  end
  from public.challenges c where c.id = cid and private.is_member();
$$;
revoke execute on function public.challenge_progress(bigint) from public, anon;
grant execute on function public.challenge_progress(bigint) to authenticated;

create or replace function public.team_members()
returns table (id uuid, full_name text, group_name text, is_kid boolean, is_coach boolean, avatar_path text, hide_numbers boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.group_name, coalesce(p.age, 30) < 18, exists (select 1 from public.coaches c where c.user_id = p.id),
         p.avatar_path, p.hide_numbers
  from public.profiles p
  where (p.status = 'active' or exists (select 1 from public.coaches c where c.user_id = p.id))
    and (private.is_member() or exists (select 1 from public.coaches c where c.user_id = p.id));
$$;
revoke execute on function public.team_members() from public, anon;
grant execute on function public.team_members() to authenticated;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 1048576, array['image/jpeg','image/webp','image/png']),
       ('activity-files', 'activity-files', false, 26214400, null)
on conflict (id) do nothing;

create policy photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_member()));
create policy photos_select_members on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (select private.is_member()));
create policy photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy files_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy files_select_own_or_coach on storage.objects for select to authenticated
  using (bucket_id = 'activity-files' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_coach())));
create policy files_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'activity-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- private schema helpers must not be callable by anon
revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_coach(), private.is_member(), private.plan_unlocked(uuid), private.is_coach_id(uuid) to authenticated;
