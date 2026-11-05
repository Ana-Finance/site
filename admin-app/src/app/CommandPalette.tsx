// Recherche globale : pages, sections/contenus (brouillons) et médias, données réelles.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Image, Type, CornerDownLeft } from 'lucide-react';
import { api } from '../lib/api';
import type { Draft, Media, PageRow } from '../lib/types';
import { NAV } from './nav';
import { Spinner } from '../components/ui';

type Item = { id: string; label: string; detail?: string; kind: string; icon: React.ReactNode; go: string };

function textOf(v: { text?: string; html?: string; alt?: string }) {
  return (v.text || (v.html ? v.html.replace(/<[^>]+>/g, '') : '') || v.alt || '').trim();
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [data, setData] = useState<{ pages: PageRow[]; drafts: Draft[]; media: Media[] } | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([api.pages(), api.drafts(), api.media()]).then(([pages, drafts, media]) => setData({ pages, drafts, media })).catch(() => setData({ pages: [], drafts: [], media: [] }));
  }, []);

  const items = useMemo<Item[]>(() => {
    const nq = norm(q.trim());
    const out: Item[] = [];
    NAV.forEach((n) => { if (!nq || norm(n.label).includes(nq)) out.push({ id: 'nav' + n.to, label: n.label, kind: 'Navigation', icon: <n.icon size={16} />, go: n.to }); });
    if (!data) return out;
    const slugOf = new Map(data.pages.map((p) => [p.id, p]));
    data.pages.forEach((p) => {
      if (!nq || norm(p.title + ' ' + p.slug).includes(nq)) out.push({ id: 'p' + p.id, label: p.title, detail: p.slug === '_global' ? 'En-tête et pied de page' : p.slug + '.html', kind: 'Page', icon: <FileText size={16} />, go: `/pages/${p.id}` });
    });
    if (nq.length >= 3) {
      data.drafts.forEach((d) => {
        const page = slugOf.get(d.page_id);
        if (!page) return;
        Object.entries(d.content.fields || {}).forEach(([key, v]: [string, { text?: string; html?: string; alt?: string }]) => {
          const t = textOf(v);
          if (t && norm(t).includes(nq) && out.length < 60) {
            out.push({ id: d.page_id + key, label: t.length > 80 ? t.slice(0, 80) + '…' : t, detail: page.title, kind: 'Contenu', icon: <Type size={16} />, go: `/editor/${page.slug === '_global' ? 'index' : page.slug}?field=${encodeURIComponent(key)}` });
          }
        });
      });
    }
    data.media.forEach((m) => { if (nq && norm(m.file_name + ' ' + m.title + ' ' + m.alt).includes(nq)) out.push({ id: 'm' + m.id, label: m.title || m.file_name, detail: m.alt, kind: 'Média', icon: <Image size={16} />, go: `/media?id=${m.id}` }); });
    return out.slice(0, 60);
  }, [q, data]);

  useEffect(() => { setSel(0); }, [q]);
  const choose = (i: Item) => { nav(i.go); onClose(); };

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Recherche globale">
        <input autoFocus placeholder="Rechercher une page, un texte, un média…" value={q} onChange={(e) => setQ(e.target.value)}
          role="combobox" aria-expanded="true" aria-controls="palette-list"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === 'Enter' && items[sel]) choose(items[sel]);
          }} />
        <ul id="palette-list" role="listbox">
          {!data && <li style={{ padding: 12 }}><Spinner label="Indexation…" /></li>}
          {items.map((it, i) => (
            <li key={it.id}><button role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => choose(it)}>
              {it.icon}<span className="truncate"><span>{it.label}</span>{it.detail && <span className="muted small"> — {it.detail}</span>}</span>
              <span className="kind">{it.kind}</span>{i === sel && <CornerDownLeft size={14} className="faint" />}
            </button></li>
          ))}
          {data && !items.length && <li className="muted small" style={{ padding: 14 }}>Aucun résultat.</li>}
        </ul>
      </div>
    </div>
  );
}
