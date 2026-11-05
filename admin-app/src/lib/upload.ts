import { supabase, AppError } from './supabase';
import { prepareImage, safeFileName } from './image';
import { invalidateMedia } from './media';
import type { Media } from './types';

/** Optimise puis envoie une image dans le bucket privé et crée sa fiche. */
export async function uploadMedia(file: File): Promise<Media> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new AppError('Session expirée');
  const img = await prepareImage(file);
  const base = safeFileName(file.name.replace(/\.[^.]+$/, ''));
  const path = `${u.user.id}/${crypto.randomUUID().slice(0, 8)}-${base}.${img.ext}`;
  const up = await supabase.storage.from('media').upload(path, img.blob, { contentType: img.mime, cacheControl: '3600', upsert: false });
  if (up.error) throw new AppError('Envoi refusé : ' + up.error.message);
  const { data, error } = await supabase.from('media_assets').insert({
    storage_path: path, file_name: `${base}.${img.ext}`, title: base.replace(/-/g, ' '), alt: '',
    mime_type: img.mime, size_bytes: img.blob.size, width: img.width, height: img.height, created_by: u.user.id,
  }).select().single();
  if (error) {
    await supabase.storage.from('media').remove([path]); // pas de fichier orphelin
    throw new AppError('Fiche média non créée : ' + error.message);
  }
  return data as Media;
}

/** Remplace le fichier d'un média existant (même chemin, même format) : toutes les pages qui l'utilisent suivent. */
export async function replaceMedia(m: Media, file: File): Promise<Media> {
  const img = await prepareImage(file, m.mime_type);
  const up = await supabase.storage.from('media').update(m.storage_path, img.blob, { contentType: img.mime, cacheControl: '3600', upsert: true });
  if (up.error) throw new AppError('Remplacement refusé : ' + up.error.message);
  const { data, error } = await supabase.from('media_assets').update({ size_bytes: img.blob.size, width: img.width, height: img.height }).eq('id', m.id).select().single();
  if (error) throw new AppError(error.message);
  invalidateMedia(m.id);
  return data as Media;
}
