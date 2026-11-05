// Aperçu fidèle : la vraie page publiée est chargée dans une iframe (même origine), puis le brouillon est
// appliqué en mémoire avec cms/core.js — exactement le code utilisé par le build. Rien n'est rendu public.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { applyContent, ATTR, SECTION_ATTR, type Content } from '@cms';
import { siteBase } from '../../lib/site';
import { resolveMediaUrls, mediaIdsOf } from '../../lib/media';
import { Spinner } from '../../components/ui';

export type Device = 'desktop' | 'tablet' | 'mobile';
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1440, tablet: 820, mobile: 390 };

const EDIT_CSS = `
[${ATTR}] { cursor: pointer; }
html.cms-edit [${ATTR}]:hover { outline: 2px dashed rgba(124,34,214,.65) !important; outline-offset: 3px; }
html.cms-edit [${ATTR}].cms-selected { outline: 2px solid #7c22d6 !important; outline-offset: 3px; box-shadow: 0 0 0 6px rgba(124,34,214,.12); }
html.cms-edit [${SECTION_ATTR}].cms-section-selected { box-shadow: inset 0 0 0 2px rgba(124,34,214,.35); border-radius: 6px; }
html.cms-edit a, html.cms-edit button { cursor: pointer !important; }
html.cms-edit section { animation: none !important; }
`;

export type FrameHandle = { scrollTo: (key: string, section?: boolean) => void; isVisible: (key: string) => boolean };
type Props = {
  file: string;
  content: Content;
  device: Device;
  mode: 'edit' | 'interact' | 'view';
  selectedKey?: string | null;
  selectedSection?: string | null;
  onSelect?: (sel: { key?: string; section?: string }) => void;
  onReady?: () => void;
};

export const PreviewFrame = forwardRef<FrameHandle, Props>(function PreviewFrame({ file, content, device, mode, selectedKey, selectedSection, onSelect, onReady }, ref) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(800);
  const [mediaUrls, setMediaUrls] = useState<Map<string, string>>(new Map());
  const [mediaError, setMediaError] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const doc = () => iframe.current?.contentDocument || null;

  // Mise à l'échelle de l'appareil dans l'espace disponible.
  useLayoutEffect(() => {
    const el = box.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 36; const h = el.clientHeight - 36;
      const s = Math.min(1, w / DEVICE_WIDTH[device]);
      setScale(s); setHeight(Math.max(480, h / s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  // URL signées des médias du brouillon (privés).
  const ids = [...mediaIdsOf(content)].sort().join(',');
  useEffect(() => {
    let alive = true;
    if (!ids) { setMediaUrls(new Map()); return; }
    resolveMediaUrls(ids.split(',')).then((m) => {
      if (!alive) return;
      setMediaUrls(new Map([...m].map(([id, v]) => [id, v.url])));
      setMediaError(m.size < ids.split(',').length ? 'Certaines images du brouillon sont introuvables (supprimées ?).' : null);
    }).catch((e) => alive && setMediaError(String(e.message || e)));
    return () => { alive = false; };
  }, [ids]);

  const apply = useCallback(() => {
    const d = doc();
    if (!d || !loaded) return;
    applyContent(d, content, { resolveMedia: (v) => (v.mediaId ? mediaUrls.get(v.mediaId) ?? null : v.src) });
  }, [content, loaded, mediaUrls]);
  useEffect(() => { apply(); }, [apply]);

  // Mode édition : style de survol/sélection + interception des clics.
  useEffect(() => {
    const d = doc();
    if (!d || !loaded) return;
    d.documentElement.classList.toggle('cms-edit', mode === 'edit');
  }, [mode, loaded]);

  useEffect(() => {
    const d = doc();
    if (!d || !loaded) return;
    d.querySelectorAll('.cms-selected').forEach((e) => e.classList.remove('cms-selected'));
    d.querySelectorAll('.cms-section-selected').forEach((e) => e.classList.remove('cms-section-selected'));
    if (selectedKey) d.querySelectorAll(`[${ATTR}="${CSS.escape(selectedKey)}"]`).forEach((e) => e.classList.add('cms-selected'));
    if (selectedSection) d.querySelector(`[${SECTION_ATTR}="${CSS.escape(selectedSection)}"]`)?.classList.add('cms-section-selected');
  }, [selectedKey, selectedSection, loaded, content]);

  function onLoad() {
    const d = doc();
    if (!d) return;
    const style = d.createElement('style');
    style.textContent = EDIT_CSS;
    d.head.appendChild(style);
    // Les liens ne quittent jamais l'aperçu ; en mode édition, tout clic sélectionne.
    d.addEventListener('click', (e) => {
      const t = e.target as Element | null;
      const a = t?.closest?.('a[href]');
      if (modeRef.current === 'edit') {
        e.preventDefault(); e.stopPropagation();
        const el = t?.closest?.(`[${ATTR}]`);
        const sec = t?.closest?.(`[${SECTION_ATTR}]`);
        onSelectRef.current?.({ key: el?.getAttribute(ATTR) || undefined, section: sec?.getAttribute(SECTION_ATTR) || undefined });
      } else if (a && !(a.getAttribute('href') || '').startsWith('#')) {
        e.preventDefault();
      }
    }, true);
    d.addEventListener('submit', (e) => e.preventDefault(), true);
    setLoaded(true);
    onReady?.();
  }

  useImperativeHandle(ref, () => ({
    scrollTo(key, section) {
      const d = doc();
      const el = d?.querySelector(section ? `[${SECTION_ATTR}="${CSS.escape(key)}"]` : `[${ATTR}="${CSS.escape(key)}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    isVisible(key) {
      const el = doc()?.querySelector(`[${ATTR}="${CSS.escape(key)}"]`) as HTMLElement | null;
      return !!el && el.getClientRects().length > 0;
    },
  }), []);

  const w = DEVICE_WIDTH[device];
  return (
    <div ref={box} style={{ width: w * scale, height: height * scale, flex: 'none', position: 'relative' }}>
      <div className="device-frame" style={{ width: w, height, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>
        <iframe ref={iframe} title="Aperçu de la page" src={new URL(file, siteBase).href + '?cms-preview=1'} onLoad={onLoad} />
      </div>
      {!loaded && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><Spinner label="Chargement de la page…" /></div>}
      {mediaError && <div className="notice warning" style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>{mediaError}</div>}
    </div>
  );
});
