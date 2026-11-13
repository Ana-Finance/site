// État d'édition d'une page : brouillon de la page + brouillon partagé (_global), historique annuler/rétablir,
// enregistrement avec verrou optimiste. Utilisé par l'éditeur visuel, le formulaire de page et le SEO.
import { useCallback, useEffect, useRef, useState } from 'react';
import { extractModel, type Content, type FieldValue, type Model, type Seo } from '@cms';
import { api } from './api';
import { fetchPageDocument } from './site';
import { AppError } from './supabase';
import type { PageRow } from './types';

type Snapshot = { page: Content; global: Content };
export type DraftState = {
  page: PageRow; global: PageRow | null; model: Model;
  content: Content; globalContent: Content; version: number; globalVersion: number;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function usePageDraft(pageSlug: string | null) {
  const [state, setState] = useState<DraftState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const saved = useRef<Snapshot | null>(null);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [, force] = useState(0);

  const load = useCallback(async () => {
    if (!pageSlug) return;
    setLoading(true); setError(null); setConflict(false);
    try {
      const page = await api.pageBySlug(pageSlug);
      if (!page) throw new AppError(`Page « ${pageSlug} » introuvable`);
      const global = page.slug === '_global' ? null : await api.pageBySlug('_global');
      const file = page.file_path || page.template_path || 'index.html'; // _global : lu depuis l'accueil
      const [draft, gdraft, doc] = await Promise.all([api.draft(page.id), global ? api.draft(global.id) : Promise.resolve(null), fetchPageDocument(file)]);
      const model = extractModel(doc);
      const base = clone(draft.content);
      const content: Content = { ...base, fields: base.fields || {}, sections: base.sections || { order: model.sections.map((s) => s.key), hidden: [] }, seo: base.seo || {} };
      // Titre et description révisés dans le HTML depuis le dernier enregistrement (cms:seo-rev) : on repart des
      // textes en ligne, et la révision est reprise pour que les prochaines modifications priment de nouveau.
      if ((model.seo.rev || 0) > (content.seo?.rev || 0)) {
        const { title, description, ogTitle, ogDescription, rev } = model.seo;
        content.seo = { ...content.seo, title, description, ogTitle, ogDescription, rev };
      }
      const globalContent: Content = gdraft ? clone(gdraft.content) : { fields: {} };
      setState({ page, global, model, content, globalContent, version: draft.version, globalVersion: gdraft?.version ?? 0 });
      saved.current = { page: clone(content), global: clone(globalContent) };
      past.current = []; future.current = [];
    } catch (e) { setError(e as Error); } finally { setLoading(false); }
  }, [pageSlug]);

  useEffect(() => { load(); }, [load]);

  const commit = useCallback((fn: (s: Snapshot) => Snapshot) => {
    setState((st) => {
      if (!st) return st;
      const prev = { page: st.content, global: st.globalContent };
      const next = fn(clone(prev));
      if (same(prev, next)) return st;
      past.current.push(prev);
      if (past.current.length > 150) past.current.shift();
      future.current = [];
      return { ...st, content: next.page, globalContent: next.global };
    });
  }, []);

  // Sur la pseudo-page _global elle-même, les clés g.* appartiennent à la page.
  const isGlobalPage = pageSlug === '_global';
  const setField = useCallback((key: string, value: FieldValue) => commit((s) => {
    if (key.startsWith('g.') && !isGlobalPage) s.global.fields[key] = value; else s.page.fields[key] = value;
    return s;
  }), [commit, isGlobalPage]);
  const setSeo = useCallback((patch: Partial<Seo>) => commit((s) => { s.page.seo = { ...(s.page.seo || {}), ...patch }; return s; }), [commit]);
  const setSections = useCallback((sections: NonNullable<Content['sections']>) => commit((s) => { s.page.sections = sections; return s; }), [commit]);

  const step = (from: React.MutableRefObject<Snapshot[]>, to: React.MutableRefObject<Snapshot[]>) => {
    setState((st) => {
      if (!st || !from.current.length) return st;
      to.current.push({ page: st.content, global: st.globalContent });
      const snap = from.current.pop()!;
      return { ...st, content: snap.page, globalContent: snap.global };
    });
    force((n) => n + 1);
  };
  const undo = useCallback(() => step(past, future), []);
  const redo = useCallback(() => step(future, past), []);

  const dirtyPage = !!state && !!saved.current && !same(state.content, saved.current.page);
  const dirtyGlobal = !!state && !!saved.current && !!state.global && !same(state.globalContent, saved.current.global);

  /** Enregistre le brouillon (page et/ou contenu partagé). Lève DRAFT_CONFLICT sans rien écraser. */
  const save = useCallback(async (message?: string) => {
    if (!state) return;
    setSaving(true);
    try {
      let { version, globalVersion } = state;
      if (!same(state.content, saved.current?.page)) {
        version = (await api.saveDraft(state.page.id, state.content, state.version, message)).version;
      }
      if (state.global && !same(state.globalContent, saved.current?.global)) {
        globalVersion = (await api.saveDraft(state.global.id, state.globalContent, state.globalVersion, message)).version;
      }
      saved.current = { page: clone(state.content), global: clone(state.globalContent) };
      setState((st) => (st ? { ...st, version, globalVersion } : st));
      setConflict(false);
    } catch (e) {
      if (String((e as Error).message).includes('DRAFT_CONFLICT')) setConflict(true);
      throw e;
    } finally { setSaving(false); }
  }, [state]);

  // Avertit avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirtyPage && !dirtyGlobal) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirtyPage, dirtyGlobal]);

  /** Valeur effective d'un champ (brouillon, sinon valeur en ligne lue dans le HTML). */
  const valueOf = useCallback((key: string): FieldValue | undefined => {
    if (!state) return undefined;
    const src = key.startsWith('g.') && state.global ? state.globalContent : state.content;
    return src.fields[key] ?? state.model.fields.find((f) => f.key === key)?.value;
  }, [state]);

  const changedKeys = useCallback(() => {
    const out = new Set<string>();
    if (!state || !saved.current) return out;
    for (const [k, v] of Object.entries(state.content.fields)) if (!same(v, saved.current.page.fields[k])) out.add(k);
    for (const [k, v] of Object.entries(state.globalContent.fields)) if (!same(v, saved.current.global.fields[k])) out.add(k);
    return out;
  }, [state]);

  return {
    state, error, loading, saving, conflict, reload: load,
    setField, setSeo, setSections, valueOf, changedKeys,
    undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0,
    dirty: dirtyPage || dirtyGlobal, dirtyPage, dirtyGlobal, save,
  };
}
export type PageDraftApi = ReturnType<typeof usePageDraft>;
