import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Copy, ImagePlus, Replace, Search, Trash2, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { uploadMedia, replaceMedia } from '../../lib/upload';
import { errorMessage } from '../../lib/supabase';
import { bytes, dateTime } from '../../lib/format';
import { useAsync } from '../../components/hooks';
import { Badge, Button, Drawer, Empty, Field, Notice, Segmented, Skeleton, useConfirm, useToast } from '../../components/ui';
import { useAuth } from '../../app/auth';
import { withUrls } from './MediaPicker';
import type { Media } from '../../lib/types';

function Details({ m, onClose, onChanged }: { m: Media; onClose: () => void; onChanged: () => void }) {
  const [title, setTitle] = useState(m.title);
  const [alt, setAlt] = useState(m.alt);
  const [name, setName] = useState(m.file_name);
  const [busy, setBusy] = useState(false);
  const usage = useAsync(() => api.mediaUsage(m.id), [m.id]);
  const { isAdmin, profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const replaceInput = useRef<HTMLInputElement>(null);
  const canDelete = isAdmin || m.created_by === profile?.id;

  async function save() {
    setBusy(true);
    try { await api.updateMedia(m.id, { title, alt, file_name: name }); toast({ tone: 'success', title: 'Média mis à jour' }); onChanged(); }
    catch (e) { toast({ tone: 'error', title: 'Échec', text: errorMessage(e) }); } finally { setBusy(false); }
  }
  async function replace(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try { await replaceMedia(m, f); toast({ tone: 'success', title: 'Fichier remplacé', text: 'Les pages qui l\'utilisent afficheront la nouvelle image après publication.' }); onChanged(); onClose(); }
    catch (e) { toast({ tone: 'error', title: 'Remplacement impossible', text: errorMessage(e) }); } finally { setBusy(false); }
  }
  async function remove() {
    if (!(await confirm({ title: 'Supprimer ce média ?', danger: true, confirm: 'Supprimer', text: 'Le fichier est définitivement supprimé. Les anciennes versions de pages qui le référençaient ne pourront plus l\'afficher.' }))) return;
    setBusy(true);
    try { await api.deleteMedia(m); toast({ tone: 'success', title: 'Média supprimé' }); onChanged(); onClose(); }
    catch (e) { toast({ tone: 'error', title: 'Suppression refusée', text: errorMessage(e) }); usage.reload(); } finally { setBusy(false); }
  }

  return (
    <Drawer title="Détails du média" onClose={onClose} footer={<>
      {canDelete && <Button variant="danger" icon={<Trash2 />} disabled={busy || !!usage.data?.length} onClick={remove} style={{ marginRight: 'auto' }}>Supprimer</Button>}
      <Button onClick={onClose}>Fermer</Button>
      <Button variant="primary" loading={busy} onClick={save} disabled={title === m.title && alt === m.alt && name === m.file_name}>Enregistrer</Button>
    </>}>
      <div className="media-thumb" style={{ borderRadius: 12, border: '1px solid var(--border)' }}>{m.url && <img src={m.url} alt={m.alt} />}</div>
      <div className="row small muted">
        <span>{m.width} × {m.height} px</span>·<span>{bytes(m.size_bytes)}</span>·<span>{m.mime_type.replace('image/', '').toUpperCase()}</span>·<span>{dateTime(m.created_at)}</span>
      </div>
      <Field label="Titre (usage interne)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Nom logique du fichier" hint="Renommage logique : l'adresse du fichier ne change pas."><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Texte alternatif par défaut" hint="Proposé lors de l'insertion dans une page." counter={{ value: alt.length, max: 160 }}><textarea className="textarea" rows={2} value={alt} onChange={(e) => setAlt(e.target.value)} /></Field>
      <div className="stack-sm">
        <b className="small">Utilisation</b>
        {usage.loading ? <Skeleton /> : usage.data?.length ? usage.data.map((u) => <div key={u.page_id + u.where} className="row small"><Link to={`/pages/${u.page_id}`}>{u.title}</Link><Badge>{u.where}</Badge></div>) : <span className="small muted">Utilisé nulle part : peut être supprimé.</span>}
        {!!usage.data?.length && <span className="hint">Un média utilisé ne peut pas être supprimé ; remplacez-le dans les pages concernées d'abord.</span>}
      </div>
      <div className="row">
        <input ref={replaceInput} type="file" hidden accept={m.mime_type} onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ''; }} />
        <Button icon={<Replace />} onClick={() => replaceInput.current?.click()} disabled={busy}>Remplacer le fichier</Button>
        {m.url && <Button icon={<Copy />} variant="ghost" onClick={() => { navigator.clipboard.writeText(m.id); toast({ tone: 'info', title: 'Identifiant copié' }); }}>Copier l'identifiant</Button>}
      </div>
      <Notice>Bibliothèque privée : une image n'est rendue publique que lorsqu'une page qui l'utilise est publiée.</Notice>
    </Drawer>
  );
}

export default function MediaLibrary() {
  const { data, loading, error, reload } = useAsync(async () => withUrls(await api.media()), []);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'missing-alt'>('all');
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const sel = data?.find((m) => m.id === params.get('id')) || null;
  const list = useMemo(() => (data || []).filter((m) => (kind === 'all' || !m.alt) && (m.file_name + ' ' + m.title + ' ' + m.alt).toLowerCase().includes(q.toLowerCase())), [data, q, kind]);
  const total = (data || []).reduce((s, m) => s + m.size_bytes, 0);

  async function onFiles(files: FileList | File[] | null) {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    setUploading({ done: 0, total: arr.length });
    let ok = 0; let saved = 0;
    for (const f of arr) {
      try { const m = await uploadMedia(f); ok++; saved += Math.max(0, f.size - m.size_bytes); }
      catch (e) { toast({ tone: 'error', title: `« ${f.name} » refusé`, text: errorMessage(e) }); }
      setUploading((u) => u && { ...u, done: u.done + 1 });
    }
    setUploading(null);
    if (ok) toast({ tone: 'success', title: `${ok} image(s) ajoutée(s)`, text: saved > 1024 ? `${bytes(saved)} économisés par l'optimisation.` : undefined });
    reload();
  }
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => { window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent); };
  }, []);

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Médias</h1><p>{data ? `${data.length} image(s) · ${bytes(total)}` : 'Bibliothèque d\'images du site'}</p></div>
        <input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <Button variant="primary" icon={<Upload />} loading={!!uploading} onClick={() => input.current?.click()}>{uploading ? `Envoi ${uploading.done}/${uploading.total}` : 'Importer des images'}</Button>
      </div>
      <div className={'dropzone' + (over ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}>
        <ImagePlus size={22} />
        <span>Glissez des images ici — JPEG, PNG, WebP, AVIF ou GIF, 10 Mo max.</span>
        <span className="small faint">Redimensionnées à 2400 px et converties en WebP avant l'envoi. SVG et autres formats refusés.</span>
      </div>
      <div className="row between">
        <div className="input-icon" style={{ flex: 1, maxWidth: 360, minWidth: 200 }}><Search /><input className="input" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented label="Filtre" value={kind} onChange={setKind} options={[{ value: 'all', label: 'Toutes' }, { value: 'missing-alt', label: 'Sans texte alternatif' }]} />
      </div>
      {error && <Notice tone="danger">{errorMessage(error)}</Notice>}
      {loading && !data ? <div className="media-grid">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} h={170} />)}</div> : list.length ? (
        <div className="media-grid">
          {list.map((m) => (
            <button key={m.id} className="media-tile" onClick={() => setParams({ id: m.id })}>
              <div className="media-thumb">{m.url && <img src={m.url} alt={m.alt} loading="lazy" />}</div>
              <div className="media-meta"><b>{m.title || m.file_name}</b><span>{m.width}×{m.height} · {bytes(m.size_bytes)}{!m.alt && ' · sans alt'}</span></div>
            </button>
          ))}
        </div>
      ) : <Empty icon={<ImagePlus />} title={data?.length ? 'Aucun résultat' : 'Aucune image'}>{data?.length ? 'Modifiez la recherche.' : 'Importez vos premières images (logos clients, captures produit…).'}</Empty>}
      {sel && <Details m={sel} onClose={() => setParams({})} onChanged={reload} />}
    </div>
  );
}
