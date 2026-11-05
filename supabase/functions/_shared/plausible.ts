// Adaptateur Plausible Stats API v2 (https://plausible.io/docs/stats-api).
// Module pur : `fetchFn` est injecté (tests unitaires sous Node, fetch réel sous Deno).
import type { Period } from './period.ts';

export type Metrics = {
  visitors: number; visits: number; pageviews: number; viewsPerVisit: number;
  bounceRate: number; visitDuration: number; conversions: number | null; conversionRate: number | null;
};
export type Row = { name: string; visitors: number; [k: string]: string | number | null };
export type Report = {
  configured: true;
  provider: 'plausible';
  period: Period;
  fetchedAt: string;
  summary: { current: Metrics | null; previous: Metrics | null };
  timeseries: { date: string; visitors: number; pageviews: number; conversions: number | null }[];
  pages: { page: string; visitors: number; pageviews: number; bounceRate: number | null }[];
  channels: Row[];
  sources: Row[];
  campaigns: { source: string; medium: string; campaign: string; visitors: number }[];
  devices: Row[];
  countries: Row[];
  goals: { name: string; visitors: number; events: number; isConversion: boolean }[];
  warnings: string[];
};

type Query = Record<string, unknown>;
type Result = { results: { metrics: number[]; dimensions: string[] }[] };
type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export class PlausibleError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function createClient(opts: { apiKey: string; siteId: string; baseUrl?: string; fetchFn?: FetchFn }) {
  const base = (opts.baseUrl ?? 'https://plausible.io').replace(/\/$/, '');
  const f = opts.fetchFn ?? fetch;
  return async function query(q: Query): Promise<Result> {
    const res = await f(base + '/api/v2/query', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + opts.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ site_id: opts.siteId, ...q }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 300);
      try { msg = JSON.parse(text).error ?? msg; } catch { /* texte brut */ }
      throw new PlausibleError(res.status, msg);
    }
    return JSON.parse(text) as Result;
  };
}

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const EMPTY = new Set(['', '(none)', 'Direct / None']);

/** Jours manquants complétés par des zéros (Plausible omet les intervalles sans visite). */
export function fillDays(from: string, to: string, rows: Map<string, { visitors: number; pageviews: number }>, conv: Map<string, number> | null) {
  const out: Report['timeseries'] = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    const r = rows.get(d);
    out.push({ date: d, visitors: r?.visitors ?? 0, pageviews: r?.pageviews ?? 0, conversions: conv ? conv.get(d) ?? 0 : null });
  }
  return out;
}

const SUMMARY_METRICS = ['visitors', 'visits', 'pageviews', 'views_per_visit', 'bounce_rate', 'visit_duration'];

/**
 * Construit le rapport complet. Chaque bloc est indépendant : une erreur sur l'un est remontée
 * dans `warnings` sans masquer les autres (jamais de valeur inventée).
 */
export async function buildReport(query: (q: Query) => Promise<Result>, period: Period, conversionGoals: string[], now = new Date()): Promise<Report> {
  const warnings: string[] = [];
  const cur = [period.current.from, period.current.to];
  const prev = [period.previous.from, period.previous.to];
  const goalFilter = conversionGoals.length ? [['is', 'event:goal', conversionGoals]] : null;
  const timeDim = period.granularity === 'hour' ? 'time:hour' : period.granularity === 'week' ? 'time:week' : 'time:day';

  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (e) { warnings.push(`${label} : ${(e as Error).message}`); return fallback; }
  };
  const breakdown = (dims: string[], limit = 10, metrics = ['visitors']) =>
    query({ metrics, date_range: cur, dimensions: dims, order_by: [[metrics[0], 'desc']], pagination: { limit } });

  const aggregate = async (range: string[]) => {
    const r = await query({ metrics: SUMMARY_METRICS, date_range: range });
    const m = r.results[0]?.metrics ?? [];
    let conversions: number | null = null;
    let conversionRate: number | null = null;
    if (goalFilter) {
      const c = await query({ metrics: ['visitors', 'events'], date_range: range, filters: goalFilter });
      const [cv, ce] = c.results[0]?.metrics ?? [0, 0];
      conversions = n(ce);
      conversionRate = n(m[0]) > 0 ? Math.round((n(cv) / n(m[0])) * 1000) / 10 : 0;
    }
    return { visitors: n(m[0]), visits: n(m[1]), pageviews: n(m[2]), viewsPerVisit: n(m[3]), bounceRate: n(m[4]), visitDuration: n(m[5]), conversions, conversionRate } as Metrics;
  };

  const [current, previous, series, convSeries, pages, channels, sources, campaigns, devices, countries, goals] = await Promise.all([
    safe('Synthèse', () => aggregate(cur), null),
    safe('Période précédente', () => aggregate(prev), null),
    safe('Courbe de trafic', () => query({ metrics: ['visitors', 'pageviews'], date_range: cur, dimensions: [timeDim] }), null),
    goalFilter ? safe('Courbe des conversions', () => query({ metrics: ['events'], date_range: cur, dimensions: [timeDim], filters: goalFilter }), null) : Promise.resolve(null),
    safe('Pages', async () => {
      try { return { r: await breakdown(['event:page'], 100, ['visitors', 'pageviews', 'bounce_rate']), bounce: true }; }
      catch (e) { if (e instanceof PlausibleError && e.status === 400) return { r: await breakdown(['event:page'], 100, ['visitors', 'pageviews']), bounce: false }; throw e; }
    }, null),
    safe('Canaux', () => breakdown(['visit:channel'], 12), null),
    safe('Sources', () => breakdown(['visit:source'], 15), null),
    safe('Campagnes UTM', () => breakdown(['visit:utm_source', 'visit:utm_medium', 'visit:utm_campaign'], 20), null),
    safe('Appareils', () => breakdown(['visit:device'], 6), null),
    safe('Pays', () => breakdown(['visit:country_name'], 15), null),
    safe('Objectifs', () => breakdown(['event:goal'], 50, ['visitors', 'events']), null),
  ]);

  const conv = new Set(conversionGoals);
  let timeseries: Report['timeseries'] = [];
  if (series) {
    const convMap = convSeries ? new Map(convSeries.results.map((r) => [String(r.dimensions[0] ?? '').slice(0, period.granularity === 'hour' ? 13 : 10), n(r.metrics[0])])) : null;
    if (period.granularity === 'day') {
      timeseries = fillDays(period.current.from, period.current.to, new Map(series.results.map((r) => [String(r.dimensions[0] ?? '').slice(0, 10), { visitors: n(r.metrics[0]), pageviews: n(r.metrics[1]) }])), convMap);
    } else {
      timeseries = series.results.map((r) => {
        const key = String(r.dimensions[0] ?? '').slice(0, period.granularity === 'hour' ? 13 : 10);
        return { date: r.dimensions[0], visitors: n(r.metrics[0]), pageviews: n(r.metrics[1]), conversions: convMap ? convMap.get(key) ?? 0 : null };
      });
    }
  }
  const rows = (r: Result | null): Row[] => (r ? r.results.filter((x) => !EMPTY.has(x.dimensions[0] ?? '')).map((x) => ({ name: x.dimensions[0], visitors: n(x.metrics[0]) })) : []);

  return {
    configured: true,
    provider: 'plausible',
    period,
    fetchedAt: now.toISOString(),
    summary: { current, previous },
    timeseries,
    pages: pages ? pages.r.results.map((x) => ({ page: x.dimensions[0], visitors: n(x.metrics[0]), pageviews: n(x.metrics[1]), bounceRate: pages.bounce ? n(x.metrics[2]) : null })) : [],
    channels: rows(channels),
    sources: rows(sources),
    campaigns: campaigns ? campaigns.results.filter((x) => !EMPTY.has(x.dimensions[2] ?? '')).map((x) => ({ source: x.dimensions[0], medium: x.dimensions[1], campaign: x.dimensions[2], visitors: n(x.metrics[0]) })) : [],
    devices: rows(devices),
    countries: rows(countries),
    goals: goals ? goals.results.map((x) => ({ name: x.dimensions[0], visitors: n(x.metrics[0]), events: n(x.metrics[1]), isConversion: conv.has(x.dimensions[0]) })) : [],
    warnings,
  };
}
