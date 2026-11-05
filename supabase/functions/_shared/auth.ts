// Vérification de l'appelant : jeton Supabase de l'utilisateur, puis rôle dans profiles.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import { env } from './http.ts';

export type Caller = { userId: string; email: string; role: 'admin' | 'editor'; client: SupabaseClient };

export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

/** Client agissant au nom de l'utilisateur (la RLS et les contrôles SQL s'appliquent). */
export async function callerFrom(req: Request): Promise<Caller | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
    global: { headers: { authorization: header } },
  });
  const { data: u, error } = await client.auth.getUser(header.slice(7));
  if (error || !u?.user) return null;
  const { data: p } = await client.from('profiles').select('role, active, email').eq('id', u.user.id).maybeSingle();
  if (!p || !p.active) return null;
  return { userId: u.user.id, email: p.email, role: p.role, client };
}
