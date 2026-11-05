import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Eye, History, MousePointerClick, RotateCcw, Rocket, Save, Search, Settings2, Undo2, Redo2 } from 'lucide-react';
import { diffContent, type ModelField } from '@cms';
import { api } from '../../lib/api';
import { usePageDraft } from '../../lib/draft';
import { errorMessage } from '../../lib/supabase';
import { ago, dateTime } from '../../lib/format';
import { publicPageUrl } from '../../lib/site';
import { useAsync } from '../../components/hooks';
import { Badge, Button, Card, Empty, Field, Notice, Spinner, Tabs, useConfirm, useToast } from '../../components/ui';
import { useAuth } from '../../app/auth';
import { FieldEditor, fieldPreview } from '../editor/FieldEditor';
import { publishPages } from '../publications/publish';
import { StatusBadge } from './PagesList';
import type { Revision } from '../../lib/types';

const KIND: Record<Revision['kind'], string> = { seed: 'Contenu d\'origine', save: 'Enregistrement', publish: 'Publication', restore: 'Restauration', duplicate: 'Création par duplication' };

function HistoryTab({ pageId, version, current, onRestored }: { pageId: string; version: number; current: Parameters<typeof diffContent>[0]; onRestored: () => void }) {
  const revs = useAsync(() => api.revisions(pageId), [pageId, version]);
  const profiles = useAsync(() => api.profiles(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Record<string, number>>({});
  const toast = useToast();
  const confirm = useConfirm();
  async function compare(r: Revision) {
    const full = await api.revision(r.id);
    setDiffs((d) => ({ ...d, [r.id]: diffContent(current, full.content!).count }));
  }
  async function restore(r: Revision) {
    if (!(await confirm({ title: `Restaurer la version ${r.number} ?`, confirm: 'Restaurer dans le brouillon', text: 'Le brouillon actuel est remplacé par cette version (il reste disponible dans l\'historique). Rien n\'est mis en ligne avant publication.' }))) return;
    setBusy(r.id);
    try { await api.restoreRevision(r.id, version); toast({ tone: 'success', title: `Version ${r.number} restaurée dans le brouillon` }); onRestored(); }
    catch (e) { toast({ tone: 'error', title: 'Restauration impossible', text: errorMessage(e) }); } finally { setBusy(null); }
  }
  if (revs.loading && !revs.data) return <Spinner />;
  if (!revs.data?.length) return <Empty icon={<History />} title="Aucune version" />;
  const who = (id: string | null) => profiles.data?.find((p) => p.id === id)?.display_name || profiles.data?.find((p) => p.id === id)?.email || 'Système';
  return (
    <Card bodyClass="table-wrap">
      <table className="table responsive">
        <thead><tr><th>Version</th><th>Type</th><th>Auteur</th><th>Date</th><th>Écart avec le brouillon</th><th className="actions" /></tr></thead>
        <tbody>
          {revs.data.map((r) => (
            <tr key={r.id}>
              <td><b>v{r.number}</b>{r.message && <div className="small muted truncate" style={{ maxWidth: 280 }}>{r.message}</div>}</td>
              <td><Badge tone={r.kind === 'publish' ? 'success' : r.kind === 'restore' ? 'warning' : undefined}>{KIND[r.kind]}</Badge></td>
              <td data-hide-mobile>{who(r.created_by)}</td>
              <td data-hide-mobile title={dateTime(r.created_at)}>{ago(r.created_at)}</td>
              <td>{r.id in diffs ? (diffs[r.id] ? `${diffs[r.id]} élément(s)` : 'Identique') : <Button size="sm" variant="ghost" onClick={() => compare(r)}>Comparer</Button>}</td>
              <td className="actions"><Button size="sm" icon={<RotateCcw />} loading={busy === r.id} onClick={() => restore(r)}>Restaurer</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SettingsTab({ page, onChanged }: { page: { id: string; slug: string; title: string; is_system: boolean; status: string; published_revision_id: string | null }; onChanged: () => void }) {
  const { isAdmin } = useAuth();
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const locked = page.slug === 'index' || page.slug === '_global';
  async function save() {
    if (slug !== page.slug && !(await confirm({ title: 'Changer l\'adresse ?', confirm: 'Changer', text: page.published_revision_id ? `L'ancienne adresse ${page.slug}.html redirigera vers ${slug}.html. Les liens internes du site pointant vers l'ancienne adresse continueront de fonctionner via cette redirection, mais il est préférable de les mettre à jour.` : 'La page n\'étant pas encore publiée, aucune redirection n\'est nécessaire.' }))) return;
    setBusy(true);
    try { await api.renamePage(page.id, slug !== page.slug ? slug : null, title !== page.title ? title : null); toast({ tone: 'success', title: 'Réglages enregistrés', text: slug !== page.slug ? 'Effectif à la prochaine publication.' : undefined }); onChanged(); }
    catch (e) { toast({ tone: 'error', title: 'Enregistrement impossible', text: errorMessage(e) }); } finally { setBusy(false); }
  }
  return (
    <Card title="Réglages de la page" footer={isAdmin && <Button variant="primary" loading={busy} disabled={title === page.title && slug === page.slug} onClick={save}>Enregistrer</Button>}>
      <div className="stack">
        {!isAdmin && <Notice>Réglages modifiables par un administrateur.</Notice>}
        <Field label="Nom interne"><input className="input" value={title} disabled={!isAdmin} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Adresse (slug)" hint={locked ? 'Adresse protégée.' : 'Un changement crée une redirection depuis l\'ancienne adresse.'}>
          <input className="input mono" value={slug} disabled={!isAdmin || locked} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
        </Field>
      </div>
    </Card>
  );
}

export default function PageDetail() {
  const { id } = useParams();
  const row = useAsync(() => api.page(id!), [id]);
  const d = usePageDraft(row.data?.slug ?? null);
  const pages = useAsync(() => api.pages(), []);
  const [tab, setTab] = useState<'content' | 'history' | 'settings'>('content');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { isAdmin } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const st = d.state;
  const isGlobal = row.data?.slug === '_global';
  const changed = d.changedKeys();

  const groups = useMemo(() => {
    if (!st) return [];
    const nq = q.toLowerCase();
    const fields = st.model.fields.filter((f) => (isGlobal ? f.global : true) && (!nq || (f.label + fieldPreview(f, d.valueOf(f.key))).toLowerCase().includes(nq)));
    const secs = new Map(st.model.sections.map((s) => [s.key, s.label]));
    const map = new Map<string, { label: string; fields: ModelField[] }>();
    fields.forEach((f) => {
      const k = f.region === 'section' ? f.section! : f.region;
      const label = f.region === 'section' ? secs.get(k) || k : f.region === 'header' ? 'En-tête (partagé)' : f.region === 'footer' ? 'Pied de page' : 'Hors sections';
      if (!map.has(k)) map.set(k, { label, fields: [] });
      map.get(k)!.fields.push(f);
    });
    return [...map.entries()];
  }, [st, q, isGlobal, d]);

  if (row.error || d.error) return <div className="content"><Notice tone="danger">{errorMessage(row.error || d.error)}</Notice></div>;
  if (!row.data || !st) return <div className="content"><Spinner label="Chargement…" /></div>;

  async function save() {
    try { await d.save(); toast({ tone: 'success', title: 'Brouillon enregistré' }); row.reload(); }
    catch (e) { toast({ tone: 'error', title: 'Enregistrement impossible', text: errorMessage(e) }); }
  }
  async function publish() {
    if (d.dirty) await save();
    setPublishing(true);
    try {
      const fresh = await api.pages();
      const ids = fresh.filter((p) => (p.id === st!.page.id || (p.slug === '_global' && !isGlobal)) && p.has_unpublished_changes).map((p) => p.id);
      if (!ids.length) { toast({ tone: 'info', title: 'Rien à publier' }); return; }
      nav(`/publications?id=${await publishPages(ids)}`);
    } catch (e) { toast({ tone: 'error', title: 'Publication impossible', text: errorMessage(e) }); } finally { setPublishing(false); }
  }

  const p = row.data;
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="row small muted"><Link to="/pages">Pages</Link> /</div>
          <h1>{isGlobal ? 'En-tête et pied de page' : p.title}</h1>
          <div className="row" style={{ marginTop: 6 }}><StatusBadge p={p} />{!isGlobal && <a className="small" href={publicPageUrl(p.slug)} target="_blank" rel="noopener">{p.slug}.html</a>}<span className="small faint">· brouillon v{st.version} · modifié {ago(p.draft_updated_at)}</span></div>
        </div>
        <div className="row">
          {!isGlobal && <Button icon={<MousePointerClick />} onClick={() => nav(`/editor/${p.slug}`)}>Éditeur visuel</Button>}
          <Button icon={<Eye />} onClick={() => window.open(`#/preview/${isGlobal ? 'index' : p.slug}`, '_blank', 'noopener')}>Prévisualiser</Button>
          <Button icon={<Save />} disabled={!d.dirty} loading={d.saving} onClick={save}>Enregistrer</Button>
          {isAdmin && <Button variant="accent" icon={<Rocket />} loading={publishing} disabled={p.status === 'archived'} onClick={publish}>Publier</Button>}
        </div>
      </div>
      {d.conflict && <Notice tone="danger" title="Conflit">Cette page a été modifiée ailleurs. <Button size="sm" onClick={() => d.reload()}>Recharger</Button></Notice>}
      {p.status === 'archived' && <Notice tone="warning">Page archivée : elle n'est plus publiée sur le site après la dernière publication.</Notice>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'content', label: 'Contenu' }, { value: 'history', label: <span className="row"><History size={14} />Historique</span> }, ...(isGlobal ? [] : [{ value: 'settings' as const, label: <span className="row"><Settings2 size={14} />Réglages</span> }])]} />
      {tab === 'content' && (
        <div className="stack">
          <div className="row between">
            <div className="input-icon" style={{ flex: 1, maxWidth: 380 }}><Search /><input className="input" placeholder="Rechercher un texte" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="row">
              <Button size="sm" variant="ghost" icon={<Undo2 />} disabled={!d.canUndo} onClick={d.undo}>Annuler</Button>
              <Button size="sm" variant="ghost" icon={<Redo2 />} disabled={!d.canRedo} onClick={d.redo}>Rétablir</Button>
            </div>
          </div>
          {!isGlobal && st.model.fields.some((f) => f.global) && <Notice>Les éléments de l'en-tête et du pied de page sont partagés par tout le site ; les modifier ici les modifie partout.</Notice>}
          {groups.map(([k, g]) => {
            const isOpen = open[k] ?? (groups.length <= 3 || !!q);
            const n = g.fields.filter((f) => changed.has(f.key)).length;
            return (
              <Card key={k}>
                <button className="row between" style={{ all: 'unset', cursor: 'pointer', display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setOpen((o) => ({ ...o, [k]: !isOpen }))} aria-expanded={isOpen}>
                  <span className="row">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<b>{g.label}</b><span className="small muted">{g.fields.length} champ(s)</span></span>
                  {n > 0 && <Badge tone="warning">{n} modifié(s)</Badge>}
                </button>
                {isOpen && (
                  <div className="stack" style={{ marginTop: 14 }}>
                    {g.fields.map((f) => (
                      <div key={f.key} className="stack-sm" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                        <div className="row between small"><span className="strong">{f.label}</span><code className="faint">{f.key}</code></div>
                        <FieldEditor field={f} value={d.valueOf(f.key) || {}} pages={pages.data || []} onChange={(v) => d.setField(f.key, v)} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {tab === 'history' && <HistoryTab pageId={p.id} version={st.version} current={st.content} onRestored={() => { d.reload(); row.reload(); }} />}
      {tab === 'settings' && !isGlobal && <SettingsTab page={p} onChanged={() => row.reload()} />}
    </div>
  );
}
