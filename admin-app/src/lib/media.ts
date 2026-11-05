// URL signées des médias (bucket privé), avec cache en mémoire (validité 1 h, renouvelées à 50 min).
import { supabase } from './supabase';
import { api } from './api';
import type { Media } from './types';

const cache = new Map<string, { url: string; at: number; media: Media }>();
const TTL = 50 * 60 * 1000;

export async function resolveMediaUrls(ids: string[]): Promise<Map<string, { url: string; media: Media }>> {
  const now = Date.now();
  const missing = ids.filter((id) => { const c = cache.get(id); return !c || now - c.at > TTL; });
  if (missing.length) {
    const { data, error } = await supabase.from('media_assets').select('*').in('id', missing);
    if (error) throw error;
    const signed = await api.signedUrls((data as Media[]).map((m) => m.storage_path));
    (data as Media[]).forEach((m) => { const url = signed.get(m.storage_path); if (url) cache.set(m.id, { url, at: now, media: m }); });
  }
  const out = new Map<string, { url: string; media: Media }>();
  ids.forEach((id) => { const c = cache.get(id); if (c) out.set(id, c); });
  return out;
}

export function invalidateMedia(id: string) { cache.delete(id); }

/** Identifiants de médias référencés dans un contenu. */
export function mediaIdsOf(obj: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(obj)) obj.forEach((v) => mediaIdsOf(v, acc));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'mediaId' && typeof v === 'string') acc.add(v);
      else mediaIdsOf(v, acc);
    }
  }
  return acc;
}
