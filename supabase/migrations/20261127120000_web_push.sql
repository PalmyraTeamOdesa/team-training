-- Web Push: subscriptions, per-user prefs, general-chat notifications,
-- and pg_net triggers that call the push-send edge function.

create extension if not exists pg_net;

-- ===== tables =====
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) between 20 and 2000),
  p256dh text not null check (length(p256dh) between 16 and 200),
  auth text not null check (length(auth) between 8 and 200),
  ua text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.push_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  chats boolean not null default true,
  dms boolean not null default true,
  news boolean not null default true,
  awards boolean not null default true,
  coach_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.push_prefs enable row level security;

revoke all on table public.push_subscriptions from public, anon;
revoke all on table public.push_prefs from public, anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant usage, select on sequence public.push_subscriptions_id_seq to authenticated;
grant select, insert, update, delete on table public.push_prefs to authenticated;
grant all on table public.push_subscriptions to service_role;
grant all on table public.push_prefs to service_role;

drop policy if exists blocked_deny on public.push_subscriptions;
create policy blocked_deny on public.push_subscriptions as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
drop policy if exists push_sub_select on public.push_subscriptions;
create policy push_sub_select on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists push_sub_ins on public.push_subscriptions;
create policy push_sub_ins on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists push_sub_upd on public.push_subscriptions;
create policy push_sub_upd on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists push_sub_del on public.push_subscriptions;
create policy push_sub_del on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists blocked_deny on public.push_prefs;
create policy blocked_deny on public.push_prefs as restrictive for all to authenticated
  using (not (select private.is_locked())) with check (not (select private.is_locked()));
drop policy if exists push_prefs_select on public.push_prefs;
create policy push_prefs_select on public.push_prefs for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists push_prefs_ins on public.push_prefs;
create policy push_prefs_ins on public.push_prefs for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists push_prefs_upd on public.push_prefs;
create policy push_prefs_upd on public.push_prefs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Same browser can be reused by another account: replace the endpoint atomically.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or private.is_locked() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint) not between 20 and 2000 then
    raise exception 'invalid endpoint' using errcode = '22023';
  end if;
  if p_p256dh is null or length(p_p256dh) not between 16 and 200 or p_auth is null or length(p_auth) not between 8 and 200 then
    raise exception 'invalid keys' using errcode = '22023';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, ua)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(nullif(p_ua, ''), 300));
end;
$$;
revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.push_subscriptions
  where user_id = auth.uid() and endpoint = p_endpoint;
end;
$$;
revoke all on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_unsubscribe(text) to authenticated;

-- ===== notify: DMs, announces, and general chat (collapsed like section chats) =====
create or replace function private.on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text; b text; lk jsonb;
begin
  select full_name into n from public.profiles where id = new.sender_id;
  if new.kind = 'dm' then
    perform private.notify_link(
      new.recipient_id, 'dm',
      'Повідомлення від ' || coalesce(n, ''),
      left(new.body, 140),
      jsonb_build_object('t', 'dm', 'a', new.sender_id)
    );
  elsif new.kind = 'announce' then
    lk := jsonb_build_object('t', case when new.body ~* 'заїзд' then 'events' else 'feed' end);
    insert into public.notifications (user_id, kind, title, body, link)
    select p.id, 'announce', 'Оголошення тренера', left(new.body, 200), lk
    from public.profiles p
    where p.status = 'active' and p.id <> new.sender_id;
  elsif new.kind = 'chat' then
    lk := jsonb_build_object('t', 'teamchat');
    b := coalesce(split_part(n, ' ', 1), '') || ': ' || left(new.body, 160);
    with rcpt as (
      select p.id as u from public.profiles p
      where p.status = 'active' and p.id <> new.sender_id
    ), upd as (
      update public.notifications ntf
        set body = b, created_at = now(), link = lk, title = 'Загальний чат'
      from rcpt
      where ntf.user_id = rcpt.u and ntf.kind = 'chat' and not ntf.read
      returning ntf.user_id
    )
    insert into public.notifications (user_id, kind, title, body, link)
    select r.u, 'chat', 'Загальний чат', b, lk
    from rcpt r
    where r.u not in (select user_id from upd);
  end if;
  return new;
end $$;

-- ===== enqueue web push via pg_net (secret read from Vault at call time) =====
create or replace function private.enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
  allowed boolean;
begin
  select
    exists (select 1 from public.coaches c where c.user_id = new.user_id)
    or exists (select 1 from public.profiles p where p.id = new.user_id and p.status = 'active')
  into allowed;
  if not allowed then
    return new;
  end if;

  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  limit 1;
  if secret is null or length(secret) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := 'https://oqxoqooslqctjnkobehu.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_ixqaAkUWUP6Oa0SWp0or7g_colGxBvT',
      'x-push-secret', secret
    ),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'kind', new.kind,
      'title', new.title,
      'body', left(coalesce(new.body, ''), 160),
      'link', new.link,
      'notif_id', new.id
    ),
    timeout_milliseconds := 8000
  );
  return new;
exception
  when others then
    raise warning 'push enqueue failed';
    return new;
end;
$$;
revoke all on function private.enqueue_push() from public, anon, authenticated;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row
  execute function private.enqueue_push();

drop trigger if exists notifications_push_refresh on public.notifications;
create trigger notifications_push_refresh
  after update of body, created_at on public.notifications
  for each row
  when (
    new.kind in ('chat', 'sec_chat')
    and (new.body is distinct from old.body or new.created_at is distinct from old.created_at)
  )
  execute function private.enqueue_push();
