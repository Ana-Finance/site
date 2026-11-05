#!/usr/bin/env node
/* Vérifie un site construit (par défaut _site/) avant déploiement :
 *   - pages HTML lisibles, liens et ressources internes existants (chemins relatifs, compatibles /site/) ;
 *   - administration présente ; aucun secret dans les fichiers publiés ;
 *   - clés data-cms cohérentes dans les sources.
 * Usage : node scripts/check-site.mjs [dossier]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { JSDOM } from 'jsdom';
import { ROOT } from './lib/site.mjs';

const dir = resolve(ROOT, process.argv[2] || '_site');
const problems = [];
if (!existsSync(dir)) { console.error(`Dossier ${dir} introuvable : lancer « npm run build » avant.`); process.exit(1); }

function walk(d) { return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
const files = walk(dir);
// Valeurs de secrets (pas les noms de variables, qui peuvent figurer dans des textes d'aide).
const SECRET = /(sb_secret_[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/;
/** Un JWT dont la charge utile déclare role=service_role est une clé de service Supabase. */
function serviceJwt(text) {
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)) {
    try { if (JSON.parse(Buffer.from(m[1], 'base64url').toString()).role === 'service_role') return m[0]; } catch { /* pas un JWT */ }
  }
  return null;
}

for (const f of files) {
  const rel = relative(dir, f);
  if (/\.(html|js|json|css|txt|xml)$/.test(f)) {
    const text = readFileSync(f, 'utf8');
    const m = text.match(SECRET);
    if (m) problems.push(`${rel} : secret détecté (${m[0].slice(0, 12)}…)`);
    if (serviceJwt(text)) problems.push(`${rel} : clé service_role Supabase détectée`);
  }
  if (!f.endsWith('.html') || rel.startsWith('admin/')) continue;
  const doc = new JSDOM(readFileSync(f, 'utf8')).window.document;
  doc.querySelectorAll('a[href], link[href], script[src], img[src]').forEach((el) => {
    const url = el.getAttribute('href') ?? el.getAttribute('src');
    if (!url || /^(https?:|mailto:|tel:|#|data:|\/\/)/.test(url)) return;
    if (url.startsWith('/')) { problems.push(`${rel} : chemin absolu « ${url} » (incompatible avec /site/)`); return; }
    const target = resolve(dirname(f), url.split(/[?#]/)[0]);
    if (!existsSync(target)) problems.push(`${rel} : lien interne cassé « ${url} »`);
  });
}
if (!existsSync(join(dir, 'admin/index.html'))) problems.push('admin/index.html absent');
else if (/src="\/(?!\/)/.test(readFileSync(join(dir, 'admin/index.html'), 'utf8'))) problems.push('admin/index.html : chemins absolus (base Vite incorrecte)');
for (const f of ['index.html', '404.html', 'robots.txt', 'cms-publication.json', '.nojekyll']) if (!existsSync(join(dir, f))) problems.push(`${f} absent`);

if (problems.length) { console.error('✗ ' + problems.length + ' problème(s) :\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`✓ ${files.length} fichiers vérifiés dans ${relative(ROOT, dir) || dir}`);
