-- =============================================================================
-- Storage buckets + policies
-- (Cloudflare R2 holds production media; this is the dev/local mirror.)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-media', 'listing-media', true, 26214400,
   array['image/jpeg','image/png','image/webp','image/heic']),
  ('avatars', 'avatars', true, 5242880,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Listing media: owner can upload/delete; everyone can read
create policy "listing-media-read" on storage.objects
  for select using (bucket_id = 'listing-media');

create policy "listing-media-write" on storage.objects
  for insert with check (
    bucket_id = 'listing-media'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing-media-delete" on storage.objects
  for delete using (
    bucket_id = 'listing-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Avatars: similar
create policy "avatars-read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars-write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars-delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
