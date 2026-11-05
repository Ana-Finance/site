// URL du site public, relatives à l'administration (/…/admin/ → /…/).
export const siteBase = new URL('../', location.href.split('#')[0]).href;
export const pageUrl = (slug: string) => new URL(slug === 'index' ? 'index.html' : `${slug}.html`, siteBase).href;
export const publicPageUrl = (slug: string) => new URL(slug === 'index' ? '' : `${slug}.html`, siteBase).href;

/** Vérifie réellement quelle publication est servie en ligne (preuve écrite par le build). */
export async function livePublication(): Promise<{ publication_id: string | null; built_at: string } | null> {
  try {
    const res = await fetch(new URL(`cms-publication.json?t=${Date.now()}`, siteBase), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/** Charge le HTML d'une page publiée (même origine) pour en lire le modèle éditable. */
export async function fetchPageDocument(file: string): Promise<Document> {
  const res = await fetch(new URL(file, siteBase), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Page ${file} introuvable (HTTP ${res.status})`);
  return new DOMParser().parseFromString(await res.text(), 'text/html');
}
