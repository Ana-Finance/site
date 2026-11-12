import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, EyeOff, Hand, Layers, Monitor, MousePointerClick, Redo2, Rocket, Save, Search, Smartphone, Tablet, Undo2, ExternalLink, PanelLeft, Globe2 } from 'lucide-react';
import { isSectionHidden, mergeContent, type ModelField } from '@cms';
import { usePageDraft } from '../../lib/draft';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { useAuth } from '../../app/auth';
import { useAsync } from '../../components/hooks';
import { Badge, Button, Empty, Notice, Segmented, Spinner, useConfirm, useToast } from '../../components/ui';
import { FieldEditor, fieldPreview, TYPE_LABEL } from './FieldEditor';
import { PreviewFrame, type Device, type FrameHandle } from './PreviewFrame';
import { publishPages } from '../publications/publish';
import type { PageRow } from '../../lib/types';

const REGION_LABEL: Record<string, string> = { header: 'En-tête (toutes les pages)', footer: 'Pied de page', page: 'Hors sections' };

export default function Editor() {
  const { slug: routeSlug } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const slug = routeSlug || 'index';
  const pages = useAsync(() => api.pages(), []);
  const d = usePageDraft(slug === '_global' ? 'index' : slug);
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const frame = useRef<FrameHandle>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [mode, setMode] = useState<'edit' | 'interact'>('edit');
  const [selected, setSelected] = useState<string | null>(params.get('field'));
  const [section, setSection] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sideOpen, setSideOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const st = d.state;
  const merged = useMemo(() => (st ? mergeContent(st.globalContent, st.content) : null), [st]);
  const field = st?.model.fields.find((f) => f.key === selected) || null;
  const changed = d.changedKeys();

  useEffect(() => { const f = params.get('field'); if (f) setSelected(f); }, [params]);

  const select = useCallback((sel: { key?: string; section?: string }) => {
    setSelected(sel.key ?? null);
    setSection(sel.section ?? null);
  }, []);

  const save = useCallback(async () => {
    try { await d.save(); toast({ tone: 'success', title: 'Brouillon enregistré', text: 'Visible uniquement dans l\'administration.' }); return true; }
    catch (e) { toast({ tone: 'error', title: 'Enregistrement impossible', text: errorMessage(e) }); return false; }
  }, [d, toast]);

  // Raccourcis clavier : annuler, rétablir, enregistrer.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const inField = /INPUT|TEXTAREA/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if (e.key.toLowerCase() === 's') { e.preventDefault(); if (d.dirty) save(); }
      else if (!inField && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) d.redo(); else d.undo(); }
      else if (!inField && e.key.toLowerCase() === 'y') { e.preventDefault(); d.redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [d, save]);

  async function publish() {
    if (!st) return;
    if (d.dirty && !(await save())) return;
    const fresh = await api.pages();
    const targets = fresh.filter((p) => (p.id === st.page.id || p.slug === '_global') && p.has_unpublished_changes);
    if (!targets.length) { toast({ tone: 'info', title: 'Rien à publier', text: 'Cette page est identique à la version en ligne.' }); return; }
    const ok = await confirm({ title: 'Publier sur le site public ?', confirm: 'Publier', text: <>Les modifications de {targets.map((t) => <b key={t.id}>« {t.title} » </b>)} seront mises en ligne. Le site est reconstruit (1 à 3 minutes) ; la réussite n'est annoncée qu'une fois la nouvelle version vérifiée en ligne.</> });
    if (!ok) return;
    setPublishing(true);
    try {
      const id = await publishPages(targets.map((t) => t.id));
      nav(`/publications?id=${id}`);
    } catch (e) { toast({ tone: 'error', title: 'Publication impossible', text: errorMessage(e) }); }
    finally { setPublishing(false); }
  }

  const sectionsOrder = st ? (st.content.sections?.order?.length ? st.content.sections.order : st.model.sections.map((s) => s.key)) : [];
  // Sections masquées par le contenu, ou masquées par défaut dans le HTML et pas encore affichées (sections.shown).
  const explicitHidden = st?.content.sections?.hidden || [];
  const shown = st?.content.sections?.shown || [];
  const byDefault = (key: string) => !!st?.model.sections.find((s) => s.key === key)?.hiddenByDefault;
  const hidden = new Set(sectionsOrder.filter((k) => isSectionHidden(st?.content.sections, k, byDefault(k))));
  const moveSection = (key: string, dir: -1 | 1) => {
    const order = [...sectionsOrder];
    const i = order.indexOf(key); const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    d.setSections({ ...st?.content.sections, order, hidden: explicitHidden });
  };
  const toggleSection = (key: string) => {
    const without = (list: string[]) => list.filter((k) => k !== key);
    const next = hidden.has(key)
      ? { hidden: without(explicitHidden), shown: byDefault(key) ? [...without(shown), key] : shown }
      : byDefault(key) ? { hidden: explicitHidden, shown: without(shown) } : { hidden: [...explicitHidden, key], shown };
    d.setSections({ order: sectionsOrder, hidden: next.hidden, ...(next.shown.length ? { shown: next.shown } : {}) });
  };

  const groups = useMemo(() => {
    if (!st) return [];
    const q = filter.trim().toLowerCase();
    const list = st.model.fields.filter((f) => !q || (f.label + ' ' + fieldPreview(f, d.valueOf(f.key))).toLowerCase().includes(q));
    const by = new Map<string, ModelField[]>();
    list.forEach((f) => { const k = f.region === 'section' ? f.section! : f.region; if (!by.has(k)) by.set(k, []); by.get(k)!.push(f); });
    const secLabel = new Map(st.model.sections.map((s) => [s.key, s.label]));
    return [...by.entries()].map(([k, fields]) => ({ key: k, label: secLabel.get(k) ? `Section — ${secLabel.get(k)}` : REGION_LABEL[k] || k, fields }));
  }, [st, filter, d]);

  if (d.error) return <div className="content"><Notice tone="danger" title="Impossible d'ouvrir la page">{errorMessage(d.error)}</Notice></div>;
  if (!st || !merged) return <div className="content"><Spinner label="Chargement de l'éditeur…" /></div>;

  const file = st.page.file_path || st.page.template_path || 'index.html';
  const pageList = (pages.data || []).filter((p) => p.slug !== '_global');
  const selVisible = selected ? frame.current?.isVisible(selected) : true;

  return (
    <div className="editor">
      <aside className={'editor-side' + (sideOpen ? ' open' : '')} aria-label="Structure de la page">
        <div className="panel-section">
          <div className="row between"><h3><Layers size={13} /> Sections</h3><Button className="mobile-only" size="sm" variant="ghost" onClick={() => setSideOpen(false)}>Fermer</Button></div>
          <div className="stack-sm">
            {sectionsOrder.map((k, i) => {
              const s = st.model.sections.find((x) => x.key === k);
              if (!s) return null;
              return (
                <div key={k} className={'section-item' + (section === k ? ' active' : '') + (hidden.has(k) ? ' is-hidden' : '')}>
                  <span className="grow truncate" role="button" tabIndex={0} onClick={() => { select({ section: k }); frame.current?.scrollTo(k, true); }} onKeyDown={(e) => e.key === 'Enter' && frame.current?.scrollTo(k, true)}>{s.label}</span>
                  <Button size="sm" variant="ghost" iconOnly aria-label="Monter" disabled={i === 0} onClick={() => moveSection(k, -1)} icon={<ArrowUp />} />
                  <Button size="sm" variant="ghost" iconOnly aria-label="Descendre" disabled={i === sectionsOrder.length - 1} onClick={() => moveSection(k, 1)} icon={<ArrowDown />} />
                  <Button size="sm" variant="ghost" iconOnly aria-label={hidden.has(k) ? 'Afficher la section' : 'Masquer la section'} onClick={() => toggleSection(k)} icon={hidden.has(k) ? <EyeOff /> : <Eye />} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel-section">
          <h3>Champs éditables</h3>
          <div className="input-icon"><Search /><input className="input" placeholder="Filtrer" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
          {groups.map((g) => (
            <div key={g.key} className="stack-sm">
              <span className="small faint strong">{g.label}</span>
              {g.fields.map((f) => (
                <button key={f.key} className={'field-item' + (changed.has(f.key) ? ' changed' : '')} aria-selected={f.key === selected}
                  onClick={() => { select({ key: f.key, section: f.section || undefined }); frame.current?.scrollTo(f.key); setSideOpen(false); }}>
                  <b>{f.label}</b><span>{fieldPreview(f, d.valueOf(f.key))}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="editor-stage">
        <div className="editor-toolbar">
          <Button className="mobile-only" size="sm" iconOnly variant="ghost" aria-label="Structure" icon={<PanelLeft />} onClick={() => setSideOpen(true)} />
          <select className="select" style={{ width: 'auto', maxWidth: 220, height: 30 }} value={slug} aria-label="Page à modifier"
            onChange={async (e) => {
              if (d.dirty && !(await confirm({ title: 'Modifications non enregistrées', text: 'Quitter cette page sans enregistrer le brouillon ?', confirm: 'Quitter', danger: true }))) return;
              nav(`/editor/${e.target.value}`);
            }}>
            {pageList.map((p: PageRow) => <option key={p.id} value={p.slug}>{p.title}{p.status !== 'published' ? ` (${p.status === 'draft' ? 'brouillon' : 'archivée'})` : ''}</option>)}
          </select>
          <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'edit', label: 'Éditer', icon: <MousePointerClick /> }, { value: 'interact', label: 'Naviguer', icon: <Hand /> }]} />
          <Segmented label="Appareil" value={device} onChange={setDevice} options={[
            { value: 'desktop', label: <span className="desktop-only">Desktop</span>, icon: <Monitor /> },
            { value: 'tablet', label: <span className="desktop-only">Tablette</span>, icon: <Tablet /> },
            { value: 'mobile', label: <span className="desktop-only">Mobile</span>, icon: <Smartphone /> },
          ]} />
          <div style={{ flex: 1 }} />
          <Button size="sm" variant="ghost" iconOnly aria-label="Annuler (Ctrl+Z)" title="Annuler (Ctrl+Z)" disabled={!d.canUndo} onClick={d.undo} icon={<Undo2 />} />
          <Button size="sm" variant="ghost" iconOnly aria-label="Rétablir (Ctrl+Maj+Z)" title="Rétablir" disabled={!d.canRedo} onClick={d.redo} icon={<Redo2 />} />
          <Button size="sm" icon={<ExternalLink />} onClick={async () => { if (d.dirty && !(await save())) return; window.open(`#/preview/${slug}`, '_blank', 'noopener'); }}>Prévisualiser</Button>
          <Button size="sm" icon={<Save />} disabled={!d.dirty} loading={d.saving} onClick={save}>Enregistrer</Button>
          <Button size="sm" variant="accent" icon={<Rocket />} disabled={!isAdmin} loading={publishing} title={isAdmin ? 'Publier sur le site public' : 'Publication réservée aux administrateurs'} onClick={publish}>Publier</Button>
        </div>
        {d.conflict && (
          <div style={{ padding: '8px 12px' }}>
            <Notice tone="danger" title="Conflit de modification">
              Quelqu'un a enregistré cette page pendant votre édition. Vos changements n'ont pas été écrits. <Button size="sm" onClick={() => d.reload()}>Recharger la dernière version</Button>
            </Notice>
          </div>
        )}
        <div className="editor-canvas">
          <PreviewFrame ref={frame} file={file} content={merged} device={device} mode={mode} selectedKey={selected} selectedSection={section} onSelect={select} />
        </div>
      </div>

      <aside className="editor-props" aria-label="Propriétés">
        <div className="panel-section">
          <div className="row between">
            <h3>Page</h3>
            <Badge tone={st.page.status === 'published' ? 'success' : st.page.status === 'archived' ? 'warning' : undefined} dot>{st.page.status === 'published' ? 'Publiée' : st.page.status === 'archived' ? 'Archivée' : 'Brouillon'}</Badge>
          </div>
          <div className="row between small"><span className="muted">{st.page.title}</span><span className="faint">v{st.version}</span></div>
          {d.dirty ? <Badge tone="warning" dot>Modifications non enregistrées</Badge> : st.page.has_unpublished_changes ? <Badge tone="info" dot>Brouillon non publié</Badge> : <Badge tone="success" dot>Identique à la version en ligne</Badge>}
        </div>
        {field ? (
          <div className="panel-section">
            <div className="row between"><h3>{TYPE_LABEL[field.type]}</h3>{field.global && <Badge tone="accent"><Globe2 size={11} /> Toutes les pages</Badge>}</div>
            <span className="small muted">{field.label} · <code>{field.key}</code></span>
            {selVisible === false && <Notice>Cet élément n'est pas visible actuellement (menu fermé, version mobile ou section masquée). Les modifications s'appliquent quand même.</Notice>}
            {field.global && <Notice tone="warning">Élément partagé : la modification s'applique à l'en-tête ou au pied de page de tout le site.</Notice>}
            <FieldEditor key={field.key} field={field} value={d.valueOf(field.key) || {}} pages={pages.data || []} onChange={(v) => d.setField(field.key, v)} />
            {changed.has(field.key) && <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => d.undo()}>Annuler la dernière modification</Button>}
          </div>
        ) : section ? (
          <div className="panel-section">
            <h3>Section</h3>
            <b>{st.model.sections.find((s) => s.key === section)?.label}</b>
            <div className="row">
              <Button size="sm" icon={<ArrowUp />} onClick={() => moveSection(section, -1)}>Monter</Button>
              <Button size="sm" icon={<ArrowDown />} onClick={() => moveSection(section, 1)}>Descendre</Button>
              <Button size="sm" icon={hidden.has(section) ? <Eye /> : <EyeOff />} onClick={() => toggleSection(section)}>{hidden.has(section) ? 'Afficher' : 'Masquer'}</Button>
            </div>
            <span className="hint">Cliquez sur un texte, une image ou un bouton de la section pour le modifier.</span>
          </div>
        ) : (
          <Empty icon={<MousePointerClick />} title="Sélectionnez un élément">Survolez l'aperçu : les éléments modifiables sont entourés. Cliquez pour modifier le texte, une image, un lien ou une section.</Empty>
        )}
      </aside>
    </div>
  );
}
