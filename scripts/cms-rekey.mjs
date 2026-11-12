#!/usr/bin/env node
/* Garde les clés data-cms cohérentes après une modification du HTML des pages.
 *
 * Le build applique le contenu publié du CMS par-dessus le HTML : pour une clé déjà en base, c'est la
 * valeur enregistrée qui s'affiche, même si le texte du HTML a changé depuis. Ce script évite ce piège
 * sans toucher à la base :
 *   1. un champ dont la valeur diffère de la version de référence (par défaut origin/main) reçoit une
 *      NOUVELLE clé : l'ancienne valeur en base ne s'applique plus, c'est le HTML qui fait foi ;
 *   2. un élément éditable sans clé (nouveau texte, nouveau lien…) en reçoit une ;
 *   3. un champ dont le type déclaré ne correspond plus à son contenu (un texte simple où l'on a mis une partie
 *      en forme, par exemple) reçoit le bon type, et une nouvelle clé si l'ancienne existe déjà en base.
 * Les clés partagées (g.header.*, g.footer.*) sont décidées sur la page de référence puis reprises à
 * l'identique sur toutes les pages. Seuls des attributs data-cms* sont écrits : le reste du fichier est
 * conservé octet pour octet.
 *
 * Usage : node scripts/cms-rekey.mjs [--base <ref git>] [--dry] [--check]
 *   --base   version de comparaison (défaut : origin/main, sinon main)
 *   --dry    affiche ce qui serait fait, sans écrire
 *   --check  échoue (code 1) s'il reste quelque chose à faire : pour la CI et les tests
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { classify, readValue, ATTR, TYPE_ATTR, FIELD_TYPES } from '../cms/core.js';
import { ROOT, listPages, slugOf, headerRegion } from './lib/site.mjs';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry') || args.includes('--check');
const CHECK = args.includes('--check');
const REFERENCE = 'index.html';

function git(...a) { return execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); }
function resolveBase() {
  const i = args.indexOf('--base');
  const wanted = i > -1 ? [args[i + 1]] : ['origin/main', 'main'];
  for (const ref of wanted) { try { git('rev-parse', '--verify', '--quiet', ref + '^{commit}'); return ref; } catch { /* suivant */ } }
  return null;
}
const BASE = resolveBase();

/** Champs d'un document : clé → { type, value (JSON) }. Première occurrence d'une clé seulement. */
function fieldsOf(doc) {
  const map = new Map();
  doc.querySelectorAll('[' + ATTR + ']').forEach((el) => {
    const key = el.getAttribute(ATTR);
    const type = el.getAttribute(TYPE_ATTR);
    if (!FIELD_TYPES.includes(type) || map.has(key)) return;
    map.set(key, { type, value: JSON.stringify(readValue(el, type)) });
  });
  return map;
}
function baseFields(file) {
  if (!BASE) return null;
  try { return fieldsOf(new JSDOM(git('show', `${BASE}:${file}`)).window.document); } catch { return null; } // nouvelle page
}

/** Famille d'une clé (« index.s5.p » pour « index.s5.p-2 ») et son numéro. */
const splitKey = (key) => { const m = key.match(/^(.*)-(\d+)$/); return m ? { family: m[1], n: Number(m[2]) } : { family: key, n: 0 }; };

class Numbering {
  constructor() { this.max = new Map(); }
  see(key) { const { family, n } = splitKey(key); if (n > (this.max.get(family) || 0)) this.max.set(family, n); }
  next(family) { const n = (this.max.get(family) || 0) + 1; this.max.set(family, n); return family + '-' + n; }
}

function load(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const dom = new JSDOM(src, { includeNodeLocations: true });
  return { file, src, dom, doc: dom.window.document, slug: slugOf(file) };
}

/** Éléments éditables sans clé, dans l'ordre du document (même parcours que cms-annotate). */
function unannotated(page) {
  const out = [];
  (function walk(el) {
    for (const child of Array.from(el.children)) {
      if (child.hasAttribute(ATTR)) { if (child.getAttribute(TYPE_ATTR) === 'href') walk(child); continue; }
      const { type, descend } = classify(child);
      if (type) out.push({ el: child, type });
      if (descend) walk(child);
    }
  })(page.doc.body);
  return out;
}

function regionPrefix(page, el) {
  const header = headerRegion(page.doc);
  const footer = page.doc.querySelector('footer');
  if (header && header.contains(el)) return { prefix: 'g.header', global: true };
  if (footer && footer.contains(el)) return { prefix: 'g.footer', global: true };
  const sec = el.closest('[data-cms-section]');
  return { prefix: page.slug + '.' + (sec ? sec.getAttribute('data-cms-section') : 'page'), global: false };
}
function familyFor(page, el, type) {
  const { prefix, global } = regionPrefix(page, el);
  let base = type === 'slot' ? 'slot' : el.tagName.toLowerCase();
  if (type === 'href') {
    const target = (el.getAttribute('href') || '').replace(/\.html/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
    base = 'card_' + (target || 'lien');
  }
  return { family: prefix + '.' + base, global };
}

const problems = [];
const pages = listPages().map(load);
const ref = pages.find((p) => p.file === REFERENCE);

// Numérotation : jamais de clé déjà utilisée, ni dans les fichiers actuels ni dans la version de référence
// (une clé réutilisée récupérerait l'ancienne valeur enregistrée en base).
const numbering = new Numbering();
const bases = new Map();
for (const p of pages) {
  fieldsOf(p.doc).forEach((_, k) => numbering.see(k));
  const b = baseFields(p.file);
  bases.set(p.file, b);
  if (b) b.forEach((_, k) => numbering.see(k));
}

// 1. Clés partagées modifiées : décidées une fois, sur la page de référence.
const globalRenames = new Map(); // ancienne clé → nouvelle clé
const refBase = bases.get(REFERENCE);
if (refBase) {
  fieldsOf(ref.doc).forEach((f, key) => {
    if (!key.startsWith('g.')) return;
    const before = refBase.get(key);
    if (before && before.value !== f.value) globalRenames.set(key, numbering.next(splitKey(key).family));
  });
}

/** Types interchangeables selon le contenu de l'élément : un texte devient « riche » dès qu'il contient une balise. */
const TEXTUAL = ['text', 'rich', 'link'];
/** Type réel d'un élément annoté s'il diffère du type déclaré, sinon null. */
function mismatch(el) {
  const declared = el.getAttribute(TYPE_ATTR);
  if (!TEXTUAL.includes(declared)) return null;
  const probe = el.cloneNode(true);
  probe.removeAttribute(ATTR);
  const actual = classifyDetached(el, probe);
  return actual && actual !== declared && TEXTUAL.includes(actual) ? actual : null;
}

let renamed = 0; let added = 0; let retyped = 0;
for (const page of pages) {
  const edits = []; // { at, del, text }
  const startTag = (el) => page.dom.nodeLocation(el).startTag;
  const base = bases.get(page.file);
  const current = fieldsOf(page.doc);
  const renames = new Map();

  current.forEach((f, key) => {
    if (key.startsWith('g.')) {
      if (!globalRenames.has(key)) return;
      // Même valeur que sur la page de référence, sinon la clé partagée ne peut pas être reprise telle quelle.
      const refValue = fieldsOf(ref.doc).get(key);
      if (refValue && refValue.value !== f.value) { problems.push(`${page.file} : « ${key} » diffère de ${REFERENCE} (valeur partagée attendue)`); return; }
      renames.set(key, globalRenames.get(key));
      return;
    }
    const before = base && base.get(key);
    if (before && before.value !== f.value) renames.set(key, numbering.next(splitKey(key).family));
  });
  // Type déclaré ≠ contenu réel : la valeur enregistrée sous cette clé n'a plus la bonne forme, il faut une nouvelle clé
  // si la clé existe déjà dans la version de référence (sinon corriger le type suffit).
  const seenKeys = new Set();
  page.doc.querySelectorAll('[' + ATTR + ']').forEach((el) => {
    const key = el.getAttribute(ATTR);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    if (!mismatch(el) || renames.has(key)) return;
    if (key.startsWith('g.')) { problems.push(`${page.file} : « ${key} » (élément partagé) n'a plus le type de son contenu : corriger ${TYPE_ATTR} à la main, avec une nouvelle clé g.* sur toutes les pages`); return; }
    if (base && base.has(key)) renames.set(key, numbering.next(splitKey(key).family));
  });

  page.doc.querySelectorAll('[' + ATTR + ']').forEach((el) => {
    const key = el.getAttribute(ATTR);
    const actual = mismatch(el);
    if (!renames.has(key) && !actual) return;
    const loc = startTag(el);
    const tag = page.src.slice(loc.startOffset, loc.endOffset);
    if (renames.has(key)) {
      const needle = `${ATTR}="${key}"`;
      const i = tag.indexOf(needle);
      if (i < 0) { problems.push(`${page.file} : attribut ${needle} introuvable dans la balise`); return; }
      edits.push({ at: loc.startOffset + i, del: needle.length, text: `${ATTR}="${renames.get(key)}"` });
      renamed++;
    }
    // Le type suit le contenu réel (un texte devenu riche, par exemple).
    if (actual) {
      const tNeedle = `${TYPE_ATTR}="${el.getAttribute(TYPE_ATTR)}"`;
      const j = tag.indexOf(tNeedle);
      if (j < 0) { problems.push(`${page.file} : attribut ${tNeedle} introuvable dans la balise de « ${key} »`); return; }
      edits.push({ at: loc.startOffset + j, del: tNeedle.length, text: `${TYPE_ATTR}="${actual}"` });
      if (!renames.has(key)) retyped++;
    }
  });

  for (const { el, type } of unannotated(page)) {
    const { family, global } = familyFor(page, el, type);
    if (global) { problems.push(`${page.file} : élément éditable sans clé dans l'en-tête ou le pied (${el.tagName.toLowerCase()} « ${el.textContent.trim().slice(0, 40)} ») : lui donner une clé g.* à la main, identique sur toutes les pages`); continue; }
    const loc = startTag(el);
    let at = loc.endOffset - 1;
    if (page.src[at] !== '>') { problems.push(`${page.file} : balise inattendue à ${loc.startOffset}`); continue; }
    if (page.src[at - 1] === '/') at -= 1;
    edits.push({ at, del: 0, text: ` ${ATTR}="${numbering.next(family)}" ${TYPE_ATTR}="${type}"` });
    added++;
  }

  if (!edits.length) continue;
  edits.sort((a, b) => b.at - a.at);
  let out = page.src;
  for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.at + e.del);
  console.log(`${DRY ? '~' : '+'} ${page.file.padEnd(28)} ${String(renames.size).padStart(3)} clé(s) renommée(s), ${edits.filter((e) => e.del === 0).length} ajoutée(s), ${edits.filter((e) => e.text.startsWith(TYPE_ATTR + '=')).length} type(s) corrigé(s)`);
  if (!DRY) writeFileSync(join(ROOT, page.file), out);
}

/** Type d'un élément déjà annoté, comme s'il ne l'était pas (le classement ignore sa propre clé). */
function classifyDetached(el, probe) {
  // classify() ne regarde que l'élément et sa descendance : on l'évalue sur une copie sans data-cms.
  const holder = el.ownerDocument.createElement('div');
  holder.appendChild(probe);
  return classify(probe).type;
}

if (!BASE) console.log('! Aucune version de référence (origin/main ou main) : seules les clés manquantes sont traitées.');
console.log(`${renamed} clé(s) renommée(s), ${added} clé(s) ajoutée(s), ${retyped} type(s) corrigé(s) sans changement de clé${DRY ? ' (simulation)' : ''}${BASE ? ' — référence ' + BASE : ''}.`);
if (problems.length) { console.error('✗ ' + problems.join('\n✗ ')); process.exit(1); }
if (CHECK && (renamed || added || retyped)) { console.error('✗ Des clés data-cms sont à mettre à jour : lancer « npm run cms:rekey ».'); process.exit(1); }
