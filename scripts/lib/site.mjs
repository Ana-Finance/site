// Utilitaires partagés par les scripts du site (Node uniquement).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Pages publiques : tous les .html à la racine du repository. */
export function listPages(root = ROOT) {
  return readdirSync(root).filter((f) => f.endsWith('.html')).sort();
}

export const slugOf = (file) => file.replace(/\.html$/, '');

export function loadDom(file, root = ROOT, opts = {}) {
  const src = readFileSync(join(root, file), 'utf8');
  return { src, dom: new JSDOM(src, { includeNodeLocations: !!opts.locations }) };
}

/** Sérialisation fidèle à ce que produit un navigateur (doctype + documentElement). */
export function serialize(dom) {
  return dom.serialize();
}

/** Zone d'en-tête partagée : le bloc qui contient la <nav> principale et le méga-menu. */
export function headerRegion(doc) {
  const canvas = doc.querySelector('.ana-canvas');
  if (!canvas) return null;
  for (const el of canvas.children) {
    if (el.hasAttribute('data-on-mouseleave') && el.querySelector('nav')) return el;
  }
  return null;
}
