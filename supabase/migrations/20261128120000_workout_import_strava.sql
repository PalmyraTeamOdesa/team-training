-- Workout import (.fit/.gpx/.tcx) + Strava sync preparation. Additive only.
alter table public.workout_logs
  add column if not exists started_at timestamptz,
  add column if not exists external_id text,          -- 'file:<sha256/128>[:session]' or 'strava:<activity id>'
  add column if not exists max_hr int,
  add column if not exists cadence int,
  add column if not exists elevation_m int,
  add column if not exists max_power int,
  add column if not exists intensity numeric(4,2),    -- IF (NP/FTP or avgHR/LTHR)
  add column if not exists device text;
-- hard dedup: same file / same Strava activity can only be stored once per athlete (NULLs are distinct)
create unique index if not exists workout_logs_athlete_ext_uidx on public.workout_logs (athlete_id, external_id);
create index if not exists workout_logs_athlete_started_idx on public.workout_logs (athlete_id, started_at) where started_at is not null;

-- ---------- Strava (phase 2, behind the STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET feature flag) ----------
-- tokens are readable only by the service role (Edge Function strava-sync); clients get status via strava_status()
create table if not exists public.strava_links (
  athlete_id uuid primary key references public.profiles(id) on delete cascade,
  strava_athlete_id bigint not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  athlete_name text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strava_links enable row level security;
revoke all on public.strava_links from anon, authenticated;

create table if not exists public.strava_oauth_states (
  state text primary key,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists strava_oauth_states_athlete_idx on public.strava_oauth_states (athlete_id);
alter table public.strava_oauth_states enable row level security;
revoke all on public.strava_oauth_states from anon, authenticated;

create or replace function public.strava_status() returns json
language sql stable security definer set search_path = '' as $$
  select case when (select private.is_locked()) then null else (
    select json_build_object('connected', true, 'name', l.athlete_name, 'last_sync_at', l.last_sync_at, 'scope', l.scope)
    from public.strava_links l where l.athlete_id = (select auth.uid())) end;
$$;
revoke all on function public.strava_status() from public, anon;
grant execute on function public.strava_status() to authenticated;
