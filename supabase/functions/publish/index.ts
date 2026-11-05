// Edge Function « publish » : met en file une publication puis déclenche le workflow GitHub.
// Le token GitHub n'existe que dans les secrets Supabase.
import { callerFrom, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, env, fail, json, ConfigError } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== 'POST') return fail(req, 405, 'METHOD', 'POST attendu');
  try {
    const caller = await callerFrom(req);
    if (!caller) return fail(req, 401, 'NOT_AUTHORIZED', 'Session invalide ou compte non autorisé');
    if (caller.role !== 'admin') return fail(req, 403, 'ADMIN_REQUIRED', 'La publication est réservée aux administrateurs');

    // Configuration vérifiée AVANT de créer la publication : pas de publication fantôme.
    const repo = env('GITHUB_REPOSITORY');          // ex. Ana-Finance/site
    const token = env('GITHUB_TOKEN');              // fine-grained, Actions: read & write sur ce repo uniquement
    const workflow = Deno.env.get('GITHUB_WORKFLOW') ?? 'deploy.yml';
    const ref = Deno.env.get('GITHUB_REF') ?? 'main';

    const body = await req.json().catch(() => ({}));
    const pages: string[] | null = Array.isArray(body.pages) && body.pages.length ? body.pages : null;
    const { data: pubId, error } = await caller.client.rpc('create_publication', { p_pages: pages, p_message: body.message ?? null });
    if (error) {
      const code = /PUBLICATION_IN_PROGRESS|NOTHING_TO_PUBLISH|ADMIN_REQUIRED/.exec(error.message)?.[0] ?? 'RPC';
      return fail(req, code === 'RPC' ? 500 : 409, code, error.message);
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'ana-cms' },
      body: JSON.stringify({ ref, inputs: { publication_id: pubId } }),
    });
    if (res.status !== 204) {
      const detail = (await res.text()).slice(0, 500);
      await serviceClient().rpc('set_publication_status', { p_publication: pubId, p_status: 'failed', p_error: `Déclenchement GitHub refusé (HTTP ${res.status}) : ${detail}` });
      return fail(req, 502, 'GITHUB_DISPATCH_FAILED', `GitHub a refusé le déclenchement (HTTP ${res.status}).`, { publication_id: pubId });
    }
    return json(req, { publication_id: pubId, status: 'queued' }, 202);
  } catch (e) {
    if (e instanceof ConfigError) return fail(req, 503, 'NOT_CONFIGURED', e.message);
    console.error(e);
    return fail(req, 500, 'INTERNAL', (e as Error).message);
  }
});
