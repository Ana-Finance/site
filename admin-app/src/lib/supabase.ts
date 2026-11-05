import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// HTTPS obligatoire, sauf boucle locale (développement et tests).
export const isConfigured = !!(url && key && /^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(url));

// Le type de session est capturé avant que supabase-js ne consomme le fragment d'URL (invitation, réinitialisation).
const initialHash = typeof location !== 'undefined' ? location.hash : '';
export const authRedirectType: 'invite' | 'recovery' | null = /type=invite/.test(initialHash) ? 'invite' : /type=recovery/.test(initialHash) ? 'recovery' : null;

export const supabase: SupabaseClient = isConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } })
  : (null as unknown as SupabaseClient);

/** Appel d'une Edge Function ; renvoie une erreur lisible (code + message) au lieu d'une exception opaque. */
export async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let payload: { error?: { code?: string; message?: string } } | null = null;
    try { payload = await (error as { context?: Response }).context?.json(); } catch { /* corps non JSON */ }
    throw new AppError(payload?.error?.message || error.message, payload?.error?.code || 'FUNCTION_ERROR', payload);
  }
  return data as T;
}

export class AppError extends Error {
  constructor(message: string, public code = 'ERROR', public payload: unknown = null) { super(message); }
}

/** Message d'erreur en français pour les codes métier renvoyés par la base. */
export function errorMessage(e: unknown): string {
  const m = (e as { message?: string })?.message || String(e);
  const map: Record<string, string> = {
    DRAFT_CONFLICT: 'Cette page a été modifiée par quelqu\'un d\'autre depuis son ouverture.',
    ADMIN_REQUIRED: 'Action réservée aux administrateurs.',
    NOT_AUTHORIZED: 'Accès refusé : votre compte n\'est pas autorisé.',
    PUBLICATION_IN_PROGRESS: 'Une publication est déjà en cours. Attendez sa fin.',
    NOTHING_TO_PUBLISH: 'Aucune modification à publier.',
    MEDIA_IN_USE: 'Ce média est utilisé par une page (brouillon ou en ligne).',
    SLUG_TAKEN: 'Cette adresse est déjà utilisée.',
    PAGE_PROTECTED: 'Cette page ne peut pas être archivée ni renommée.',
    LAST_ADMIN: 'Il doit rester au moins un administrateur actif.',
    NOT_CONFIGURED: 'Service non configuré côté serveur.',
    'Failed to fetch': 'Connexion impossible au serveur. Vérifiez votre réseau.',
  };
  for (const k of Object.keys(map)) if (m.includes(k)) return map[k];
  return m;
}
