/* Ana Finance — moteur de contenu partagé.
 *
 * Utilisé à l'identique par :
 *   - le build Node (scripts/build-site.mjs, via jsdom) pour produire le HTML publié ;
 *   - l'administration (aperçu et éditeur visuel, DOM natif du navigateur).
 *
 * Aucune dépendance, uniquement des API DOM standard. Le document est toujours passé en paramètre.
 *
 * Attributs portés par le HTML source :
 *   data-cms="<clé>"            élément éditable (clé stable)
 *   data-cms-type="<type>"      text | rich | link | href | image | slot
 *   data-cms-section="<clé>"    section réordonnable / masquable
 *   data-cms-default-hidden     section masquée par défaut (réaffichable depuis l'éditeur)
 */

export const ATTR = 'data-cms';
export const TYPE_ATTR = 'data-cms-type';
export const SECTION_ATTR = 'data-cms-section';
/** Section présente dans le HTML mais masquée tant que le contenu ne demande pas de l'afficher (sections.shown). */
export const DEFAULT_HIDDEN_ATTR = 'data-cms-default-hidden';
export const FIELD_TYPES = ['text', 'rich', 'link', 'href', 'image', 'slot'];

const TEXT_NODE = 3;
// Espaces HTML (ASCII) uniquement : les espaces insécables (&nbsp;) font partie du contenu.
const WS = /[ \t\n\r\f]+/g;
const trimWs = (s) => s.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '');
const ELEMENT_NODE = 1;

/* ------------------------------------------------------------------ *
 * Sécurité : URL et HTML riche
 * ------------------------------------------------------------------ */

/** URL autorisée dans un lien ou une image : http(s), mailto, tel, relative, ancre. */
export function isSafeUrl(url, { allowData = false } = {}) {
  if (typeof url !== 'string') return false;
  const u = url.trim();
  if (u === '') return true;
  // Caractères de contrôle et espaces internes utilisés pour masquer « javascript: »
  // eslint-disable-next-line no-control-regex
  const compact = u.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  const m = compact.match(/^([a-z][a-z0-9+.-]*):/);
  if (!m) return true; // chemin relatif, ancre ou //hôte
  const scheme = m[1];
  if (scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel') return true;
  if (allowData && scheme === 'data' && /^data:image\/(png|jpe?g|webp|gif|avif);/.test(compact)) return true;
  return false;
}

const RICH_TAGS = new Set(['A', 'STRONG', 'B', 'EM', 'I', 'BR', 'SPAN', 'SMALL', 'SUP', 'SUB', 'U']);
const RICH_ATTRS = {
  A: ['href', 'target', 'rel', 'style', 'class'],
  SPAN: ['style', 'class', 'aria-hidden'],
  STRONG: ['style', 'class'],
  B: ['style', 'class'],
  EM: ['style', 'class'],
  I: ['style', 'class'],
  SMALL: ['style', 'class'],
  SUP: [], SUB: [], U: [], BR: [],
};

/** Neutralise les constructions CSS dangereuses ou exfiltrantes dans un attribut style. */
export function sanitizeStyle(style) {
  if (typeof style !== 'string') return '';
  if (/expression\s*\(|url\s*\(|@import|javascript:|behavior\s*:|-moz-binding|[<>]/i.test(style)) return '';
  return style;
}

/**
 * Assainit un fragment HTML riche selon une liste blanche stricte.
 * Les balises inconnues sont remplacées par leur contenu texte ; scripts, iframes, styles… sont supprimés.
 * @param {string} html
 * @param {Document} doc document utilisé pour parser le fragment (inerte : <template>)
 */
export function sanitizeRich(html, doc) {
  const tpl = doc.createElement('template');
  tpl.innerHTML = String(html == null ? '' : html);
  const out = doc.createElement('div');
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'LINK', 'META', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'IMG', 'VIDEO', 'AUDIO']);

  function copy(src, dst) {
    src.childNodes.forEach((n) => {
      if (n.nodeType === TEXT_NODE) { dst.appendChild(doc.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== ELEMENT_NODE) return;
      const tag = n.tagName.toUpperCase();
      if (DROP.has(tag)) return;
      if (!RICH_TAGS.has(tag)) { copy(n, dst); return; }
      const el = doc.createElement(tag.toLowerCase());
      (RICH_ATTRS[tag] || []).forEach((name) => {
        if (!n.hasAttribute(name)) return;
        let v = n.getAttribute(name);
        if (name === 'href' && !isSafeUrl(v)) return;
        if (name === 'style') { v = sanitizeStyle(v); if (!v) return; }
        if (name === 'target' && v !== '_blank') return;
        el.setAttribute(name, v);
      });
      if (tag === 'A' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener');
      copy(n, el);
      dst.appendChild(el);
    });
  }
  copy(tpl.content, out);
  return out.innerHTML;
}

/* ------------------------------------------------------------------ *
 * Classification (utilisée par le script d'annotation)
 * ------------------------------------------------------------------ */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'INPUT', 'SELECT', 'OPTION', 'TEXTAREA', 'IFRAME', 'HEAD']);
const INLINE_TAGS = new Set(['SPAN', 'A', 'STRONG', 'B', 'EM', 'I', 'BR', 'SMALL', 'SUP', 'SUB', 'U']);
const ICON_TAGS = new Set(['SVG', 'svg', 'IMG']);

function hasDynamicBinding(el) {
  for (let i = 0; i < el.attributes.length; i++) {
    const n = el.attributes[i].name;
    if (n === 'data-text' || n === 'data-if' || (n.startsWith('data-b-') && n !== 'data-b-style') || n.startsWith('data-on-input')) return true;
  }
  return false;
}
function subtreeHasDynamic(el) {
  if (hasDynamicBinding(el)) return true;
  return !!el.querySelector('[data-text],[data-if],[data-b-value],[data-b-checked],input,select,textarea,button,form');
}
const isIcon = (n) => n.nodeType === ELEMENT_NODE && (ICON_TAGS.has(n.tagName) || n.tagName.toLowerCase() === 'svg');
const significant = (n) => n.nodeType === TEXT_NODE && trimWs(n.nodeValue) !== '';
/** Vrai si un descendant porte un attribut data-* (liaison du moteur ana-runtime, slot…). */
function descendantHasData(el) {
  for (const d of el.querySelectorAll('*')) {
    for (let i = 0; i < d.attributes.length; i++) if (d.attributes[i].name.startsWith('data-')) return true;
  }
  return false;
}

/** Texte « plat » : uniquement des nœuds texte (et éventuellement des icônes svg). */
function isPlainText(el) {
  let txt = false;
  for (const n of el.childNodes) {
    if (n.nodeType === TEXT_NODE) { if (trimWs(n.nodeValue)) txt = true; continue; }
    if (n.nodeType === ELEMENT_NODE && isIcon(n)) continue;
    if (n.nodeType === 8) continue; // commentaire
    return false;
  }
  return txt;
}
/** Texte riche : texte direct significatif + uniquement des balises inline. */
function isRichText(el) {
  let direct = false;
  for (const n of el.childNodes) {
    if (significant(n)) direct = true;
    if (n.nodeType !== ELEMENT_NODE) continue;
    if (isIcon(n)) return false;
    if (!INLINE_TAGS.has(n.tagName)) return false;
    if (n.tagName !== 'BR' && n.querySelector('*:not(br):not(span):not(a):not(strong):not(b):not(em):not(i):not(small):not(sup):not(sub):not(u)')) return false;
  }
  return direct && !subtreeHasDynamic(el) && !descendantHasData(el);
}

/**
 * Détermine le type éditable d'un élément, ou null.
 * `descend` indique si l'annotateur doit parcourir les enfants.
 */
export function classify(el) {
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag) || tag.toLowerCase() === 'svg') return { type: null, descend: false };
  if (el.getAttribute('aria-hidden') === 'true') return { type: null, descend: false };
  if (el.hasAttribute('data-slot')) return { type: 'slot', descend: false };
  if (tag === 'IMG') return { type: 'image', descend: false };
  if (el.hasAttribute('data-text')) return { type: null, descend: false };
  if (tag === 'A' && el.hasAttribute('href')) {
    if (isPlainText(el)) return { type: 'link', descend: false };
    if (isRichText(el)) return { type: 'rich', descend: false };
    return { type: 'href', descend: true };
  }
  if (subtreeHasDynamic(el) && !isPlainText(el)) return { type: null, descend: true };
  if (isPlainText(el) && !hasDynamicBinding(el)) return { type: 'text', descend: false };
  if (isRichText(el)) return { type: 'rich', descend: false };
  return { type: null, descend: true };
}

/* ------------------------------------------------------------------ *
 * Lecture des valeurs
 * ------------------------------------------------------------------ */

function plainText(el) {
  let s = '';
  el.childNodes.forEach((n) => { if (n.nodeType === TEXT_NODE) s += n.nodeValue; });
  return trimWs(s.replace(WS, ' '));
}

function slotState(el) {
  const img = el.querySelector('img[data-cms-slot-img]');
  if (img) return { src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '' };
  return { src: '', alt: el.getAttribute('aria-label') || '' };
}

/** Valeur actuelle d'un élément annoté, selon son type. */
export function readValue(el, type = el.getAttribute(TYPE_ATTR)) {
  switch (type) {
    case 'text': return { text: plainText(el) };
    case 'rich': return { html: trimWs(el.innerHTML.replace(WS, ' ')) };
    case 'link': return { text: plainText(el), href: el.getAttribute('href') || '' };
    case 'href': return { href: el.getAttribute('href') || '' };
    case 'image': return { src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' };
    case 'slot': return slotState(el);
    default: return {};
  }
}

function headingOf(scope) {
  if (!scope || !scope.querySelector) return '';
  const clip = (t) => { t = t.replace(/\s+/g, ' ').trim(); return t.length > 60 ? t.slice(0, 57) + '…' : t; };
  const h = scope.querySelector('h1,h2,h3');
  if (h) return clip(h.textContent);
  // Section sans titre : premier emplacement d'image ou premier texte éditable.
  const slot = scope.querySelector('[data-slot]');
  if (slot) return clip('Image — ' + (slot.getAttribute('aria-label') || slot.textContent));
  const t = scope.querySelector('[' + ATTR + '][' + TYPE_ATTR + '="text"], [' + ATTR + '][' + TYPE_ATTR + '="rich"]');
  return t ? clip(t.textContent) : '';
}

const TAG_LABELS = { H1: 'Titre principal', H2: 'Titre', H3: 'Sous-titre', H4: 'Intertitre', P: 'Paragraphe', A: 'Lien', BUTTON: 'Bouton', IMG: 'Image', SPAN: 'Texte', LI: 'Élément de liste', LABEL: 'Libellé', DIV: 'Texte' };

/** Libellé lisible d'un champ pour l'interface d'édition. */
export function fieldLabel(el, type) {
  if (type === 'slot' || type === 'image') return (type === 'slot' ? 'Emplacement image' : 'Image') + (el.getAttribute('alt') || el.getAttribute('aria-label') ? ' — ' + (el.getAttribute('alt') || el.getAttribute('aria-label')) : '');
  if (type === 'href') return 'Destination de la carte';
  if (type === 'link') return /linear-gradient|background:#|background:rgb/.test(el.getAttribute('style') || '') ? 'Bouton (CTA)' : 'Lien';
  return TAG_LABELS[el.tagName] || 'Texte';
}

/** Zone à laquelle appartient un élément : header, footer, section, page. */
export function regionOf(el) {
  const sec = el.closest('[' + SECTION_ATTR + ']');
  if (sec) return { kind: 'section', key: sec.getAttribute(SECTION_ATTR), el: sec };
  const key = el.getAttribute(ATTR) || '';
  if (key.startsWith('g.header.')) return { kind: 'header', key: 'header', el: null };
  if (key.startsWith('g.footer.') || el.closest('footer')) return { kind: 'footer', key: 'footer', el: el.closest('footer') };
  return { kind: 'page', key: 'page', el: null };
}

/**
 * Modèle éditable d'un document annoté : champs, sections, SEO.
 * @returns {{fields: Array, sections: Array, seo: object}}
 */
export function extractModel(doc) {
  const fields = [];
  doc.querySelectorAll('[' + ATTR + ']').forEach((el) => {
    const type = el.getAttribute(TYPE_ATTR);
    if (!FIELD_TYPES.includes(type)) return;
    const region = regionOf(el);
    fields.push({
      key: el.getAttribute(ATTR),
      type,
      label: fieldLabel(el, type),
      tag: el.tagName.toLowerCase(),
      region: region.kind,
      section: region.kind === 'section' ? region.key : null,
      global: el.getAttribute(ATTR).startsWith('g.'),
      value: readValue(el, type),
    });
  });
  const sections = [];
  doc.querySelectorAll('[' + SECTION_ATTR + ']').forEach((el) => {
    const section = { key: el.getAttribute(SECTION_ATTR), label: headingOf(el) || el.getAttribute('aria-label') || 'Section', id: el.id || null };
    if (el.hasAttribute(DEFAULT_HIDDEN_ATTR)) section.hiddenByDefault = true;
    sections.push(section);
  });
  return { fields, sections, seo: readSeo(doc) };
}

/* ------------------------------------------------------------------ *
 * SEO (<head>)
 * ------------------------------------------------------------------ */

function metaContent(doc, sel) {
  const m = doc.head && doc.head.querySelector(sel);
  return m ? m.getAttribute('content') || '' : '';
}

export function readSeo(doc) {
  const canon = doc.head && doc.head.querySelector('link[rel="canonical"]');
  const robots = metaContent(doc, 'meta[name="robots"]');
  const seo = {
    title: doc.title || '',
    description: metaContent(doc, 'meta[name="description"]'),
    ogTitle: metaContent(doc, 'meta[property="og:title"]'),
    ogDescription: metaContent(doc, 'meta[property="og:description"]'),
    ogImage: metaContent(doc, 'meta[property="og:image"]') ? { src: metaContent(doc, 'meta[property="og:image"]') } : null,
    canonical: canon ? canon.getAttribute('href') || '' : '',
    noindex: /noindex/i.test(robots),
  };
  const rev = seoRevision(doc);
  if (rev) seo.rev = rev;
  return seo;
}

/**
 * Révision des textes SEO portée par le HTML : <meta name="cms:seo-rev" content="N">.
 * Quand le titre ou la description d'une page sont modifiés dans le HTML, on incrémente N : tant que le
 * contenu enregistré en base est plus ancien (seo.rev absent ou inférieur), ce sont les textes du HTML
 * qui s'appliquent. Dès qu'un membre enregistre le SEO dans l'administration, la révision est reprise
 * (voir admin-app/src/lib/draft.ts) et ses valeurs priment de nouveau.
 */
export function seoRevision(doc) {
  return Number(metaContent(doc, 'meta[name="cms:seo-rev"]')) || 0;
}

function upsertMeta(doc, attr, name, content) {
  let m = doc.head.querySelector('meta[' + attr + '="' + name + '"]');
  if (content == null || content === '') { if (m) m.remove(); return; }
  if (!m) { m = doc.createElement('meta'); m.setAttribute(attr, name); doc.head.appendChild(m); }
  m.setAttribute('content', content);
}

/**
 * Applique les métadonnées SEO au <head>. Seules les valeurs fournies sont modifiées :
 * les balises existantes sont conservées si le champ est absent du contenu.
 */
export function applySeo(doc, seo, { resolveMedia, siteUrl, pagePath } = {}) {
  if (!seo || !doc.head) return;
  const has = (k) => Object.prototype.hasOwnProperty.call(seo, k);
  // Textes révisés dans le HTML après le dernier enregistrement en base : le HTML fait foi (voir seoRevision).
  const upToDate = (Number(seo.rev) || 0) >= seoRevision(doc);
  if (upToDate) {
    if (has('title') && seo.title) doc.title = seo.title;
    if (has('description')) upsertMeta(doc, 'name', 'description', seo.description);
    if (has('ogTitle')) upsertMeta(doc, 'property', 'og:title', seo.ogTitle || seo.title);
    if (has('ogDescription')) upsertMeta(doc, 'property', 'og:description', seo.ogDescription || seo.description);
  }
  if (has('ogImage')) {
    let src = seo.ogImage && (resolveMedia ? resolveMedia(seo.ogImage) : seo.ogImage.src);
    if (src && siteUrl && !/^https?:/i.test(src)) src = new URL(src, siteUrl).href; // og:image doit être absolue
    upsertMeta(doc, 'property', 'og:image', src && isSafeUrl(src) ? src : '');
  }
  if (has('noindex')) upsertMeta(doc, 'name', 'robots', seo.noindex ? 'noindex, nofollow' : '');
  let canonical = has('canonical') ? (seo.canonical || '').trim() : null;
  if (canonical === '' && siteUrl && pagePath != null) canonical = new URL(pagePath === 'index.html' ? '' : pagePath, siteUrl).href;
  if (canonical != null) {
    let l = doc.head.querySelector('link[rel="canonical"]');
    if (!canonical || !isSafeUrl(canonical)) { if (l) l.remove(); }
    else {
      if (!l) { l = doc.createElement('link'); l.setAttribute('rel', 'canonical'); doc.head.appendChild(l); }
      l.setAttribute('href', canonical);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Application du contenu
 * ------------------------------------------------------------------ */

function setPlainText(el, text) {
  const doc = el.ownerDocument;
  const texts = [];
  el.childNodes.forEach((n) => { if (n.nodeType === TEXT_NODE && trimWs(n.nodeValue)) texts.push(n); });
  const value = String(text == null ? '' : text);
  if (texts.length === 0) { el.insertBefore(doc.createTextNode(value), el.firstChild); return; }
  // Conserve les espaces de bord du premier nœud pour ne pas décaler les icônes voisines.
  const first = texts[0];
  const lead = first.nodeValue.match(/^[ \t\n\r\f]*/)[0];
  const trail = first.nodeValue.match(/[ \t\n\r\f]*$/)[0];
  const next = lead + value + trail;
  if (trimWs(first.nodeValue.replace(WS, ' ')) !== value) first.nodeValue = next;
  for (let i = 1; i < texts.length; i++) texts[i].remove();
}

function setSlot(el, value, resolveMedia) {
  const doc = el.ownerDocument;
  const src = value && (resolveMedia ? resolveMedia(value) : value.src);
  const existing = el.querySelector('img[data-cms-slot-img]');
  if (!src || !isSafeUrl(src, { allowData: true })) {
    if (existing) {
      existing.remove();
      el.classList.add('ana-slot');
      if (el.getAttribute('data-cms-slot-label')) el.textContent = el.getAttribute('data-cms-slot-label');
    }
    if (value && value.alt) el.setAttribute('aria-label', value.alt);
    return;
  }
  if (!el.getAttribute('data-cms-slot-label')) el.setAttribute('data-cms-slot-label', el.textContent.trim());
  el.textContent = '';
  el.classList.remove('ana-slot');
  el.removeAttribute('role');
  el.removeAttribute('aria-label');
  const img = doc.createElement('img');
  img.setAttribute('data-cms-slot-img', '');
  img.setAttribute('src', src);
  img.setAttribute('alt', (value && value.alt) || '');
  img.setAttribute('loading', 'lazy');
  img.setAttribute('decoding', 'async');
  img.setAttribute('style', 'display:block;width:100%;height:100%;object-fit:contain;');
  if (value.width && value.height) { img.setAttribute('width', String(value.width)); img.setAttribute('height', String(value.height)); }
  el.appendChild(img);
}

/**
 * Applique une valeur à un élément annoté.
 * Les valeurs non sûres (URL javascript:, HTML hors liste blanche) sont neutralisées.
 */
export function applyValue(el, value, { type = el.getAttribute(TYPE_ATTR), resolveMedia } = {}) {
  if (!value || typeof value !== 'object') return;
  const doc = el.ownerDocument;
  switch (type) {
    case 'text':
      if (typeof value.text === 'string') setPlainText(el, value.text);
      break;
    case 'rich':
      if (typeof value.html === 'string') {
        const clean = sanitizeRich(value.html, doc);
        if (trimWs(el.innerHTML.replace(WS, ' ')) !== trimWs(clean.replace(WS, ' '))) el.innerHTML = clean;
      }
      break;
    case 'link':
      if (typeof value.text === 'string') setPlainText(el, value.text);
      if (typeof value.href === 'string' && isSafeUrl(value.href) && el.getAttribute('href') !== value.href) el.setAttribute('href', value.href);
      break;
    case 'href':
      if (typeof value.href === 'string' && isSafeUrl(value.href) && el.getAttribute('href') !== value.href) el.setAttribute('href', value.href);
      break;
    case 'image': {
      const src = resolveMedia ? resolveMedia(value) : value.src;
      if (src && isSafeUrl(src, { allowData: true }) && el.getAttribute('src') !== src) el.setAttribute('src', src);
      if (typeof value.alt === 'string' && el.getAttribute('alt') !== value.alt) el.setAttribute('alt', value.alt);
      if (value.mediaId && value.width && value.height) { el.setAttribute('width', String(value.width)); el.setAttribute('height', String(value.height)); }
      break;
    }
    case 'slot':
      setSlot(el, value, resolveMedia);
      break;
    default:
  }
}

/**
 * Une section est-elle masquée ? Soit le contenu la masque (sections.hidden), soit elle est masquée par défaut
 * dans le HTML (data-cms-default-hidden) et le contenu ne demande pas de l'afficher (sections.shown).
 */
export function isSectionHidden(sections, key, hiddenByDefault) {
  const s = sections || {};
  if (Array.isArray(s.hidden) && s.hidden.includes(key)) return true;
  return !!hiddenByDefault && !(Array.isArray(s.shown) && s.shown.includes(key));
}

/** Masquage et ordre des sections. Seules les sections sœurs d'un même parent sont réordonnées. */
export function applySections(doc, sections) {
  if (!sections) return;
  const all = Array.from(doc.querySelectorAll('[' + SECTION_ATTR + ']'));
  const byKey = new Map(all.map((el) => [el.getAttribute(SECTION_ATTR), el]));
  all.forEach((el) => {
    const k = el.getAttribute(SECTION_ATTR);
    const byDefault = el.hasAttribute(DEFAULT_HIDDEN_ATTR);
    if (isSectionHidden(sections, k, byDefault)) {
      if (!el.hasAttribute('hidden')) { el.setAttribute('hidden', ''); el.setAttribute('data-cms-hidden', ''); }
    } else if (el.hasAttribute('data-cms-hidden') || byDefault) {
      el.removeAttribute('hidden');
      el.removeAttribute('data-cms-hidden');
    }
  });
  if (Array.isArray(sections.order) && sections.order.length) {
    const ordered = sections.order.map((k) => byKey.get(k)).filter(Boolean);
    // Regroupe par parent ; chaque groupe est réinséré dans l'ordre demandé à la place de ses propres emplacements.
    const groups = new Map();
    ordered.forEach((el) => { const p = el.parentNode; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(el); });
    groups.forEach((els, parent) => {
      const current = Array.from(parent.children).filter((c) => c.hasAttribute(SECTION_ATTR));
      const missing = current.filter((c) => !els.includes(c));
      const target = els.concat(missing);
      if (target.every((el, i) => current[i] === el)) return;
      const anchors = current.map((c) => { const m = c.ownerDocument.createComment('cms-slot'); parent.insertBefore(m, c); return m; });
      target.forEach((el, i) => { parent.replaceChild(el, anchors[i]); });
    });
  }
}

/**
 * Applique un contenu complet ({fields, sections, seo}) à un document annoté.
 * @param {Document} doc
 * @param {{fields?:object, sections?:object, seo?:object}} content
 * @param {{resolveMedia?:Function, siteUrl?:string, pagePath?:string}} opts
 * @returns {{applied:number, missing:string[]}} clés présentes dans le contenu mais absentes du HTML
 */
export function applyContent(doc, content, opts = {}) {
  const res = { applied: 0, missing: [] };
  if (!content) return res;
  const fields = content.fields || {};
  const els = new Map();
  doc.querySelectorAll('[' + ATTR + ']').forEach((el) => {
    const k = el.getAttribute(ATTR);
    if (!els.has(k)) els.set(k, []);
    els.get(k).push(el);
  });
  Object.keys(fields).forEach((key) => {
    const list = els.get(key);
    if (!list) { res.missing.push(key); return; }
    list.forEach((el) => applyValue(el, fields[key], opts));
    res.applied++;
  });
  applySections(doc, content.sections);
  if (content.seo) applySeo(doc, content.seo, opts);
  return res;
}

/** Fusionne le contenu global (header/footer) et celui de la page. Les clés de page priment. */
export function mergeContent(globalContent, pageContent) {
  return {
    fields: Object.assign({}, (globalContent && globalContent.fields) || {}, (pageContent && pageContent.fields) || {}),
    sections: pageContent && pageContent.sections,
    seo: pageContent && pageContent.seo,
  };
}

/** Différences champ par champ entre deux contenus (pour l'historique et la revue avant publication). */
export function diffContent(a, b) {
  const fa = (a && a.fields) || {};
  const fb = (b && b.fields) || {};
  const keys = new Set(Object.keys(fa).concat(Object.keys(fb)));
  const changed = [];
  keys.forEach((k) => { if (JSON.stringify(fa[k]) !== JSON.stringify(fb[k])) changed.push(k); });
  const seoChanged = JSON.stringify((a && a.seo) || {}) !== JSON.stringify((b && b.seo) || {});
  const sectionsChanged = JSON.stringify((a && a.sections) || {}) !== JSON.stringify((b && b.sections) || {});
  return { fields: changed, seo: seoChanged, sections: sectionsChanged, count: changed.length + (seoChanged ? 1 : 0) + (sectionsChanged ? 1 : 0) };
}

/**
 * Contenu actuel d'un document annoté, au format stocké en base.
 * @param {Document} doc
 * @param {{scope?: 'page'|'global'|'all'}} opts  page : sans les clés g.* ; global : uniquement g.*
 */
export function extractContent(doc, { scope = 'all' } = {}) {
  const fields = {};
  doc.querySelectorAll('[' + ATTR + ']').forEach((el) => {
    const key = el.getAttribute(ATTR);
    const isGlobal = key.startsWith('g.');
    if ((scope === 'page' && isGlobal) || (scope === 'global' && !isGlobal)) return;
    if (!(key in fields)) fields[key] = readValue(el);
  });
  if (scope === 'global') return { fields };
  const order = Array.from(doc.querySelectorAll('[' + SECTION_ATTR + ']')).map((s) => s.getAttribute(SECTION_ATTR));
  return { fields, sections: { order, hidden: [] }, seo: readSeo(doc) };
}
