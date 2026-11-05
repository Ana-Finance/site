import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Search, Upload } from 'lucide-react';
import { Button, Empty, Modal, Notice, Spinner, useToast } from '../../components/ui';
import { useAsync } from '../../components/hooks';
import { api } from '../../lib/api';
import { uploadMedia } from '../../lib/upload';
import { errorMessage } from '../../lib/supabase';
import { bytes } from '../../lib/format';
import type { Media } from '../../lib/types';

export async function withUrls(list: Media[]): Promise<Media[]> {
  const urls = await api.signedUrls(list.map((m) => m.storage_path));
  return list.map((m) => ({ ...m, url: urls.get(m.storage_path) }));
}

export function MediaPicker({ onPick, onClose }: { onPick: (m: Media) => void; onClose: () => void }) {
  const { data, loading, error, reload } = useAsync(async () => withUrls(await api.media()), []);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Media | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const list = useMemo(() => (data || []).filter((m) => (m.file_name + m.title + m.alt).toLowerCase().includes(q.toLowerCase())), [data, q]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const m = await uploadMedia(files[0]);
      toast({ tone: 'success', title: 'Image ajoutée', text: `${m.file_name} · ${bytes(m.size_bytes)}` });
      await reload();
      setSel(m);
    } catch (e) { toast({ tone: 'error', title: 'Envoi impossible', text: errorMessage(e) }); } finally { setBusy(false); }
  }

  return (
    <Modal title="Choisir une image" wide onClose={onClose} footer={<>
      <Button onClick={onClose}>Annuler</Button>
      <Button variant="primary" disabled={!sel} onClick={() => sel && onPick(sel)}>Utiliser cette image</Button>
    </>}>
      <div className="row between">
        <div className="input-icon" style={{ flex: 1, minWidth: 200 }}><Search /><input className="input" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <Button icon={<Upload />} loading={busy} onClick={() => input.current?.click()}>Importer</Button>
      </div>
      {error && <Notice tone="danger">{errorMessage(error)}</Notice>}
      {loading && !data ? <Spinner label="Chargement des médias…" /> : list.length ? (
        <div className="media-grid">
          {list.map((m) => (
            <button key={m.id} className="media-tile" aria-pressed={sel?.id === m.id} onClick={() => setSel(m)} onDoubleClick={() => onPick(m)}>
              <div className="media-thumb">{m.url && <img src={m.url} alt={m.alt} loading="lazy" />}</div>
              <div className="media-meta"><b>{m.title || m.file_name}</b><span>{m.width}×{m.height} · {bytes(m.size_bytes)}</span></div>
            </button>
          ))}
        </div>
      ) : <Empty icon={<ImagePlus />} title="Aucune image">Importez une première image : elle est optimisée (WebP, 2400 px max) avant l'envoi.</Empty>}
    </Modal>
  );
}
