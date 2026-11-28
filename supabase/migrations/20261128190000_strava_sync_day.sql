-- «Підтягнути за день»: manual per-day pull from Strava gets its own source value in the per-activity sync log. Additive.
alter table public.strava_activity_sync drop constraint if exists strava_activity_sync_source_check;
alter table public.strava_activity_sync add constraint strava_activity_sync_source_check
  check (source in ('backfill','webhook','manual','manual_day'));
