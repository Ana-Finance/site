import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, CheckCircle2, Clock, ExternalLink, FileText, MousePointerClick, PenLine, Rocket, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { ago, delta, num, pct } from '../../lib/format';
import { livePublication, siteBase } from '../../lib/site';
import { useAsync } from '../../components/hooks';
import { Badge, Button, Card, Notice, Segmented, Skeleton, Trend } from '../../components/ui';
import { useAuth } from '../../app/auth';
import { ConversionsChart, Legend, Sparkline, TrafficChart } from '../analytics/charts';
import { NotConfiguredCard, PeriodPicker } from '../analytics/Analytics';
import { DEFINITIONS, useReport, type Metrics, type PeriodKey } from '../analytics/report';
import { actionLabel } from '../publications/Publications';
import { STATUS_LABEL } from '../publications/publish';

function KpiTile({ label, k, cur, prev, fmt, invert, series, spark }: { label: string; k: keyof Metrics; cur: Metrics | null; prev: Metrics | null; fmt: (n: number | null) => string; invert?: boolean; series: { date: string; [k: string]: number | string | null }[]; spark?: 'visitors' | 'pageviews' | 'conversions' }) {
  const c = cur ? (cur[k] as number | null) : null;
  return (
    <Card bodyClass="kpi">
      <span className="label" title={DEFINITIONS[k]}>{label}</span>
      <span className="value">{fmt(c)}</span>
      <span className="row small"><Trend value={delta(c, prev ? (prev[k] as number | null) : null)} invert={invert} /><span className="faint">vs période préc.</span></span>
      {spark && <Sparkline data={series} k={spark} />}
    </Card>
  );
}

function Health() {
  const live = useAsync(async () => {
    const t0 = performance.now();
    const res = await fetch(new URL(`index.html?health=${Date.now()}`, siteBase), { method: 'HEAD', cache: 'no-store' });
    return { ok: res.ok, ms: Math.round(performance.now() - t0), pub: await livePublication() };
  }, []);
  const db = useAsync(async () => { await api.settings(); return true; }, []);
  const pubs = useAsync(() => api.publications(1), []);
  const analytics = useAsync(async () => {
    const r = await import('../../lib/supabase').then((m) => m.invoke<{ configured: boolean; fetchedAt?: string }>('analytics', { period: 'today' }));
    return r;
  }, []);
  const line = (label: string, state: 'ok' | 'warn' | 'bad' | 'loading', detail: string) => (
    <div className="list-item">
      {state === 'loading' ? <span className="spinner" /> : state === 'ok' ? <CheckCircle2 size={16} color="var(--success)" /> : state === 'warn' ? <AlertTriangle size={16} color="var(--warning)" /> : <XCircle size={16} color="var(--danger)" />}
      <span className="grow">{label}</span><span className="small muted">{detail}</span>
    </div>
  );
  const last = pubs.data?.[0];
  return (
    <Card title="Santé du site" subtitle="Vérifications réelles effectuées à l'ouverture">
      <div className="list">
        {line('Site public en ligne', live.loading ? 'loading' : live.data?.ok ? 'ok' : 'bad', live.loading ? '' : live.data?.ok ? `répond en ${live.data.ms} ms` : 'injoignable')}
        {line('Base de données & authentification', db.loading ? 'loading' : db.data ? 'ok' : 'bad', db.error ? errorMessage(db.error) : 'opérationnelles')}
        {line('Dernière publication', pubs.loading ? 'loading' : !last ? 'warn' : last.status === 'failed' ? 'bad' : last.status === 'succeeded' ? 'ok' : 'warn', last ? `${STATUS_LABEL[last.status]} · ${ago(last.requested_at)}` : 'aucune')}
        {line('Version publiée vérifiée', live.loading ? 'loading' : live.data?.pub ? 'ok' : 'warn', live.data?.pub ? `build ${ago(live.data.pub.built_at)}` : 'déploiement CMS non actif')}
        {line('Analytics (Plausible)', analytics.loading ? 'loading' : analytics.error ? 'bad' : analytics.data?.configured ? 'ok' : 'warn', analytics.error ? 'erreur' : analytics.data?.configured ? `synchronisé ${ago(analytics.data.fetchedAt)}` : 'non configuré')}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [range, setRange] = useState({ from: '', to: '' });
  const [view, setView] = useState<'traffic' | 'conversions'>('traffic');
  const { data, error, loading } = useReport(period, range);
  const pages = useAsync(() => api.pages(), []);
  const audit = useAsync(() => api.audit(8), []);
  const pubs = useAsync(() => api.publications(5), []);
  const profiles = useAsync(() => api.profiles(), []);
  const { profile, isAdmin } = useAuth();
  const nav = useNavigate();
  const r = data && data.configured ? data : null;
  const cur = r?.summary.current ?? null;
  const prev = r?.summary.previous ?? null;
  const content = (pages.data || []).filter((p) => p.slug !== '_global');
  const pending = (pages.data || []).filter((p) => p.has_unpublished_changes && p.status !== 'archived');
  const lastPub = pubs.data?.find((p) => p.status === 'succeeded');
  const lastEdit = [...(pages.data || [])].sort((a, b) => b.draft_updated_at.localeCompare(a.draft_updated_at))[0];
  const who = (id: string | null) => profiles.data?.find((p) => p.id === id)?.display_name || profiles.data?.find((p) => p.id === id)?.email || 'Système';
  const top = (r?.pages || []).slice(0, 5);
  const totalViews = cur?.pageviews || 0;
  const hour = new Date().getHours();

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>{hour < 18 ? 'Bonjour' : 'Bonsoir'}{profile?.display_name ? `, ${profile.display_name}` : ''}</h1><p>Vue d'ensemble du site et de son activité.</p></div>
        <PeriodPicker period={period} setPeriod={setPeriod} range={range} setRange={setRange} />
      </div>

      {error && <Notice tone="danger" title="Statistiques indisponibles">{errorMessage(error)}</Notice>}
      {data && !data.configured && <NotConfiguredCard data={data} />}
      {loading && !data && <div className="grid g-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={130} />)}</div>}
      {r && (
        <>
          <div className="grid g-4">
            <KpiTile label="Visiteurs uniques" k="visitors" cur={cur} prev={prev} fmt={num} series={r.timeseries} spark="visitors" />
            <KpiTile label="Pages vues" k="pageviews" cur={cur} prev={prev} fmt={num} series={r.timeseries} spark="pageviews" />
            <KpiTile label="Taux de rebond" k="bounceRate" cur={cur} prev={prev} fmt={(n) => pct(n, 0)} invert series={r.timeseries} />
            <KpiTile label="Conversions" k="conversions" cur={cur} prev={prev} fmt={num} series={r.timeseries} spark={cur?.conversions != null ? 'conversions' : undefined} />
          </div>
          <div className="grid g-main">
            <Card title={view === 'traffic' ? 'Trafic' : 'Conversions'} actions={<>
              {view === 'traffic' && <Legend keys={['visitors', 'pageviews']} />}
              <Segmented label="Série" value={view} onChange={setView} options={[{ value: 'traffic', label: 'Trafic' }, { value: 'conversions', label: 'Conversions' }]} />
            </>}>
              {view === 'traffic' ? <TrafficChart data={r.timeseries} /> : cur?.conversions == null ? <p className="muted small">Aucun événement n'est encore défini comme conversion (Paramètres → Conversions).</p> : <ConversionsChart data={r.timeseries} />}
            </Card>
            <Card title="Pages populaires" actions={<Link className="btn sm ghost" to="/analytics">Tout voir</Link>}>
              {top.length ? (
                <div className="list">
                  {top.map((p) => {
                    const file = p.page.split('/').pop() || '';
                    const pg = content.find((x) => x.slug === (file ? file.replace(/\.html$/, '') : 'index'));
                    const share = totalViews ? (p.pageviews / totalViews) * 100 : 0;
                    return (
                      <div key={p.page} className="list-item" style={{ display: 'grid', gap: 6 }}>
                        <div className="row between"><span className="truncate"><b>{pg?.title || p.page}</b> <span className="mono faint">{p.page}</span></span><span className="small"><b>{num(p.pageviews)}</b> <span className="muted">· {pct(share, 0)}</span></span></div>
                        <div className="progress"><span style={{ width: `${share}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="muted small">Aucune page vue sur la période.</p>}
            </Card>
          </div>
        </>
      )}

      <div className="grid g-3">
        <Card title="Activité du CMS">
          <div className="grid g-2" style={{ gap: 12 }}>
            <div className="stack-sm"><span className="small muted">Pages publiées</span><b style={{ fontSize: 22 }}>{pages.data ? content.filter((p) => p.status === 'published').length : '—'}</b></div>
            <div className="stack-sm"><span className="small muted">Brouillons en attente</span><b style={{ fontSize: 22 }}>{pages.data ? pending.length : '—'}</b></div>
            <div className="stack-sm"><span className="small muted">Dernière publication</span><b>{lastPub ? ago(lastPub.completed_at) : 'Aucune'}</b></div>
            <div className="stack-sm"><span className="small muted">Dernière modification</span><b className="truncate">{lastEdit ? `${lastEdit.slug === '_global' ? 'En-tête/pied' : lastEdit.title} · ${ago(lastEdit.draft_updated_at)}` : '—'}</b></div>
          </div>
        </Card>
        <Card title="Modifications récentes" actions={<Link className="btn sm ghost" to="/publications">Historique</Link>}>
          {audit.data?.length ? (
            <div className="list">{audit.data.slice(0, 5).map((a) => {
              const pg = pages.data?.find((p) => p.id === a.entity_id);
              return <div key={a.id} className="list-item"><span className="icon-tile"><PenLine /></span><div className="grow"><div className="truncate small"><b>{actionLabel(a.action)}</b> {pg?.title || a.summary}</div><div className="small faint">{who(a.actor)} · {ago(a.created_at)}</div></div></div>;
            })}</div>
          ) : <p className="muted small">{audit.loading ? 'Chargement…' : 'Aucune activité pour l\'instant.'}</p>}
        </Card>
        <Health />
      </div>

      <Card title="Actions rapides">
        <div className="row">
          <Button variant="primary" icon={<MousePointerClick />} onClick={() => nav('/editor')}>Modifier le site</Button>
          <Button icon={<BarChart3 />} onClick={() => nav('/analytics')}>Voir les statistiques</Button>
          <Button icon={<FileText />} onClick={() => nav('/pages')}>Gérer les pages</Button>
          <a className="btn" href={siteBase} target="_blank" rel="noopener"><ExternalLink size={15} />Voir le site public</a>
          {isAdmin && pending.length > 0 && <Button variant="accent" icon={<Rocket />} onClick={() => nav('/publications')}>Publier {pending.length} page(s)</Button>}
        </div>
        {pending.length > 0 && <p className="small muted" style={{ marginTop: 10 }}><Clock size={12} /> En attente : {pending.map((p) => p.slug === '_global' ? 'en-tête/pied' : p.title).join(', ')}</p>}
        {!!pubs.data?.length && pubs.data[0].status !== 'succeeded' && <div style={{ marginTop: 10 }}><Badge tone={pubs.data[0].status === 'failed' ? 'danger' : 'info'} dot><Activity size={11} /> Publication : {STATUS_LABEL[pubs.data[0].status]}</Badge></div>}
      </Card>
    </div>
  );
}
