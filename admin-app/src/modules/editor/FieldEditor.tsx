// Panneau de propriétés d'un champ éditable (partagé par l'éditeur visuel et le formulaire de page).
import { useEffect, useRef, useState } from 'react';
import { Bold, Highlighter, ImagePlus, Italic, Link2, Trash2, Unlink } from 'lucide-react';
import { isSafeUrl, sanitizeRich, type FieldValue, type ModelField } from '@cms';
import { Button, Field, Notice } from '../../components/ui';
import { MediaPicker } from '../media/MediaPicker';
import { resolveMediaUrls } from '../../lib/media';
import type { PageRow } from '../../lib/types';

export const TYPE_LABEL: Record<string, string> = { text: 'Texte', rich: 'Texte enrichi', link: 'Lien / bouton', href: 'Destination', image: 'Image', slot: 'Emplacement image' };

function LinkInput({ value, onChange, pages }: { value: string; onChange: (v: string) => void; pages: PageRow[] }) {
  const internal = pages.filter((p) => p.slug !== '_global' && p.status !== 'archived');
  const isInternal = internal.some((p) => value.split('#')[0] === p.slug + '.html');
  const bad = !isSafeUrl(value);
  return (
    <div className="stack-sm">
      <select className="select" value={isInternal ? value.split('#')[0] : '__custom'} onChange={(e) => { if (e.target.value !== '__custom') onChange(e.target.value); }} aria-label="Page du site">
        <option value="__custom">Adresse personnalisée…</option>
        {internal.map((p) => <option key={p.id} value={p.slug + '.html'}>{p.title} ({p.slug}.html)</option>)}
      </select>
      <input className="input mono" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={bad} placeholder="page.html#ancre, https://…, mailto:…, tel:…" aria-label="Destination" />
      {bad && <span className="hint" style={{ color: 'var(--danger)' }}>Adresse refusée (seuls http(s), mailto, tel et les liens internes sont autorisés).</span>}
    </div>
  );
}

function RichInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  useEffect(() => {
    if (ref.current && value !== last.current) { ref.current.innerHTML = sanitizeRich(value, document); last.current = value; }
  }, [value]);
  useEffect(() => { if (ref.current) ref.current.innerHTML = sanitizeRich(value, document); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const emit = () => { const clean = sanitizeRich(ref.current?.innerHTML || '', document); last.current = clean; onChange(clean); };
  const cmd = (c: string, arg?: string) => { ref.current?.focus(); document.execCommand(c, false, arg); emit(); };
  // Mot en dégradé (classe « ana-grad » du site) : pose la mise en forme sur la sélection, ou la retire si le curseur est déjà dedans.
  const grad = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const start = range.startContainer;
    const inside = (start.nodeType === Node.ELEMENT_NODE ? (start as Element) : start.parentElement)?.closest('.ana-grad');
    if (inside && el.contains(inside)) inside.replaceWith(...Array.from(inside.childNodes));
    else if (!range.collapsed) {
      const span = document.createElement('span');
      span.className = 'ana-grad';
      span.appendChild(range.extractContents());
      span.querySelectorAll('.ana-grad').forEach((n) => n.replaceWith(...Array.from(n.childNodes)));
      range.insertNode(span);
      sel.removeAllRanges();
    } else return;
    emit();
  };
  return (
    <div>
      <div className="rich-tools">
        <Button size="sm" iconOnly variant="ghost" aria-label="Gras" icon={<Bold />} onMouseDown={(e) => { e.preventDefault(); cmd('bold'); }} />
        <Button size="sm" iconOnly variant="ghost" aria-label="Italique" icon={<Italic />} onMouseDown={(e) => { e.preventDefault(); cmd('italic'); }} />
        <Button size="sm" iconOnly variant="ghost" aria-label="Lien" icon={<Link2 />} onMouseDown={(e) => {
          e.preventDefault();
          const url = prompt('Adresse du lien (https://, mailto:, tel: ou page.html)');
          if (url && isSafeUrl(url)) cmd('createLink', url);
        }} />
        <Button size="sm" iconOnly variant="ghost" aria-label="Retirer le lien" icon={<Unlink />} onMouseDown={(e) => { e.preventDefault(); cmd('unlink'); }} />
        <Button size="sm" iconOnly variant="ghost" aria-label="Mot en dégradé" title="Mettre la sélection en dégradé, ou retirer le dégradé" icon={<Highlighter />} onMouseDown={(e) => { e.preventDefault(); grad(); }} />
      </div>
      <div ref={ref} className="rich" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" onInput={emit}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }} />
      <span className="hint">Le style des passages existants (dégradés, couleurs) est conservé. Pour mettre un mot en dégradé, sélectionnez-le puis cliquez sur le surligneur : un seul par titre. Collage en texte brut.</span>
    </div>
  );
}

function ImageInput({ field, value, onChange }: { field: ModelField; value: FieldValue; onChange: (v: FieldValue) => void }) {
  const [picking, setPicking] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (value.mediaId) resolveMediaUrls([value.mediaId]).then((m) => alive && setUrl(m.get(value.mediaId!)?.url ?? null)).catch(() => setUrl(null));
    else setUrl(value.src ? new URL(value.src, new URL('../', location.href.split('#')[0])).href : null);
    return () => { alive = false; };
  }, [value.mediaId, value.src]);
  return (
    <div className="stack">
      <div className="media-thumb" style={{ borderRadius: 10, border: '1px solid var(--border)', maxHeight: 220 }}>
        {url ? <img src={url} alt={value.alt || ''} /> : <span className="muted small">Emplacement vide</span>}
      </div>
      {value.width && value.height ? <span className="hint">{value.width} × {value.height} px{value.mediaId ? ' · médiathèque' : ' · fichier du site'}</span> : null}
      <div className="row">
        <Button icon={<ImagePlus />} onClick={() => setPicking(true)}>{url ? 'Remplacer' : 'Choisir une image'}</Button>
        {field.type === 'slot' && (value.mediaId || value.src) && <Button variant="ghost" icon={<Trash2 />} onClick={() => onChange({ alt: value.alt })}>Retirer</Button>}
      </div>
      <Field label="Texte alternatif" hint="Décrit l'image pour les lecteurs d'écran et le référencement. Laisser vide uniquement si l'image est décorative." counter={{ value: (value.alt || '').length, max: 160 }}>
        <input className="input" value={value.alt || ''} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
      </Field>
      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(m) => { onChange({ mediaId: m.id, alt: value.alt || m.alt, width: m.width ?? undefined, height: m.height ?? undefined }); setPicking(false); }} />}
    </div>
  );
}

export function FieldEditor({ field, value, onChange, pages }: { field: ModelField; value: FieldValue; onChange: (v: FieldValue) => void; pages: PageRow[] }) {
  const v = value || {};
  switch (field.type) {
    case 'text':
      return (
        <Field label="Texte" counter={{ value: (v.text || '').length, max: field.tag === 'h1' ? 90 : field.tag === 'p' ? 600 : 160 }}>
          <textarea className="textarea" rows={Math.min(8, Math.max(2, Math.ceil((v.text || '').length / 42)))} value={v.text || ''} onChange={(e) => onChange({ ...v, text: e.target.value.replace(/\n+/g, ' ') })} />
        </Field>
      );
    case 'rich':
      return <Field label="Texte"><RichInput value={v.html || ''} onChange={(html) => onChange({ ...v, html })} /></Field>;
    case 'link':
      return (
        <div className="stack">
          <Field label="Libellé" counter={{ value: (v.text || '').length, max: 80 }}><input className="input" value={v.text || ''} onChange={(e) => onChange({ ...v, text: e.target.value })} /></Field>
          <Field label="Destination"><LinkInput value={v.href || ''} onChange={(href) => onChange({ ...v, href })} pages={pages} /></Field>
        </div>
      );
    case 'href':
      return <Field label="Destination de la carte"><LinkInput value={v.href || ''} onChange={(href) => onChange({ ...v, href })} pages={pages} /></Field>;
    case 'image':
    case 'slot':
      return <ImageInput field={field} value={v} onChange={onChange} />;
    default:
      return <Notice>Type de champ non pris en charge.</Notice>;
  }
}

export function fieldPreview(f: ModelField, v: FieldValue | undefined): string {
  const x = v || f.value;
  if (f.type === 'image' || f.type === 'slot') return x.mediaId ? 'Image de la médiathèque' : x.src ? x.src.split('/').pop() || '' : 'Vide';
  if (f.type === 'href') return x.href || '';
  return (x.text ?? (x.html || '').replace(/<[^>]+>/g, '')).trim() || '—';
}
