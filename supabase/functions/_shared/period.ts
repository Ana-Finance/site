// Périodes d'analyse : plage courante et plage précédente de même durée (dates civiles, UTC).
export type PeriodKey = 'today' | '7d' | '30d' | '90d' | 'custom';
export type Range = { from: string; to: string };
export type Period = { key: PeriodKey; current: Range; previous: Range; days: number; granularity: 'hour' | 'day' | 'week' };

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const parse = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new RangeError('Date invalide : ' + s);
  const t = Date.parse(s + 'T00:00:00Z');
  if (Number.isNaN(t)) throw new RangeError('Date invalide : ' + s);
  return t;
};

export function resolvePeriod(key: PeriodKey, opts: { from?: string; to?: string; now?: Date } = {}): Period {
  const today = Date.parse((opts.now ?? new Date()).toISOString().slice(0, 10) + 'T00:00:00Z');
  let from: number;
  let to: number;
  if (key === 'custom') {
    if (!opts.from || !opts.to) throw new RangeError('Période personnalisée : dates requises');
    from = parse(opts.from); to = parse(opts.to);
    if (from > to) throw new RangeError('La date de début doit précéder la date de fin');
    if (to > today) to = today;
    if ((to - from) / DAY > 731) throw new RangeError('Période limitée à 2 ans');
  } else {
    const n = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[key];
    if (!n) throw new RangeError('Période inconnue : ' + key);
    to = today; from = today - (n - 1) * DAY;
  }
  const days = Math.round((to - from) / DAY) + 1;
  const prevTo = from - DAY;
  const prevFrom = prevTo - (days - 1) * DAY;
  return {
    key,
    current: { from: iso(from), to: iso(to) },
    previous: { from: iso(prevFrom), to: iso(prevTo) },
    days,
    granularity: days === 1 ? 'hour' : days > 120 ? 'week' : 'day',
  };
}
