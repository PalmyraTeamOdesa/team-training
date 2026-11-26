-- Cover remaining foreign keys (performance advisor 0001)
create index if not exists awards_given_by_idx on public.awards (given_by);
create index if not exists change_requests_decided_by_idx on public.change_requests (decided_by);
create index if not exists plan_weeks_updated_by_idx on public.plan_weeks (updated_by);
create index if not exists rides_created_by_idx on public.rides (created_by);
