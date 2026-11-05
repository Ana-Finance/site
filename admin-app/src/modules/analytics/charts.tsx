// Graphiques (recharts, chargés uniquement avec les modules Dashboard/Analytics).
// Règles : ordre de couleurs fixe, un seul axe par graphique, marques fines, infobulle au survol, légende dès 2 séries.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { num } from '../../lib/format';

export const SERIES = { visitors: 'var(--chart-1)', pageviews: 'var(--chart-2)', conversions: 'var(--chart-3)' } as const;
const LABEL: Record<string, string> = { visitors: 'Visiteurs', pageviews: 'Pages vues', conversions: 'Conversions' };

const fmtDate = (s: string) => {
  if (s.length > 10) return s.slice(11, 16); // heure
  const d = new Date(s + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

function Tip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <b>{label && fmtDate(label)}</b>
      {payload.map((p) => (
        <div key={p.dataKey} className="row"><span className="row" style={{ gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: p.color, display: 'inline-block' }} />{LABEL[p.dataKey] || p.dataKey}</span><b>{num(p.value)}</b></div>
      ))}
    </div>
  );
}

export function Legend({ keys }: { keys: (keyof typeof SERIES)[] }) {
  return <div className="legend">{keys.map((k) => <span key={k}><i style={{ background: SERIES[k] }} />{LABEL[k]}</span>)}</div>;
}

const axis = { tickLine: false, axisLine: false, tick: { fontSize: 11.5 } } as const;

export function TrafficChart({ data, keys = ['visitors', 'pageviews'] }: { data: { date: string; [k: string]: number | string | null }[]; keys?: (keyof typeof SERIES)[] }) {
  return (
    <div className="chart-box" role="img" aria-label={`Évolution : ${keys.map((k) => LABEL[k]).join(', ')}`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="date" tickFormatter={fmtDate} {...axis} minTickGap={24} />
          <YAxis {...axis} allowDecimals={false} tickFormatter={(v) => num(v)} width={48} />
          <Tooltip content={<Tip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
          {keys.map((k) => <Line key={k} type="monotone" dataKey={k} stroke={SERIES[k]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--panel)' }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConversionsChart({ data }: { data: { date: string; conversions: number | null }[] }) {
  return (
    <div className="chart-box sm" role="img" aria-label="Conversions par période">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} {...axis} minTickGap={24} />
          <YAxis {...axis} allowDecimals={false} width={48} />
          <Tooltip content={<Tip />} cursor={{ fill: 'var(--bg-subtle)' }} />
          <Bar dataKey="conversions" fill={SERIES.conversions} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ data, k }: { data: { date: string; [k: string]: number | string | null }[]; k: keyof typeof SERIES }) {
  if (data.length < 2) return null;
  return (
    <div className="spark" aria-hidden>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey={k} stroke={SERIES[k]} strokeWidth={2} fill={SERIES[k]} fillOpacity={0.08} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Anneau (≤ 3 catégories, couleurs fixes par entité) avec légende et valeurs en texte. */
export function Donut({ data, colors }: { data: { name: string; visitors: number }[]; colors: Record<string, string> }) {
  const total = data.reduce((s, d) => s + d.visitors, 0) || 1;
  return (
    <div className="row" style={{ gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 168, height: 168 }} role="img" aria-label="Répartition par appareil">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="visitors" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="var(--panel)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={colors[d.name] || 'var(--faint)'} />)}
            </Pie>
            <Tooltip formatter={(v: unknown, n: unknown) => [`${num(Number(v))} (${Math.round((Number(v) / total) * 100)} %)`, String(n)]} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="stack-sm" style={{ flex: 1, minWidth: 150 }}>
        {data.map((d) => (
          <div key={d.name} className="row between small">
            <span className="row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: colors[d.name] || 'var(--faint)', display: 'inline-block' }} />{d.name}</span>
            <span><b>{Math.round((d.visitors / total) * 100)} %</b> <span className="muted">· {num(d.visitors)}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Classement en barres HTML (une seule teinte : la longueur porte la valeur, le texte le chiffre). */
export function BarList({ rows, total, empty = 'Aucune donnée sur la période.' }: { rows: { name: string; visitors: number }[]; total?: number; empty?: string }) {
  if (!rows.length) return <p className="muted small">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.visitors), 1);
  const sum = total ?? rows.reduce((s, r) => s + r.visitors, 0);
  return (
    <div className="stack-sm">
      {rows.map((r) => (
        <div key={r.name} className="row between small bar-cell" style={{ padding: '6px 8px' }} title={`${r.name} : ${num(r.visitors)} visiteurs`}>
          <span className="bar" style={{ width: `${(r.visitors / max) * 100}%`, background: 'var(--accent-soft)' }} />
          <span className="truncate" style={{ position: 'relative' }}>{r.name}</span>
          <span style={{ position: 'relative' }}><b>{num(r.visitors)}</b>{sum > 0 && <span className="muted"> · {Math.round((r.visitors / sum) * 100)} %</span>}</span>
        </div>
      ))}
    </div>
  );
}
