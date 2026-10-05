-- =============================================================================
-- Storage: provider media (menu cards as image/PDF, cover photos)
--
-- Files live at  provider-media/<provider_id>/<kind>/<file>. The bucket is public
-- because menus are public catalog data; only the owning provider can write to
-- their own folder.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-media',
  'provider-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "Provider media is publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'provider-media');

create policy "Providers upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'provider-media'
    and (storage.foldername(name))[1] = (select public.current_provider_id())::text
  );

create policy "Providers replace files in their own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'provider-media'
    and (storage.foldername(name))[1] = (select public.current_provider_id())::text
  );

create policy "Providers delete files in their own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'provider-media'
    and (storage.foldername(name))[1] = (select public.current_provider_id())::text
  );
