-- club rating: athletes only (exclude the admin and section coaches who are not section members)
create or replace function public.club_rating(ms date)
returns table (athlete_id uuid, full_name text, points bigint, sessions bigint, score bigint)
language sql stable security definer set search_path = '' as $$
  with act as (select p.id, p.full_name from public.profiles p where p.status = 'active'
               and not exists (select 1 from public.coaches c where c.user_id = p.id)
               and not (exists (select 1 from public.section_coaches sc where sc.user_id = p.id)
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
