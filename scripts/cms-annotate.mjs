#!/usr/bin/env node
/* Ajoute une fois pour toutes les attributs data-cms / data-cms-type / data-cms-section
 * aux pages HTML publiques. Le reste du fichier est conservé octet pour octet : seuls des
 * attributs sont insérés dans les balises ouvrantes.
 *
 * Usage : node scripts/cms-annotate.mjs [--dry] [--force]
 *   --dry   affiche le résumé sans écrire
 *   --force réannote un fichier déjà annoté (les clés existantes sont alors régénérées : à éviter
 *           une fois des contenus enregistrés en base)
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { classify, readValue, ATTR, TYPE_ATTR, SECTION_ATTR } from '../cms/core.js';
import { ROOT, listPages, loadDom, slugOf, headerRegion } from './lib/site.mjs';

const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const REFERENCE = 'index.html'; // page de référence pour le header/footer partagés

function stripAnnotations(src) {
  return src.replace(/ data-cms(-type|-section)?="[^"]*"/g, '');
}

function annotateFile(file, globalRef) {
  let { src, dom } = loadDom(file, ROOT, { locations: true });
  if (src.includes(' data-cms=')) {
    if (!FORCE) return { file, skipped: true };
    src = stripAnnotations(src);
    ({ dom } = { dom: new (dom.constructor)(src, { includeNodeLocations: true }) });
  }
  const doc = dom.window.document;
  const slug = slugOf(file);
  const header = headerRegion(doc);
  const footer = doc.querySelector('footer');
  const counters = new Map();
  const items = []; // { el, key, type, globalKey }
  const sections = Array.from(doc.querySelectorAll('section'));
  const sectionKey = new Map(sections.map((s, i) => [s, 's' + (i + 1)]));

  function prefixFor(el) {
    if (header && header.contains(el)) return { prefix: 'g.header', global: true };
    if (footer && footer.contains(el)) return { prefix: 'g.footer', global: true };
    const sec = el.closest('section');
    if (sec) return { prefix: slug + '.' + sectionKey.get(sec), global: false };
    return { prefix: slug + '.page', global: false };
  }

  function nextKey(prefix, el, type) {
    let base = type === 'slot' ? 'slot' : el.tagName.toLowerCase();
    if (type === 'href') {
      // Cartes cliquables : clé dérivée de la destination d'origine (stable même si l'ordre change).
      const target = (el.getAttribute('href') || '').replace(/\.html/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
      base = 'card_' + (target || 'lien');
    }
    const id = prefix + '.' + base;
    const n = (counters.get(id) || 0) + 1;
    counters.set(id, n);
    return id + '-' + n;
  }

  function walk(el) {
    for (const child of Array.from(el.children)) {
      const { type, descend } = classify(child);
      if (type) {
        const { prefix, global } = prefixFor(child);
        const key = nextKey(prefix, child, type);
        items.push({ el: child, key, type, global, value: JSON.stringify(readValue(child, type)) });
      }
      if (descend) walk(child);
    }
  }
  walk(doc.body);

  // Header/footer : une clé globale n'est conservée que si la valeur est identique à celle de la page de référence.
  items.forEach((it) => {
    if (!it.global) return;
    if (globalRef && globalRef.get(it.key) !== it.value) {
      const local = it.key.replace(/^g\.(header|footer)\./, slug + '.$1.');
      it.key = local;
      it.global = false;
    }
  });

  const inserts = [];
  const locOf = (el) => dom.nodeLocation(el).startTag;
  items.forEach((it) => {
    const loc = locOf(it.el);
    inserts.push({ at: tagEnd(src, loc), text: ` ${ATTR}="${it.key}" ${TYPE_ATTR}="${it.type}"` });
  });
  sections.forEach((s) => {
    inserts.push({ at: tagEnd(src, locOf(s)), text: ` ${SECTION_ATTR}="${sectionKey.get(s)}"` });
  });
  inserts.sort((a, b) => b.at - a.at);
  let out = src;
  inserts.forEach((i) => { out = out.slice(0, i.at) + i.text + out.slice(i.at); });
  return { file, out, items, sections: sections.length };
}

/** Position d'insertion dans la balise ouvrante : juste avant « > » ou « /> ». */
function tagEnd(src, loc) {
  let at = loc.endOffset - 1;
  if (src[at] !== '>') throw new Error('Balise inattendue à ' + loc.startOffset);
  if (src[at - 1] === '/') at -= 1;
  return at;
}

// Passe 1 : valeurs de référence des clés globales.
const ref = annotateFile(REFERENCE, null);
const globalRef = new Map();
if (!ref.skipped) ref.items.filter((i) => i.global).forEach((i) => globalRef.set(i.key, i.value));

let total = 0;
for (const file of listPages()) {
  const res = file === REFERENCE ? ref : annotateFile(file, globalRef);
  if (res.skipped) { console.log(`= ${file} déjà annoté (utiliser --force pour régénérer)`); continue; }
  const g = res.items.filter((i) => i.global).length;
  total += res.items.length;
  console.log(`+ ${file.padEnd(28)} ${String(res.items.length).padStart(4)} champs (${g} partagés), ${res.sections} sections`);
  if (!DRY) writeFileSync(join(ROOT, file), res.out);
}
console.log(`${total} champs annotés${DRY ? ' (simulation)' : ''}.`);
