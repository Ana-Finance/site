// Edge Function « analytics » : rapport Plausible pour l'administration.
// La clé API Plausible reste ici (secret Supabase), jamais dans le navigateur.
import { callerFrom, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, fail, json } from '../_shared/http.ts';
import { resolvePeriod, type PeriodKey } from '../_shared/period.ts';
import { buildReport, createClient, PlausibleError } from '../_shared/plausible.ts';

const CACHE_SECONDS = 600;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== 'POST') return fail(req, 405, 'METHOD', 'POST attendu');
  try {
    const caller = await callerFrom(req);
    if (!caller) return fail(req, 401, 'NOT_AUTHORIZED', 'Session invalide ou compte non autorisé');

    const body = await req.json().catch(() => ({}));
    const svc = serviceClient();
    const { data: settings } = await svc.from('site_settings').select('value').eq('key', 'analytics').maybeSingle();
    const siteId = Deno.env.get('PLAUSIBLE_SITE_ID') || settings?.value?.domain || '';
    const apiKey = Deno.env.get('PLAUSIBLE_API_KEY') || '';
    const missing = [!apiKey && 'PLAUSIBLE_API_KEY (secret Supabase)', !siteId && 'domaine Plausible (Paramètres → Analytics)'].filter(Boolean);
    if (missing.length) return json(req, { configured: false, provider: 'plausible', missing });

    let period;
    try { period = resolvePeriod((body.period ?? '30d') as PeriodKey, { from: body.from, to: body.to }); }
    catch (e) { return fail(req, 400, 'INVALID_PERIOD', (e as Error).message); }

    const { data: defs } = await svc.from('conversion_definitions').select('event_name').eq('is_conversion', true);
    const goals = (defs ?? []).map((d) => d.event_name).sort();
    const cacheKey = ['plausible', siteId, period.current.from, period.current.to, goals.join(',')].join('|');

    if (!body.refresh) {
      const { data: cached } = await svc.from('analytics_cache').select('payload, fetched_at').eq('key', cacheKey).maybeSingle();
      if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_SECONDS * 1000) return json(req, { ...cached.payload, cached: true });
    }

    const query = createClient({ apiKey, siteId, baseUrl: Deno.env.get('PLAUSIBLE_BASE_URL') ?? undefined });
    const report = await buildReport(query, period, goals);
    if (!report.summary.current) {
      // Aucune donnée exploitable : on n'écrit rien en cache et on remonte l'erreur réelle.
      return fail(req, 502, 'ANALYTICS_UNAVAILABLE', report.warnings[0] ?? 'Plausible indisponible', { warnings: report.warnings });
    }
    await svc.from('analytics_cache').upsert({ key: cacheKey, payload: report, fetched_at: report.fetchedAt });
    return json(req, report);
  } catch (e) {
    if (e instanceof PlausibleError) return fail(req, 502, 'ANALYTICS_UNAVAILABLE', e.message);
    console.error(e);
    return fail(req, 500, 'INTERNAL', (e as Error).message);
  }
});
