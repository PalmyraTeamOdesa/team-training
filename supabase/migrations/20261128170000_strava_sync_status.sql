-- Strava sync status: per-activity result of every pull (backfill on connect / webhook / manual), so the UI can show
-- «Strava ✓ синхр.», the list of latest Strava activities and «Підтягнуто при підключенні: N». Additive only.
-- Rows are written only by the strava-sync edge function (service role); clients read through RLS.

alter table public.strava_links add column if not exists backfilled_at timestamptz;

create table if not exists public.strava_activity_sync (
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  strava_activity_id bigint not null,
  start_date timestamptz,
  name text,
  sport_type text,
  distance_m numeric,
  moving_s int,
  status text not null check (status in ('imported','skipped','error')),
  reason text,                       -- duplicate | too_short | db_error | …
  workout_log_id bigint references public.workout_logs(id) on delete set null,
  source text not null default 'manual' check (source in ('backfill','webhook','manual')),
  synced_at timestamptz not null default now(),
  primary key (athlete_id, strava_activity_id)
);
create index if not exists strava_activity_sync_athlete_start_idx on public.strava_activity_sync (athlete_id, start_date desc);
create index if not exists strava_activity_sync_log_idx on public.strava_activity_sync (workout_log_id) where workout_log_id is not null;

alter table public.strava_activity_sync enable row level security;
revoke all on public.strava_activity_sync from anon;
revoke insert, update, delete, truncate, references, trigger on public.strava_activity_sync from authenticated;
grant select on public.strava_activity_sync to authenticated;

drop policy if exists blocked_deny on public.strava_activity_sync;
create policy blocked_deny on public.strava_activity_sync as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
-- athlete sees own rows; admin (coaches table) sees all; a section coach sees athletes who share full load with them (same rule as workout_logs)
drop policy if exists sas_select on public.strava_activity_sync;
create policy sas_select on public.strava_activity_sync for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()) or (select private.coach_sees_full(athlete_id)));

create or replace function public.strava_status() returns json
language sql stable security definer set search_path = '' as $$
  select case when (select private.is_locked()) then null else (
    select json_build_object('connected', true, 'name', l.athlete_name, 'last_sync_at', l.last_sync_at, 'scope', l.scope,
      'backfilled_at', l.backfilled_at,
      'backfill_imported', (select count(*) from public.strava_activity_sync s where s.athlete_id = l.athlete_id and s.source = 'backfill' and s.status = 'imported'),
      'backfill_total', (select count(*) from public.strava_activity_sync s where s.athlete_id = l.athlete_id and s.source = 'backfill'))
    from public.strava_links l where l.athlete_id = (select auth.uid())) end;
$$;
revoke all on function public.strava_status() from public, anon;
grant execute on function public.strava_status() to authenticated;
