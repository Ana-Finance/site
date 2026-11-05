// Edge Function « cms-export », appelée uniquement par GitHub Actions (jeton CMS_BUILD_TOKEN).
//   GET  ?publication=<id>  → contenu à construire + URL signées des médias publiés
//   POST {publication_id, status, run_id?, run_url?, error?} → suivi du build ;
//        status=succeeded n'est accepté qu'après vérification en ligne de cms-publication.json.
import { serviceClient } from '../_shared/auth.ts';
import { corsHeaders, env, fail, json, ConfigError } from '../_shared/http.ts';
import { safeEqual } from '../_shared/tokens.ts';

const STATUSES = ['building', 'deploying', 'verifying', 'failed', 'succeeded'];

async function liveMatches(siteUrl: string, publicationId: string): Promise<boolean> {
  const url = new URL('cms-publication.json', siteUrl.replace(/\/?$/, '/'));
  url.searchParams.set('t', String(Date.now())); // contourne le cache CDN
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) return false;
  const body = await res.json().catch(() => null);
  return body?.publication_id === publicationId;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  try {
    if (!safeEqual(req.headers.get('x-cms-build-token') ?? '', env('CMS_BUILD_TOKEN'))) {
      return fail(req, 401, 'NOT_AUTHORIZED', 'Jeton de build invalide');
    }
    const svc = serviceClient();

    if (req.method === 'GET') {
      const pub = new URL(req.url).searchParams.get('publication');
      const { data, error } = await svc.rpc('cms_export', { p_publication: pub || null });
      if (error) return fail(req, 400, 'EXPORT_FAILED', error.message);
      const media = [];
      for (const m of data.media ?? []) {
        const { data: signed, error: e } = await svc.storage.from('media').createSignedUrl(m.storage_path, 900);
        if (e || !signed) return fail(req, 500, 'MEDIA_SIGN_FAILED', `Média ${m.id} : ${e?.message}`);
        media.push({ ...m, url: signed.signedUrl });
      }
      const a = data.settings?.analytics ?? {};
      return json(req, {
        ...data,
        media,
        public: {
          analyticsDomain: a.domain || '',
          analyticsScript: a.domain ? a.scriptSrc || 'https://plausible.io/js/script.js' : '',
          supabaseUrl: env('SUPABASE_URL'),
          supabaseAnonKey: env('SUPABASE_ANON_KEY'), // clé publique : formulaires (fonction submit_lead uniquement)
        },
      });
    }

    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      if (!b.publication_id || !STATUSES.includes(b.status)) return fail(req, 400, 'INVALID', 'publication_id et status valides requis');
      if (b.status === 'succeeded') {
        const { data: s } = await svc.from('site_settings').select('value').eq('key', 'general').maybeSingle();
        const siteUrl = Deno.env.get('SITE_URL') || s?.value?.siteUrl;
        if (!siteUrl) return fail(req, 503, 'NOT_CONFIGURED', 'URL du site inconnue (SITE_URL)');
        if (!(await liveMatches(siteUrl, b.publication_id))) return fail(req, 409, 'NOT_LIVE_YET', 'La version publiée n\'est pas encore servie en ligne');
        const { error } = await svc.rpc('finalize_publication', { p_publication: b.publication_id });
        if (error) return fail(req, 409, 'FINALIZE_FAILED', error.message);
        return json(req, { ok: true, status: 'succeeded' });
      }
      const { error } = await svc.rpc('set_publication_status', {
        p_publication: b.publication_id, p_status: b.status, p_run_id: b.run_id ?? null, p_run_url: b.run_url ?? null, p_error: b.error ?? null,
      });
      if (error) return fail(req, 409, 'STATUS_FAILED', error.message);
      return json(req, { ok: true, status: b.status });
    }
    return fail(req, 405, 'METHOD', 'GET ou POST attendu');
  } catch (e) {
    if (e instanceof ConfigError) return fail(req, 503, 'NOT_CONFIGURED', e.message);
    console.error(e);
    return fail(req, 500, 'INTERNAL', (e as Error).message);
  }
});
