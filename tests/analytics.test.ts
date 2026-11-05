import { describe, it, expect } from 'vitest';
import { resolvePeriod } from '../supabase/functions/_shared/period.ts';
import { buildReport, createClient, PlausibleError } from '../supabase/functions/_shared/plausible.ts';
import { safeEqual } from '../supabase/functions/_shared/tokens.ts';

const NOW = new Date('2026-11-05T15:00:00Z');

describe('périodes', () => {
  it('7 derniers jours et période précédente contiguë', () => {
    const p = resolvePeriod('7d', { now: NOW });
    expect(p.current).toEqual({ from: '2026-10-30', to: '2026-11-05' });
    expect(p.previous).toEqual({ from: '2026-10-23', to: '2026-10-29' });
    expect(p.granularity).toBe('day');
  });
  it("aujourd'hui en granularité horaire", () => {
    const p = resolvePeriod('today', { now: NOW });
    expect(p.current).toEqual({ from: '2026-11-05', to: '2026-11-05' });
    expect(p.previous.to).toBe('2026-11-04');
    expect(p.granularity).toBe('hour');
  });
  it('période personnalisée bornée et validée', () => {
    expect(resolvePeriod('custom', { from: '2026-10-01', to: '2026-10-10', now: NOW }).previous).toEqual({ from: '2026-09-21', to: '2026-09-30' });
    expect(() => resolvePeriod('custom', { from: '2026-10-10', to: '2026-10-01', now: NOW })).toThrow();
    expect(() => resolvePeriod('custom', { from: 'x', to: '2026-10-01', now: NOW })).toThrow();
    expect(resolvePeriod('custom', { from: '2026-11-01', to: '2027-01-01', now: NOW }).current.to).toBe('2026-11-05');
  });
});

function fakePlausible(handler: (q: any) => any) {
  const calls: any[] = [];
  const fetchFn = async (_url: string, init: RequestInit) => {
    const q = JSON.parse(String(init.body));
    calls.push(q);
    const out = handler(q);
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out), { status: 200 });
  };
  return { query: createClient({ apiKey: 'k', siteId: 'ana.example', fetchFn }), calls };
}
const res = (rows: [string[], number[]][]) => ({ results: rows.map(([dimensions, metrics]) => ({ dimensions, metrics })) });

describe('rapport Plausible', () => {
  it('normalise synthèse, courbes, conversions et répartitions', async () => {
    const { query, calls } = fakePlausible((q) => {
      const dims = q.dimensions ?? [];
      const goal = !!q.filters;
      const prev = q.date_range[0] === '2026-10-23';
      if (!dims.length) return goal ? res([[[], [4, 6]]]) : res([[[], prev ? [80, 90, 200, 2.2, 55, 70] : [100, 120, 300, 2.5, 50, 90]]]);
      if (dims[0] === 'time:day') return goal ? res([[['2026-11-01'], [3]]]) : res([[['2026-10-30'], [10, 30]], [['2026-11-02'], [20, 50]]]);
      if (dims[0] === 'event:page') return res([[['/site/'], [60, 150, 40]], [['/site/demo.html'], [20, 30, 20]]]);
      if (dims[0] === 'visit:channel') return res([[['Direct'], [50]], [['Organic Search'], [30]]]);
      if (dims[0] === 'visit:utm_source') return res([[['linkedin', 'social', 'lancement'], [7]], [['', '', ''], [90]]]);
      if (dims[0] === 'event:goal') return res([[['form_demo_success'], [4, 4]], [['cta_demo'], [9, 12]]]);
      return res([[['France'], [70]]]);
    });
    const r = await buildReport(query, resolvePeriod('7d', { now: NOW }), ['form_demo_success'], NOW);
    expect(r.warnings).toEqual([]);
    expect(r.summary.current).toMatchObject({ visitors: 100, visits: 120, pageviews: 300, bounceRate: 50, conversions: 6, conversionRate: 4 });
    expect(r.summary.previous?.visitors).toBe(80);
    expect(r.timeseries).toHaveLength(7);
    expect(r.timeseries[0]).toEqual({ date: '2026-10-30', visitors: 10, pageviews: 30, conversions: 0 });
    expect(r.timeseries.find((d) => d.date === '2026-11-01')).toEqual({ date: '2026-11-01', visitors: 0, pageviews: 0, conversions: 3 });
    expect(r.pages[0]).toEqual({ page: '/site/', visitors: 60, pageviews: 150, bounceRate: 40 });
    expect(r.campaigns).toEqual([{ source: 'linkedin', medium: 'social', campaign: 'lancement', visitors: 7 }]);
    expect(r.goals.find((g) => g.name === 'cta_demo')?.isConversion).toBe(false);
    expect(calls.every((c) => c.site_id === 'ana.example')).toBe(true);
  });

  it('remonte les erreurs sans inventer de données', async () => {
    const { query } = fakePlausible((q) => (q.dimensions?.[0] === 'visit:device' ? new Response('{"error":"boom"}', { status: 500 }) : res([[[], [1, 1, 1, 1, 0, 0]]])));
    const r = await buildReport(query, resolvePeriod('30d', { now: NOW }), [], NOW);
    expect(r.devices).toEqual([]);
    expect(r.warnings.some((w) => w.startsWith('Appareils') && w.includes('boom'))).toBe(true);
    expect(r.summary.current?.conversions).toBeNull();
  });

  it('repli sans taux de rebond si la combinaison est refusée (400)', async () => {
    const { query } = fakePlausible((q) => {
      if (q.dimensions?.[0] === 'event:page' && q.metrics.includes('bounce_rate')) return new Response('{"error":"invalid"}', { status: 400 });
      if (q.dimensions?.[0] === 'event:page') return res([[['/a'], [3, 4]]]);
      return res([]);
    });
    const r = await buildReport(query, resolvePeriod('7d', { now: NOW }), [], NOW);
    expect(r.pages).toEqual([{ page: '/a', visitors: 3, pageviews: 4, bounceRate: null }]);
  });

  it('erreur typée', async () => {
    const { query } = fakePlausible(() => new Response('{"error":"Invalid API key"}', { status: 401 }));
    await expect(query({})).rejects.toBeInstanceOf(PlausibleError);
  });
});

describe('jeton de build', () => {
  it('comparaison stricte', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
