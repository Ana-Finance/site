// Lecture du contenu initial depuis le HTML source (utilisé par le seed et les tests).
import { extractContent } from '../../cms/core.js';
import { listPages, loadDom, slugOf } from './site.mjs';

export const GLOBAL_SLUG = '_global';
export const REFERENCE_PAGE = 'index.html';

export function pageTitle(doc) {
  const h1 = doc.querySelector('h1');
  const t = (doc.title || '').split(/\s+[—|-]\s+/)[0].trim();
  return t || (h1 ? h1.textContent.trim() : '');
}

/** Contenus initiaux : une entrée par page + la pseudo-page _global. */
export function initialContent(root) {
  const pages = listPages(root).map((file, i) => {
    const { dom } = loadDom(file, root);
    const doc = dom.window.document;
    return { slug: slugOf(file), file_path: file, title: slugOf(file) === 'index' ? 'Accueil' : pageTitle(doc), sort_order: i + 1, content: extractContent(doc, { scope: 'page' }) };
  });
  const { dom } = loadDom(REFERENCE_PAGE, root);
  const global = { slug: GLOBAL_SLUG, file_path: null, title: 'En-tête et pied de page', sort_order: 0, content: extractContent(dom.window.document, { scope: 'global' }) };
  return [global, ...pages];
}
