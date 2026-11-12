import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Info, RefreshCw, Search, ArrowUpDown, BarChart3, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { ago, dateTime, delta, download, duration, num, pct, toCsv } from '../../lib/format';
import { useAsync } from '../../components/hooks';
import { Badge, Button, Card, Empty, Notice, Segmented, Skeleton, Tabs, Trend } from '../../components/ui';
import { BarList, ConversionsChart, Donut, Legend, TrafficChart } from './charts';
import { DEFINITIONS, useReport, type Metrics, type NotConfigured, type PeriodKey, type Report } from './report';
import type { PageRow } from '../../lib/types';
import { leadKind } from '../../lib/leads';

export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: 'today', label: 'Aujourd\'hui' }, { value: '7d', label: '7 jours' }, { value: '30d', label: '30 jours' }, { value: '90d', label: '90 jours' }, { value: 'custom', label: 'Personnalisée' },
];
const DEVICE_COLORS: Record<string, string> = { Desktop: 'var(--chart-1)', Mobile: 'var(--chart-2)', Tablet: 'var(--chart-3)' };
const DEVICE_FR: Record<string, string> = { Desktop: 'Ordinateur', Mobile: 'Mobile', Tablet: 'Tablette' };
const CHANNEL_FR: Record<string, string> = { Direct: 'Direct', 'Organic Search': 'Moteurs de recherche', 'Organic Social': 'Réseaux sociaux', Referral: 'Sites référents', 'Paid Search': 'Recherche payante', 'Paid Social': 'Social payant', Email: 'E-mail', 'Cross-network': 'Campagnes multi-réseaux', Display: 'Display', Affiliates: 'Affiliation', Video: 'Vidéo', 'Organic Video': 'Vidéo', 'Paid Video': 'Vidéo payante', Audio: 'Audio', SMS: 'SMS', 'Organic Shopping': 'Shopping', 'Paid Shopping': 'Shopping payant' };

export function PeriodPicker({ period, setPeriod, range, setRange }: { period: PeriodKey; setPeriod: (p: PeriodKey) => void; range: { from: string; to: string }; setRange: (r: { from: string; to: string }) => void }) {
  return (
    <div className="row">
      <Segmented label="Période" value={period} onChange={setPeriod} options={PERIODS} />
      {period === 'custom' && (
        <span className="row">
          <input type="date" className="input" style={{ width: 150, height: 32 }} value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="Du" />
          <span className="muted">→</span>
          <input type="date" className="input" style={{ width: 150, height: 32 }} value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="Au" />
        </span>
      )}
    </div>
  );
}

export function NotConfiguredCard({ data }: { data: NotConfigured }) {
  return (
    <Card>
      <Empty icon={<BarChart3 />} title="Analytics non configuré" action={<Link className="btn" to="/settings?tab=analytics">Configurer</Link>}>
        Aucune donnée n'est affichée tant que Plausible n'est pas relié. Éléments manquants : {data.missing.join(', ')}. Voir docs/SETUP.md, étape « Analytics ».
      </Empty>
    </Card>
  );
}

export function Kpi({ label, value, cur, prev, k, invert, fmt }: { label: string; value?: string; cur: Metrics | null; prev: Metrics | null; k: keyof Metrics; invert?: boolean; fmt: (n: number | null) => string }) {
  const c = cur ? (cur[k] as number | null) : null;
  const p = prev ? (prev[k] as number | null) : null;
  return (
    <Card bodyClass="kpi">
      <span className="label">{label}<span title={DEFINITIONS[k]} aria-label={DEFINITIONS[k]} style={{ display: 'inline-flex' }}><Info size={12} className="faint" /></span></span>
      <span className="value">{value ?? fmt(c)}</span>
      <span className="row small"><Trend value={delta(c, p)} invert={invert} /><span className="faint">vs période précédente</span></span>
    </Card>
  );
}

function pageName(path: string, pages: PageRow[]) {
  const file = path.split('/').pop() || '';
  const slug = file === '' ? 'index' : file.replace(/\.html$/, '');
  return pages.find((p) => p.slug === slug)?.title || (slug === 'index' ? 'Accueil' : '—');
}

function PagesTable({ r, pages }: { r: Report; pages: PageRow[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: 'pageviews' | 'visitors' | 'bounceRate'; dir: 1 | -1 }>({ k: 'pageviews', dir: -1 });
  const rows = useMemo(() => r.pages.map((p) => ({ ...p, name: pageName(p.page, pages) }))
    .filter((p) => (p.page + p.name).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => ((a[sort.k] ?? -1) - (b[sort.k] ?? -1)) * sort.dir), [r, pages, q, sort]);
  const th = (k: typeof sort.k, label: string) => <th className="num"><button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : -1 }))}>{label}<ArrowUpDown size={12} /></button></th>;
  const max = Math.max(1, ...rows.map((p) => p.pageviews));
  return (
    <Card title="Pages" subtitle={`${r.pages.length} page(s) consultée(s)`} actions={<>
      <div className="input-icon" style={{ width: 220 }}><Search /><input className="input" style={{ height: 30 }} placeholder="Filtrer" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Button size="sm" icon={<Download />} disabled={!rows.length} onClick={() => download(`pages-${r.period.current.from}_${r.period.current.to}.csv`, toCsv(rows.map((p) => ({ url: p.page, page: p.name, pages_vues: p.pageviews, visiteurs: p.visitors, taux_rebond: p.bounceRate ?? '' }))))}>CSV</Button>
    </>} bodyClass="table-wrap">
      {rows.length ? (
        <table className="table">
          <thead><tr><th>URL</th><th>Page</th>{th('pageviews', 'Pages vues')}{th('visitors', 'Visiteurs')}{r.pages.some((p) => p.bounceRate != null) && th('bounceRate', 'Rebond')}</tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.page}>
              <td className="bar-cell"><span className="bar" style={{ width: `${(p.pageviews / max) * 100}%` }} /><span className="mono">{p.page}</span></td>
              <td>{p.name}</td><td className="num">{num(p.pageviews)}</td><td className="num">{num(p.visitors)}</td>
              {r.pages.some((x) => x.bounceRate != null) && <td className="num">{pct(p.bounceRate, 0)}</td>}
            </tr>
          ))}</tbody>
        </table>
      ) : <p className="muted small">Aucune page vue sur la période.</p>}
    </Card>
  );
}

function Conversions({ r }: { r: Report }) {
  const leads = useAsync(() => api.leads(), []);
  const conv = r.goals.filter((g) => g.isConversion);
  return (
    <div className="stack">
      <div className="grid g-main">
        <Card title="Conversions par jour" subtitle="Événements marqués comme conversions">
          {r.summary.current?.conversions == null ? <Empty title="Aucune conversion définie" action={<Link className="btn sm" to="/settings?tab=conversions">Définir les conversions</Link>} /> : <ConversionsChart data={r.timeseries} />}
        </Card>
        <Card title="Événements" subtitle="Objectifs Plausible sur la période" actions={<Link className="btn sm ghost" to="/settings?tab=conversions">Configurer</Link>}>
          {r.goals.length ? (
            <div className="list">{r.goals.map((g) => (
              <div key={g.name} className="list-item"><div className="grow"><code>{g.name}</code>{g.isConversion && <> <Badge tone="success">conversion</Badge></>}</div><span className="small"><b>{num(g.events)}</b> <span className="muted">· {num(g.visitors)} visiteurs</span></span></div>
            ))}</div>
          ) : <p className="muted small">Aucun événement reçu. Les objectifs doivent aussi être déclarés dans Plausible (Site settings → Goals).</p>}
          {!!conv.length && <p className="small muted" style={{ marginTop: 10 }}>Total conversions : <b>{num(conv.reduce((s, g) => s + g.events, 0))}</b></p>}
        </Card>
      </div>
      <Card title="Demandes reçues" subtitle="Formulaires du site enregistrés avec succès (base Supabase)" actions={
        <Button size="sm" icon={<Download />} disabled={!leads.data?.length} onClick={() => download('demandes.csv', toCsv((leads.data || []).map((l) => ({ date: l.created_at, formulaire: l.form, nom: l.name, email: l.email, societe: l.company, telephone: l.phone, profil: l.profile, message: l.message, page: l.page }))))}>CSV</Button>
      } bodyClass="table-wrap">
        {leads.error && <Notice tone="danger">{errorMessage(leads.error)}</Notice>}
        {leads.data && !leads.data.length ? <Empty icon={<Inbox />} title="Aucune demande" action={<Link className="btn sm" to="/demandes">Ouvrir la page Demandes</Link>}>Les demandes de démo, les messages de contact et les candidatures apparaîtront ici dès leur envoi.</Empty> : (
          <table className="table responsive">
            <thead><tr><th>Date</th><th>Formulaire</th><th>Contact</th><th>Société</th><th>Profil</th></tr></thead>
            <tbody>{(leads.data || []).slice(0, 50).map((l) => (
              <tr key={l.id}><td>{dateTime(l.created_at)}</td><td><Badge>{leadKind(l)}</Badge></td>
                <td><b>{l.name}</b><div className="small"><a href={`mailto:${l.email}`}>{l.email}</a>{l.phone && ` · ${l.phone}`}</div></td><td data-hide-mobile>{l.company || '—'}</td><td data-hide-mobile>{l.profile || '—'}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [range, setRange] = useState({ from: '', to: '' });
  const [tab, setTab] = useState<'overview' | 'acquisition' | 'audience' | 'pages' | 'conversions'>('overview');
  const { data, error, loading, refresh } = useReport(period, range);
  const pages = useAsync(() => api.pages(), []);
  const r = data && data.configured ? data : null;
  const cur = r?.summary.current ?? null;
  const prev = r?.summary.previous ?? null;

  const devices = useMemo(() => {
    if (!r) return [];
    const known = r.devices.filter((d) => DEVICE_COLORS[d.name]).map((d) => ({ ...d }));
    const other = r.devices.filter((d) => !DEVICE_COLORS[d.name]).reduce((s, d) => s + d.visitors, 0);
    // « Autres » rejoint « Ordinateur » si Plausible renvoie une catégorie hors des trois principales (ex. Laptop).
    if (other) { const desk = known.find((d) => d.name === 'Desktop'); if (desk) desk.visitors += other; else known.push({ name: 'Desktop', visitors: other }); }
    return known.map((d) => ({ ...d, name: DEVICE_FR[d.name] }));
  }, [r]);
  const devColors = { Ordinateur: DEVICE_COLORS.Desktop, Mobile: DEVICE_COLORS.Mobile, Tablette: DEVICE_COLORS.Tablet };

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Analytics</h1><p>{r ? <>Plausible · du {r.period.current.from} au {r.period.current.to} · actualisé {ago(r.fetchedAt)}{r.cached && ' (cache 10 min)'}</> : 'Audience du site public'}</p></div>
        <div className="row">
          <PeriodPicker period={period} setPeriod={setPeriod} range={range} setRange={setRange} />
          <Button size="sm" icon={<RefreshCw />} loading={loading} onClick={refresh} aria-label="Actualiser">Actualiser</Button>
        </div>
      </div>
      {error && <Notice tone="danger" title="Données indisponibles">{errorMessage(error)}</Notice>}
      {data && !data.configured && <NotConfiguredCard data={data} />}
      {r?.warnings.length ? <Notice tone="warning" title="Certaines données n'ont pas pu être chargées">{r.warnings.join(' · ')}</Notice> : null}
      {period === 'custom' && (!range.from || !range.to) && <Notice>Choisissez une date de début et de fin.</Notice>}
      {loading && !data && <div className="grid g-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={110} />)}</div>}

      {r && (
        <>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Vue générale' }, { value: 'acquisition', label: 'Acquisition' }, { value: 'audience', label: 'Appareils & pays' }, { value: 'pages', label: 'Pages' }, { value: 'conversions', label: 'Conversions' }]} />
          {tab === 'overview' && (
            <div className="stack">
              <div className="grid g-4">
                <Kpi label="Visiteurs uniques" cur={cur} prev={prev} k="visitors" fmt={num} />
                <Kpi label="Sessions" cur={cur} prev={prev} k="visits" fmt={num} />
                <Kpi label="Pages vues" cur={cur} prev={prev} k="pageviews" fmt={num} />
                <Kpi label="Pages / session" cur={cur} prev={prev} k="viewsPerVisit" fmt={(n) => (n == null ? '—' : n.toFixed(2).replace('.', ','))} />
                <Kpi label="Durée moyenne" cur={cur} prev={prev} k="visitDuration" fmt={duration} />
                <Kpi label="Taux de rebond" cur={cur} prev={prev} k="bounceRate" invert fmt={(n) => pct(n, 0)} />
                <Kpi label="Taux de conversion" cur={cur} prev={prev} k="conversionRate" fmt={(n) => pct(n)} />
                <Kpi label="Conversions" cur={cur} prev={prev} k="conversions" fmt={num} />
              </div>
              <Card title="Trafic" actions={<Legend keys={['visitors', 'pageviews']} />}><TrafficChart data={r.timeseries} /></Card>
              <details className="card"><summary className="card-body strong" style={{ cursor: 'pointer' }}>Définition des métriques</summary>
                <div className="card-body stack-sm small" style={{ paddingTop: 0 }}>{Object.entries({ 'Visiteurs uniques': 'visitors', Sessions: 'visits', 'Pages vues': 'pageviews', 'Pages / session': 'viewsPerVisit', 'Durée moyenne': 'visitDuration', 'Taux de rebond': 'bounceRate', Conversions: 'conversions', 'Taux de conversion': 'conversionRate' }).map(([l, k]) => <p key={k}><b>{l}</b> — <span className="muted">{DEFINITIONS[k]}</span></p>)}</div>
              </details>
            </div>
          )}
          {tab === 'acquisition' && (
            <div className="stack">
              <div className="grid g-2">
                <Card title="Canaux" subtitle="Direct, moteurs, réseaux sociaux, référents, campagnes"><BarList rows={r.channels.map((c) => ({ ...c, name: CHANNEL_FR[c.name] || c.name }))} total={cur?.visitors} /></Card>
                <Card title="Sources principales" actions={<Button size="sm" variant="ghost" icon={<Download />} disabled={!r.sources.length} onClick={() => download('sources.csv', toCsv(r.sources))}>CSV</Button>}><BarList rows={r.sources} total={cur?.visitors} /></Card>
              </div>
              <Card title="Campagnes (UTM)" subtitle="Liens tagués utm_source / utm_medium / utm_campaign" bodyClass="table-wrap">
                {r.campaigns.length ? (
                  <table className="table"><thead><tr><th>Campagne</th><th>Source</th><th>Support</th><th className="num">Visiteurs</th></tr></thead>
                    <tbody>{r.campaigns.map((c) => <tr key={c.source + c.medium + c.campaign}><td>{c.campaign}</td><td>{c.source || '—'}</td><td>{c.medium || '—'}</td><td className="num">{num(c.visitors)}</td></tr>)}</tbody></table>
                ) : <p className="muted small">Aucune visite issue d'un lien tagué. Exemple : <code>…/index.html?utm_source=linkedin&utm_medium=social&utm_campaign=lancement</code></p>}
              </Card>
            </div>
          )}
          {tab === 'audience' && (
            <div className="grid g-2">
              <Card title="Appareils">{devices.length ? <Donut data={devices} colors={devColors} /> : <p className="muted small">Aucune donnée.</p>}</Card>
              <Card title="Pays" subtitle="Pays déduit de l'adresse IP par Plausible, jamais stockée"><BarList rows={r.countries} total={cur?.visitors} /></Card>
            </div>
          )}
          {tab === 'pages' && <PagesTable r={r} pages={pages.data || []} />}
          {tab === 'conversions' && <Conversions r={r} />}
        </>
      )}
    </div>
  );
}
