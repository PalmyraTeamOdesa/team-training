-- avatars: private bucket, members read, owner (or admin) writes uid/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 524288, allowed_mime_types = array['image/webp','image/jpeg','image/png'];

create policy avatars_select_members on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (select private.is_member()));
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (((storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_member())) or (select private.is_coach())));
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_coach())))
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_coach())));
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_coach())));

create or replace function public.set_avatar(u uuid, path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.is_locked() or not (u = auth.uid() or private.is_coach()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if path is not null and path not like u::text || '/%' then
    raise exception 'bad path' using errcode = '22023';
  end if;
  update public.profiles set avatar_path = path where id = u;
end $$;
revoke all on function public.set_avatar(uuid, text) from public, anon;
grant execute on function public.set_avatar(uuid, text) to authenticated;
