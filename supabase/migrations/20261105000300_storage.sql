-- Ana Finance CMS — stockage des médias.
-- Bucket PRIVÉ : les fichiers ne sont jamais servis directement au public. Le build télécharge
-- uniquement les médias référencés par du contenu publié (URL signées, service_role) et les
-- publie dans assets/media/ sur GitHub Pages. Les médias de brouillons restent donc privés.
-- SVG refusé (peut contenir du script) ; 10 Mo maximum.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "media : lecture membres" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_member());

-- Chemin imposé : <uuid de l'utilisateur>/<nom de fichier sûr>
create policy "media : envoi membres" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and public.is_member()
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'
    and lower(name) ~ '\.(jpe?g|png|webp|avif|gif)$'
  );

-- Remplacement d'un fichier : réservé à son auteur ou à un admin.
create policy "media : remplacement" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_member() and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  with check (bucket_id = 'media' and public.is_member());

-- Suppression physique seulement après suppression logique contrôlée (delete_media).
create policy "media : suppression" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media' and public.is_member()
    and exists (select 1 from public.media_assets a where a.storage_path = name and a.deleted_at is not null)
  );
