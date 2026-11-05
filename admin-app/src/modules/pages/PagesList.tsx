import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Copy, Eye, FilePlus2, FileText, MousePointerClick, PanelsTopLeft, Search, ArrowUpDown } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { ago, dateTime } from '../../lib/format';
import { useAsync } from '../../components/hooks';
import { Badge, Button, Card, Empty, Field, Modal, Notice, Segmented, Skeleton, useConfirm, useToast } from '../../components/ui';
import { useAuth } from '../../app/auth';
import type { PageRow, PageStatus } from '../../lib/types';

export function StatusBadge({ p }: { p: PageRow }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <Badge tone={p.status === 'published' ? 'success' : p.status === 'archived' ? 'warning' : undefined} dot>{p.status === 'published' ? 'Publié' : p.status === 'archived' ? 'Archivé' : 'Brouillon'}</Badge>
      {p.has_unpublished_changes && p.status !== 'archived' && <Badge tone="info">Modifié</Badge>}
    </span>
  );
}

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function DuplicateDialog({ pages, source, onClose, onDone }: { pages: PageRow[]; source?: PageRow; onClose: () => void; onDone: (id: string) => void }) {
  const candidates = pages.filter((p) => p.slug !== '_global');
  const [src, setSrc] = useState(source?.id || candidates[0]?.id);
  const [title, setTitle] = useState(source ? `${source.title} (copie)` : '');
  const [slug, setSlug] = useState(source ? `${source.slug}-copie` : '');
  const [touched, setTouched] = useState(!!source);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && title.trim().length > 0;
  async function go() {
    setBusy(true); setError(null);
    try { onDone(await api.duplicatePage(src!, slug, title.trim())); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={source ? 'Dupliquer la page' : 'Nouvelle page'} onClose={onClose} footer={<><Button onClick={onClose}>Annuler</Button><Button variant="primary" disabled={!valid} loading={busy} onClick={go}>Créer le brouillon</Button></>}>
      <Notice>Le site n'ayant pas de système de gabarits, une nouvelle page reprend la mise en page d'une page existante, dont vous modifiez ensuite les contenus. Elle reste un brouillon invisible jusqu'à sa publication ; pensez à l'ajouter à la navigation si nécessaire.</Notice>
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Page modèle"><select className="select" value={src} onChange={(e) => setSrc(e.target.value)}>{candidates.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
      <Field label="Nom de la page"><input className="input" value={title} onChange={(e) => { setTitle(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} /></Field>
      <Field label="Adresse (slug)" hint={`URL : …/${slug || 'adresse'}.html`}><input className="input mono" value={slug} aria-invalid={!!slug && !valid} onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} /></Field>
    </Modal>
  );
}

type SortKey = 'title' | 'slug' | 'updated_at';
export default function PagesList() {
  const { data, error, loading, reload } = useAsync(() => api.pages(), []);
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | PageStatus>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'title', dir: 1 });
  const [dup, setDup] = useState<PageRow | 'new' | null>(null);
  const global = data?.find((p) => p.slug === '_global');
  const rows = useMemo(() => (data || [])
    .filter((p) => p.slug !== '_global' && (status === 'all' || p.status === status) && (p.title + ' ' + p.slug).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(a[sort.key]).localeCompare(String(b[sort.key]), 'fr') * sort.dir), [data, q, status, sort]);

  async function toggleArchive(p: PageRow) {
    const arch = p.status !== 'archived';
    if (arch && !(await confirm({ title: 'Archiver la page ?', danger: true, confirm: 'Archiver', text: `« ${p.title} » sera retirée du site public à la prochaine publication. Son contenu et son historique sont conservés ; vous pourrez la restaurer.` }))) return;
    try { await api.setArchived(p.id, arch); toast({ tone: 'success', title: arch ? 'Page archivée' : 'Page restaurée', text: 'Effectif après la prochaine publication.' }); reload(); }
    catch (e) { toast({ tone: 'error', title: 'Action impossible', text: errorMessage(e) }); }
  }
  const th = (key: SortKey, label: string) => <th><button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}>{label}<ArrowUpDown size={12} /></button></th>;

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Pages</h1><p>Contenus du site public : brouillons, publication et historique.</p></div>
        {isAdmin && <Button variant="primary" icon={<FilePlus2 />} onClick={() => setDup('new')}>Nouvelle page</Button>}
      </div>
      {global && (
        <Card>
          <div className="list-item" style={{ padding: 0 }}>
            <span className="icon-tile accent"><PanelsTopLeft /></span>
            <div className="grow"><b>En-tête et pied de page</b><div className="small muted">Navigation, méga-menu, footer : partagés par toutes les pages · modifié {ago(global.draft_updated_at)}</div></div>
            <StatusBadge p={global} />
            <Link className="btn sm" to={`/pages/${global.id}`}>Modifier</Link>
          </div>
        </Card>
      )}
      <div className="row between">
        <div className="input-icon" style={{ flex: 1, maxWidth: 360, minWidth: 200 }}><Search /><input className="input" placeholder="Rechercher une page" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented label="Statut" value={status} onChange={setStatus} options={[{ value: 'all', label: 'Toutes' }, { value: 'published', label: 'Publiées' }, { value: 'draft', label: 'Brouillons' }, { value: 'archived', label: 'Archivées' }]} />
      </div>
      {error && <Notice tone="danger">{errorMessage(error)}</Notice>}
      <Card bodyClass="table-wrap">
        {loading && !data ? <div className="stack">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={34} />)}</div> : rows.length ? (
          <table className="table responsive">
            <thead><tr>{th('title', 'Page')}{th('slug', 'Adresse')}<th>Statut</th>{th('updated_at', 'Modifiée')}<th>Par</th><th className="actions">Actions</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/pages/${p.id}`} className="strong" style={{ color: 'var(--text)' }}>{p.title}</Link></td>
                  <td data-hide-mobile><code className="muted">{p.slug}.html</code></td>
                  <td><StatusBadge p={p} /></td>
                  <td data-hide-mobile title={dateTime(p.draft_updated_at)}>{ago(p.draft_updated_at)}</td>
                  <td data-hide-mobile className="muted">{p.updated_by_name || p.updated_by_email || '—'}</td>
                  <td className="actions">
                    <Button size="sm" variant="ghost" iconOnly title="Éditeur visuel" aria-label="Éditeur visuel" icon={<MousePointerClick />} onClick={() => nav(`/editor/${p.slug}`)} />
                    <Button size="sm" variant="ghost" iconOnly title="Formulaire et historique" aria-label="Détails" icon={<FileText />} onClick={() => nav(`/pages/${p.id}`)} />
                    <Button size="sm" variant="ghost" iconOnly title="Prévisualiser le brouillon" aria-label="Prévisualiser" icon={<Eye />} onClick={() => window.open(`#/preview/${p.slug}`, '_blank', 'noopener')} />
                    {isAdmin && <Button size="sm" variant="ghost" iconOnly title="Dupliquer" aria-label="Dupliquer" icon={<Copy />} onClick={() => setDup(p)} />}
                    {isAdmin && p.slug !== 'index' && <Button size="sm" variant="ghost" iconOnly title={p.status === 'archived' ? 'Restaurer' : 'Archiver'} aria-label={p.status === 'archived' ? 'Restaurer' : 'Archiver'} icon={p.status === 'archived' ? <ArchiveRestore /> : <Archive />} onClick={() => toggleArchive(p)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon={<FileText />} title="Aucune page">Aucune page ne correspond à ces filtres.</Empty>}
      </Card>
      {dup && data && <DuplicateDialog pages={data} source={dup === 'new' ? undefined : dup} onClose={() => setDup(null)} onDone={(id) => { setDup(null); toast({ tone: 'success', title: 'Brouillon créé' }); nav(`/pages/${id}`); }} />}
    </div>
  );
}
