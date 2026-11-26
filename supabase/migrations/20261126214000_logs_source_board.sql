alter table public.workout_logs drop constraint if exists workout_logs_source_check;
alter table public.workout_logs add constraint workout_logs_source_check check (source = any (array['manual','file','strava','garmin','board']));
