import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Circle, ExternalLink, History, Loader2, Rocket, XCircle, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { livePublication, siteBase } from '../../lib/site';
import { errorMessage } from '../../lib/supabase';
import { ago, dateTime } from '../../lib/format';
import { useAsync, useInterval } from '../../components/hooks';
import { Badge, Button, Card, Empty, Notice, Spinner, Tabs, useConfirm, useToast } from '../../components/ui';
import { useAuth } from '../../app/auth';
import { publishPages, STATUS_LABEL, STEPS } from './publish';
import type { Publication } from '../../lib/types';

const ACTIVE = ['queued', 'building', 'deploying', 'verifying'];
const tone = (s: string) => (s === 'succeeded' ? 'success' : s === 'failed' || s === 'cancelled' ? 'danger' : 'info');
const ACTION_LABEL: Record<string, string> = {
  save_draft: 'Brouillon enregistré', restore_revision: 'Version restaurée', duplicate_page: 'Page dupliquée', archive_page: 'Page archivée',
  unarchive_page: 'Page restaurée', rename_page: 'Adresse modifiée', request_publication: 'Publication demandée', publication_succeeded: 'Publication en ligne',
  publication_failed: 'Publication échouée', insert: 'Ajout', update: 'Modification', delete: 'Suppression', set_member: 'Rôle modifié',
  invite_member: 'Membre invité', remove_member: 'Membre supprimé',
};
export const actionLabel = (a: string) => ACTION_LABEL[a] || a;

/** Suivi en direct : statut en base + vérification indépendante du fichier servi en ligne. */
function Tracker({ pub, onDone }: { pub: Publication; onDone: () => void }) {
  const [p, setP] = useState(pub);
  const [live, setLive] = useState<'unknown' | 'match' | 'mismatch'>('unknown');
  const active = ACTIVE.includes(p.status);
  useInterval(async () => {
    try { setP(await api.publication(p.id)); } catch { /* réseau : on réessaie */ }
  }, active ? 3000 : null);
  useEffect(() => {
    if (p.status !== 'succeeded') return;
    livePublication().then((l) => setLive(l?.publication_id === p.id ? 'match' : 'mismatch'));
    onDone();
  }, [p.status, p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const idx = STEPS.indexOf(p.status as (typeof STEPS)[number]);
  return (
    <Card title="Publication en cours de suivi" subtitle={`Demandée ${ago(p.requested_at)} · ${p.manifest.length} page(s)`} actions={p.github_run_url && <a className="btn sm" href={p.github_run_url} target="_blank" rel="noopener"><ExternalLink size={14} />Journal GitHub</a>}>
      <div className="stack">
        <div className="grid g-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
          {STEPS.map((s, i) => {
            const done = p.status === 'succeeded' || (idx > i && p.status !== 'failed');
            const cur = idx === i && active;
            const Icon = p.status === 'failed' && i === Math.max(idx, 1) ? XCircle : done ? CheckCircle2 : cur ? Loader2 : Circle;
            return (
              <div key={s} className="stack-sm" style={{ justifyItems: 'center', textAlign: 'center' }}>
                <Icon size={20} style={{ color: done ? 'var(--success)' : cur ? 'var(--accent)' : p.status === 'failed' ? 'var(--danger)' : 'var(--faint)', animation: cur ? 'spin 1s linear infinite' : undefined }} />
                <span className="small">{STATUS_LABEL[s]}</span>
              </div>
            );
          })}
        </div>
        {p.status === 'failed' && <Notice tone="danger" title="La publication a échoué">{p.error || 'Erreur inconnue.'} Le site en ligne n'a pas changé.</Notice>}
        {p.status === 'succeeded' && live === 'match' && <Notice tone="success" title="Publication réussie">La nouvelle version est servie en ligne (vérifié via cms-publication.json). Le cache du navigateur peut nécessiter un rafraîchissement. <a href={siteBase} target="_blank" rel="noopener">Ouvrir le site</a></Notice>}
        {p.status === 'succeeded' && live === 'mismatch' && <Notice tone="warning" title="Publiée, propagation en cours">Le serveur a confirmé la publication, mais votre navigateur reçoit encore l'ancienne version (cache CDN, jusqu'à 10 min).</Notice>}
        {active && <span className="muted small">Ne fermez pas cette page si vous voulez suivre la progression ; la publication continue de toute façon côté serveur.</span>}
      </div>
    </Card>
  );
}

export default function Publications() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'pubs' | 'activity'>('pubs');
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const pubs = useAsync(() => api.publications(40), []);
  const pages = useAsync(() => api.pages(), []);
  const audit = useAsync(() => api.audit(100), []);
  const profiles = useAsync(() => api.profiles(), []);
  const live = useAsync(() => livePublication(), []);
  const [busy, setBusy] = useState(false);
  const trackId = params.get('id') || pubs.data?.find((p) => ACTIVE.includes(p.status))?.id;
  const tracked = pubs.data?.find((p) => p.id === trackId);
  const pending = (pages.data || []).filter((p) => p.has_unpublished_changes && p.status !== 'archived');
  const who = (id: string | null) => profiles.data?.find((p) => p.id === id)?.display_name || profiles.data?.find((p) => p.id === id)?.email || 'Système';

  async function publishAll() {
    const ok = await confirm({ title: 'Tout publier ?', confirm: 'Publier', text: <>{pending.length} page(s) avec des modifications non publiées seront mises en ligne : {pending.map((p) => p.title).join(', ')}.</> });
    if (!ok) return;
    setBusy(true);
    try { const id = await publishPages(null); setParams({ id }); await pubs.reload(); }
    catch (e) { toast({ tone: 'error', title: 'Publication impossible', text: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Publications</h1><p>Mise en ligne des brouillons et historique d'activité.</p></div>
        <Button variant="accent" icon={<Rocket />} disabled={!isAdmin || !pending.length || !!tracked && ACTIVE.includes(tracked.status)} loading={busy} onClick={publishAll} title={isAdmin ? undefined : 'Réservé aux administrateurs'}>
          Publier tout ({pending.length})
        </Button>
      </div>

      <div className="grid g-3">
        <Card><div className="stack-sm"><span className="muted small">Version servie en ligne</span>
          {live.loading ? <Spinner /> : live.data ? <><b>{live.data.publication_id ? <code>{live.data.publication_id.slice(0, 8)}</code> : 'Build sans publication CMS'}</b><span className="small muted">Construite {ago(live.data.built_at)}</span></> : <span className="small">Non vérifiable (fichier cms-publication.json absent : déploiement CMS pas encore actif)</span>}
        </div></Card>
        <Card><div className="stack-sm"><span className="muted small">Dernière publication réussie</span>
          {(() => { const s = pubs.data?.find((p) => p.status === 'succeeded'); return s ? <><b>{dateTime(s.completed_at)}</b><span className="small muted">par {who(s.requested_by)}</span></> : <b>Aucune</b>; })()}
        </div></Card>
        <Card><div className="stack-sm"><span className="muted small">En attente de publication</span><b>{pending.length} page(s)</b>
          <span className="small muted truncate">{pending.map((p) => p.title).join(', ') || 'Tout est en ligne'}</span></div></Card>
      </div>

      {tracked && <Tracker key={tracked.id} pub={tracked} onDone={() => { pages.reload(); audit.reload(); }} />}

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pubs', label: 'Publications' }, { value: 'activity', label: 'Historique d\'activité' }]} />
      {tab === 'pubs' ? (
        <Card bodyClass="table-wrap">
          {pubs.error && <Notice tone="danger">{errorMessage(pubs.error)}</Notice>}
          {pubs.data && !pubs.data.length ? <Empty icon={<Rocket />} title="Aucune publication">Les publications apparaîtront ici avec leur statut réel.</Empty> : (
            <table className="table responsive">
              <thead><tr><th>Date</th><th>Statut</th><th>Pages</th><th>Auteur</th><th>Détail</th></tr></thead>
              <tbody>
                {(pubs.data || []).map((p) => (
                  <tr key={p.id}>
                    <td>{dateTime(p.requested_at)}</td>
                    <td><Badge tone={tone(p.status)} dot>{STATUS_LABEL[p.status]}</Badge></td>
                    <td className="small">{p.manifest.map((m) => m.slug === '_global' ? 'en-tête/pied' : m.slug).join(', ') || '—'}</td>
                    <td data-hide-mobile>{who(p.requested_by)}</td>
                    <td className="actions">
                      {p.github_run_url && <a className="btn sm ghost" href={p.github_run_url} target="_blank" rel="noopener"><ExternalLink size={14} /></a>}
                      <Button size="sm" variant="ghost" onClick={() => setParams({ id: p.id })}>Suivre</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card>
          {audit.data && !audit.data.length ? <Empty icon={<History />} title="Aucune activité" /> : (
            <div className="list">
              {(audit.data || []).map((a) => {
                const page = pages.data?.find((p) => p.id === a.entity_id);
                return (
                  <div key={a.id} className="list-item">
                    <span className="icon-tile"><ShieldCheck /></span>
                    <div className="grow">
                      <div className="truncate"><b>{actionLabel(a.action)}</b> {page ? <Link to={`/pages/${page.id}`}>{page.title}</Link> : <span className="muted">{a.summary}</span>}
                        {'version' in a.details && <span className="faint small"> · v{String(a.details.version)}</span>}</div>
                      <div className="small muted">{who(a.actor)} · {dateTime(a.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
