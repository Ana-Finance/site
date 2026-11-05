import { useCallback, useEffect, useState } from 'react';
import { invoke } from '../../lib/supabase';

export type PeriodKey = 'today' | '7d' | '30d' | '90d' | 'custom';
export type Metrics = { visitors: number; visits: number; pageviews: number; viewsPerVisit: number; bounceRate: number; visitDuration: number; conversions: number | null; conversionRate: number | null };
export type Report = {
  configured: true; provider: string; fetchedAt: string; cached?: boolean;
  period: { key: PeriodKey; current: { from: string; to: string }; previous: { from: string; to: string }; granularity: string };
  summary: { current: Metrics | null; previous: Metrics | null };
  timeseries: { date: string; visitors: number; pageviews: number; conversions: number | null }[];
  pages: { page: string; visitors: number; pageviews: number; bounceRate: number | null }[];
  channels: { name: string; visitors: number }[]; sources: { name: string; visitors: number }[];
  campaigns: { source: string; medium: string; campaign: string; visitors: number }[];
  devices: { name: string; visitors: number }[]; countries: { name: string; visitors: number }[];
  goals: { name: string; visitors: number; events: number; isConversion: boolean }[];
  warnings: string[];
};
export type NotConfigured = { configured: false; provider: string; missing: string[] };

export function useReport(period: PeriodKey, range?: { from: string; to: string }) {
  const [data, setData] = useState<Report | NotConfigured | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (refresh = false) => {
    if (period === 'custom' && (!range?.from || !range?.to)) return;
    setLoading(true); setError(null);
    try { setData(await invoke<Report | NotConfigured>('analytics', { period, from: range?.from, to: range?.to, refresh })); }
    catch (e) { setError(e as Error); } finally { setLoading(false); }
  }, [period, range?.from, range?.to]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, refresh: () => load(true) };
}

export const DEFINITIONS: Record<string, string> = {
  visitors: 'Personnes distinctes estimées par Plausible (empreinte quotidienne anonyme, sans cookie). Un même visiteur revenant un autre jour peut être recompté.',
  visits: 'Sessions : suite de pages vues sans interruption de plus de 30 minutes.',
  pageviews: 'Nombre total de pages chargées.',
  viewsPerVisit: 'Pages vues divisées par le nombre de sessions.',
  visitDuration: 'Durée moyenne des sessions de plus d\'une page (calculée par Plausible).',
  bounceRate: 'Part des sessions d\'une seule page sans événement d\'engagement.',
  conversions: 'Nombre d\'événements définis comme conversions (Paramètres → Conversions) ; un formulaire ne compte que si l\'envoi a réussi côté serveur.',
  conversionRate: 'Visiteurs ayant réalisé au moins une conversion / visiteurs.',
};
