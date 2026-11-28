-- Store Strava map.summary_polyline for future mini-maps. Additive, nullable, no default. RLS inherits from the table.
alter table public.workout_logs add column if not exists route_polyline text;
