-- AI auto-replan: load metrics → AI/rules adjust the next 7 days of the plan; explanation + coach review.
-- Additive only. Rows are written by the coach-ai edge function (service role); the client applies/reverts through RPCs.

-- HR drift (aerobic decoupling, %) computed from the file's streams at import time
alter table public.workout_logs add column if not exists decoupling numeric(4,1);

create table if not exists public.ai_plan_adjustments (
  id bigint generated always as identity primary key,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,                                   -- run day (Europe/Kyiv)
  trigger text not null default 'daily' check (trigger in ('import','daily','manual')),
  status text not null default 'proposed' check (status in ('proposed','applied','suggested','reverted','noop')),
  source text not null default 'rules' check (source in ('rules','ai')),
  summary text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,          -- what the engine asked for: [{date,op,factor,reason,to}]
  changes jsonb not null default '[]'::jsonb,          -- what was written / is waiting: [{date,wk,i,op,reason,before,after,applied}]
  suggestions jsonb not null default '[]'::jsonb,      -- FTP/LTHR/HRmax proposals + hints for the coach's own tasks (never auto-applied)
  input_hash text,
  applied_at timestamptz,
  reverted_at timestamptz,
  reverted_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ai_plan_adj_athlete_idx on public.ai_plan_adjustments (athlete_id, created_at desc);
create index if not exists ai_plan_adj_reverted_by_idx on public.ai_plan_adjustments (reverted_by);
create index if not exists ai_plan_adj_approved_by_idx on public.ai_plan_adjustments (approved_by);
alter table public.ai_plan_adjustments enable row level security;
drop policy if exists blocked_deny on public.ai_plan_adjustments;
create policy blocked_deny on public.ai_plan_adjustments as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
drop policy if exists apa_select on public.ai_plan_adjustments;
create policy apa_select on public.ai_plan_adjustments for select to authenticated
  using (athlete_id = (select auth.uid()) or (select private.is_coach()) or (select private.coaches_athlete(athlete_id)));
-- no insert/update/delete policies: writes go through the service role (edge function) and the RPCs below

create or replace function public.ai_adj_save(p_id bigint, p_status text, p_changes jsonb, p_suggestions jsonb default null)
returns public.ai_plan_adjustments language plpgsql security definer set search_path = '' as $$
declare r public.ai_plan_adjustments;
begin
  select * into r from public.ai_plan_adjustments where id = p_id;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if private.is_locked() or not (r.athlete_id = auth.uid() or private.is_coach()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('applied','suggested','noop','reverted') or r.status = 'reverted' then
    raise exception 'bad status' using errcode = '22023';
  end if;
  update public.ai_plan_adjustments set
    status = p_status,
    changes = coalesce(p_changes, changes),
    suggestions = coalesce(p_suggestions, suggestions),
    applied_at = case when p_status = 'applied' and applied_at is null then now() else applied_at end,
    reverted_at = case when p_status = 'reverted' then now() else reverted_at end,
    reverted_by = case when p_status = 'reverted' then auth.uid() else reverted_by end
  where id = p_id returning * into r;
  return r;
end $$;
revoke all on function public.ai_adj_save(bigint, text, jsonb, jsonb) from public, anon;
grant execute on function public.ai_adj_save(bigint, text, jsonb, jsonb) to authenticated;

create or replace function public.ai_adj_approve(p_id bigint, p_v boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.ai_plan_adjustments; nm text;
begin
  if private.is_locked() or not private.is_coach() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.ai_plan_adjustments set approved_at = case when p_v then now() else null end,
    approved_by = case when p_v then auth.uid() else null end where id = p_id returning * into r;
  if not found then return; end if;
  if p_v and r.athlete_id <> auth.uid() then
    select full_name into nm from public.profiles where id = auth.uid();
    perform private.notify_link(r.athlete_id, 'ai', 'Тренер погодив зміни AI у плані',
      coalesce(nm, 'Тренер') || ' переглянув і залишив оновлений план', jsonb_build_object('t','plan'));
  end if;
end $$;
revoke all on function public.ai_adj_approve(bigint, boolean) from public, anon;
grant execute on function public.ai_adj_approve(bigint, boolean) to authenticated;

-- notify coaches (admins + coaches of the athlete's sections) when AI changed or proposes something; tell the athlete when a coach reverts
create or replace function private.on_ai_adj() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nm text; lk jsonb; t text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select full_name into nm from public.profiles where id = new.athlete_id;
  lk := jsonb_build_object('t','aiplan','a',new.athlete_id);
  if new.status in ('applied','suggested') and (jsonb_array_length(new.changes) + jsonb_array_length(new.suggestions)) > 0 then
    t := coalesce(nm,'Спортсмен') || ': ' || case new.status when 'applied' then 'AI оновив план' else 'AI пропонує зміни в плані' end;
    insert into public.notifications (user_id, kind, title, body, link)
      select distinct r, 'ai', t, left(new.summary, 200), lk
      from (select c.user_id r from public.coaches c
            union select sc.user_id from public.section_members m join public.section_coaches sc on sc.section_id = m.section_id where m.athlete_id = new.athlete_id) x
      where r <> new.athlete_id;
  elsif new.status = 'reverted' then
    if auth.uid() is distinct from new.athlete_id then
      perform private.notify_link(new.athlete_id, 'ai', 'Тренер повернув зміни AI у плані', 'План повернено до попереднього вигляду', jsonb_build_object('t','plan'));
    else
      insert into public.notifications (user_id, kind, title, body, link)
        select distinct r, 'ai', coalesce(nm,'Спортсмен') || ' повернув зміни AI', 'План знову як був до автоматичних змін', lk
        from (select c.user_id r from public.coaches c
              union select sc.user_id from public.section_members m join public.section_coaches sc on sc.section_id = m.section_id where m.athlete_id = new.athlete_id) x
        where r <> new.athlete_id;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.on_ai_adj() from public, anon, authenticated;
drop trigger if exists ai_adj_notify on public.ai_plan_adjustments;
create trigger ai_adj_notify after update on public.ai_plan_adjustments for each row execute function private.on_ai_adj();
