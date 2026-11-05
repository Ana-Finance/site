// Edge Function « admin-users » : gestion des comptes de l'administration (admins uniquement).
//   {action:'list'} | {action:'invite', email, role} | {action:'resend', email} | {action:'remove', user_id}
// Les inscriptions publiques étant désactivées, l'invitation est le seul moyen de créer un compte.
import { callerFrom, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, env, fail, json, ConfigError } from '../_shared/http.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== 'POST') return fail(req, 405, 'METHOD', 'POST attendu');
  try {
    const caller = await callerFrom(req);
    if (!caller) return fail(req, 401, 'NOT_AUTHORIZED', 'Session invalide');
    if (caller.role !== 'admin') return fail(req, 403, 'ADMIN_REQUIRED', 'Réservé aux administrateurs');
    const svc = serviceClient();
    const b = await req.json().catch(() => ({}));
    const redirectTo = env('ADMIN_URL'); // ex. https://ana-finance.github.io/site/admin/

    if (b.action === 'list') {
      const { data: profiles } = await svc.from('profiles').select('*').order('created_at');
      const { data: users, error } = await svc.auth.admin.listUsers({ perPage: 200 });
      if (error) return fail(req, 500, 'LIST_FAILED', error.message);
      const byId = new Map(users.users.map((u) => [u.id, u]));
      return json(req, {
        members: (profiles ?? []).map((p) => {
          const u = byId.get(p.id);
          return { ...p, last_sign_in_at: u?.last_sign_in_at ?? null, invited_at: u?.invited_at ?? null, confirmed: !!u?.email_confirmed_at };
        }),
      });
    }

    if (b.action === 'invite' || b.action === 'resend') {
      const email = String(b.email ?? '').trim().toLowerCase();
      const role = b.role === 'admin' ? 'admin' : 'editor';
      if (!EMAIL.test(email)) return fail(req, 400, 'INVALID_EMAIL', 'Adresse e-mail invalide');
      const { data, error } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error) return fail(req, 400, 'INVITE_FAILED', error.message);
      if (b.action === 'invite') {
        const { error: e2 } = await svc.from('profiles').upsert({ id: data.user.id, email, role, active: true }, { onConflict: 'id' });
        if (e2) return fail(req, 500, 'PROFILE_FAILED', e2.message);
        await svc.from('audit_logs').insert({ actor: caller.userId, action: 'invite_member', entity_type: 'profile', entity_id: data.user.id, summary: `${email} (${role})` });
      }
      return json(req, { ok: true, user_id: data.user.id });
    }

    if (b.action === 'remove') {
      if (b.user_id === caller.userId) return fail(req, 400, 'SELF', 'Vous ne pouvez pas supprimer votre propre compte');
      const { count } = await svc.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true).neq('id', b.user_id);
      if (!count) return fail(req, 409, 'LAST_ADMIN', 'Il doit rester au moins un administrateur');
      const { error } = await svc.auth.admin.deleteUser(b.user_id);
      if (error) return fail(req, 400, 'REMOVE_FAILED', error.message);
      await svc.from('audit_logs').insert({ actor: caller.userId, action: 'remove_member', entity_type: 'profile', entity_id: b.user_id, summary: 'Compte supprimé' });
      return json(req, { ok: true });
    }
    return fail(req, 400, 'UNKNOWN_ACTION', 'Action inconnue');
  } catch (e) {
    if (e instanceof ConfigError) return fail(req, 503, 'NOT_CONFIGURED', e.message);
    console.error(e);
    return fail(req, 500, 'INTERNAL', (e as Error).message);
  }
});
