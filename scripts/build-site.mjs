#!/usr/bin/env node
/* Construit le site publié dans _site/ :
 *   - pages publiques avec le contenu publié appliqué (cms/core.js) ;
 *   - médias publiés téléchargés dans assets/media/ ;
 *   - SEO : <head>, sitemap.xml, robots.txt, redirections, 404.html ;
 *   - administration (admin-app/dist → admin/) ;
 *   - cms-publication.json (preuve de publication vérifiée après déploiement).
 *
 * Sources de contenu (par ordre de priorité) :
 *   --content <fichier.json>                     export local (tests, débogage)
 *   CMS_EXPORT_URL + CMS_BUILD_TOKEN [+ PUBLICATION_ID]   Edge Function cms-export
 *   aucune                                       HTML source tel quel (le CMS n'est pas encore configuré)
 *
 * Si le CMS est configuré mais injoignable, le build échoue : on ne republie jamais
 * silencieusement les textes d'origine à la place du contenu publié.
 */
import { mkdirSync, rmSync, cpSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { applyContent, mergeContent, isSafeUrl } from '../cms/core.js';
import { ROOT, listPages, slugOf } from './lib/site.mjs';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : undefined; };
const OUT = resolve(ROOT, arg('--out') || '_site');
const CONTENT_FILE = arg('--content');
let SITE_URL = (process.env.SITE_URL || arg('--site-url') || '').replace(/\/?$/, '/');

const log = (...a) => console.log('[build]', ...a);

export async function loadExport() {
  if (CONTENT_FILE) return JSON.parse(readFileSync(CONTENT_FILE, 'utf8'));
  const url = process.env.CMS_EXPORT_URL;
  const token = process.env.CMS_BUILD_TOKEN;
  if (!url && !token) { log('CMS non configuré : HTML source publié tel quel.'); return null; }
  if (!url || !token) throw new Error('CMS_EXPORT_URL et CMS_BUILD_TOKEN doivent être définis ensemble.');
  const u = new URL(url);
  if (process.env.PUBLICATION_ID) u.searchParams.set('publication', process.env.PUBLICATION_ID);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(u, { headers: { 'x-cms-build-token': token } });
      if (!res.ok) throw new Error(`cms-export HTTP ${res.status} : ${(await res.text()).slice(0, 300)}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };

async function downloadMedia(media) {
  const map = new Map();
  if (!media || !media.length) return map;
  mkdirSync(join(OUT, 'assets/media'), { recursive: true });
  for (const m of media) {
    const ext = EXT[m.mime_type];
    if (!ext || !/^[0-9a-f-]{36}$/.test(m.id)) throw new Error('Média refusé : ' + m.id);
    const rel = `assets/media/${m.id}.${ext}`;
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`Téléchargement du média ${m.id} impossible (HTTP ${res.status})`);
    writeFileSync(join(OUT, rel), Buffer.from(await res.arrayBuffer()));
    map.set(m.id, { path: rel, width: m.width, height: m.height });
  }
  log(`${map.size} média(s) publiés.`);
  return map;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Configuration publique injectée dans les pages (aucun secret : uniquement des identifiants publics). */
function injectPublicConfig(doc, cfg) {
  if (!cfg) return;
  const add = (name, value) => {
    if (!value) return;
    let m = doc.head.querySelector(`meta[name="${name}"]`);
    if (!m) { m = doc.createElement('meta'); m.setAttribute('name', name); doc.head.appendChild(m); }
    m.setAttribute('content', value);
  };
  add('ana:analytics-domain', cfg.analyticsDomain);
  add('ana:analytics-script', cfg.analyticsScript);
  add('ana:supabase-url', cfg.supabaseUrl);
  add('ana:supabase-key', cfg.supabaseAnonKey);
  // Le script de mesure/formulaires n'était présent que sur certaines pages : on l'ajoute partout où il manque.
  if ((cfg.analyticsDomain || cfg.supabaseUrl) && !doc.querySelector('script[src$="assets/js/ana-analytics.js"]')) {
    const sc = doc.createElement('script');
    sc.setAttribute('src', 'assets/js/ana-analytics.js');
    sc.setAttribute('defer', '');
    doc.head.appendChild(sc);
  }
}

export async function build() {
  const exp = await loadExport();
  const settings = (exp && exp.settings) || {};
  if (SITE_URL === '/' && settings.general && /^https:\/\//.test(settings.general.siteUrl || '')) SITE_URL = settings.general.siteUrl.replace(/\/?$/, '/');
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
  writeFileSync(join(OUT, '.nojekyll'), '');
  // Moteur de contenu, servi pour l'aperçu de l'administration (jamais chargé par les pages publiques).
  mkdirSync(join(OUT, 'cms'), { recursive: true });
  cpSync(join(ROOT, 'cms/core.js'), join(OUT, 'cms/core.js'));

  const mediaMap = await downloadMedia(exp && exp.media);
  const resolveMedia = (v) => {
    if (v && v.mediaId) {
      const m = mediaMap.get(v.mediaId);
      if (!m) { log('! média supprimé ou indisponible, ancienne image conservée : ' + v.mediaId); return null; }
      v.width = v.width || m.width; v.height = v.height || m.height;
      return m.path;
    }
    return v && v.src;
  };

  const globalContent = exp && exp.global ? exp.global : null;
  const rows = new Map(((exp && exp.pages) || []).map((p) => [p.slug, p]));
  const sources = new Set(listPages());
  const emitted = [];

  // Fichiers source repris sous un autre slug (page système renommée) : servis via leur nouvelle URL.
  const renamed = new Set(Array.from(rows.values()).filter((r) => !r.file_path && r.template_path && !rows.has(slugOf(r.template_path)) && r.is_system).map((r) => r.template_path));
  // Pages du repository + pages créées dans le CMS (dupliquées depuis un modèle).
  const slugs = new Set([...Array.from(sources).filter((f) => !renamed.has(f)).map(slugOf), ...rows.keys()]);
  for (const slug of slugs) {
    if (slug === '_global') continue;
    const row = rows.get(slug);
    if (row && row.status !== 'published') { log(`- ${slug} (${row.status}) non publiée`); continue; }
    if (!row && exp && exp.archived && exp.archived.includes(slug)) { log(`- ${slug} archivée`); continue; }
    const file = row ? (row.file_path || row.template_path) : slug + '.html';
    if (!file || !sources.has(file)) { log(`! ${slug} : modèle introuvable, ignorée`); continue; }
    const dom = new JSDOM(readFileSync(join(ROOT, file), 'utf8'));
    const doc = dom.window.document;
    const pagePath = slug + '.html';
    const content = mergeContent(globalContent, row ? row.content : null);
    // Image de partage par défaut (Paramètres → SEO global) pour les pages qui n'en ont pas.
    if (content.seo && !content.seo.ogImage && settings.seo && settings.seo.defaultOgImage) content.seo = { ...content.seo, ogImage: { ...settings.seo.defaultOgImage } };
    const res = applyContent(doc, content, { resolveMedia, siteUrl: SITE_URL !== '/' ? SITE_URL : undefined, pagePath });
    if (res.missing.length) log(`! ${slug} : ${res.missing.length} clé(s) sans élément HTML (ignorées)`);
    injectPublicConfig(doc, exp && exp.public);
    injectSocial(doc, pagePath, settings);
    if (slug === 'index') injectOrganization(doc, settings, SITE_URL !== '/' ? SITE_URL : null);
    writeFileSync(join(OUT, pagePath), dom.serialize());
    const noindex = !!doc.head.querySelector('meta[name="robots"][content*="noindex"]');
    emitted.push({ path: pagePath, noindex, lastmod: row && row.published_at });
  }

  // Redirections (changement de slug) : page HTML minimale, GitHub Pages n'ayant pas de redirections serveur.
  for (const r of (exp && exp.redirects) || []) {
    const from = String(r.from_path || '').replace(/^\//, '');
    const to = String(r.to_path || '');
    if (!/^[a-z0-9][a-z0-9-]*\.html$/.test(from) || !isSafeUrl(to) || existsSync(join(OUT, from))) continue;
    writeFileSync(join(OUT, from), `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Redirection</title><meta name="robots" content="noindex"><link rel="canonical" href="${esc(to)}"><meta http-equiv="refresh" content="0; url=${esc(to)}"></head><body><p>Cette page a été déplacée : <a href="${esc(to)}">${esc(to)}</a>.</p></body></html>\n`);
  }

  write404();
  writeSeoFiles(emitted);

  const adminDist = join(ROOT, 'admin-app/dist');
  if (existsSync(adminDist)) cpSync(adminDist, join(OUT, 'admin'), { recursive: true });
  else log('! admin-app/dist absent : lancer « npm run build:admin » avant.');

  const manifest = {
    publication_id: (exp && exp.publication && exp.publication.id) || null,
    built_at: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || null,
    pages: emitted.length,
  };
  writeFileSync(join(OUT, 'cms-publication.json'), JSON.stringify(manifest, null, 2) + '\n');
  log(`${emitted.length} page(s) écrites dans ${OUT}`);
  return { emitted, manifest };
}

/** Image de partage du dépôt : utilisée quand ni la page ni les paramètres du CMS n'en définissent. */
const DEFAULT_OG_IMAGE = { path: 'assets/img/partage-ana-finance.png', width: 1200, height: 630 };

/**
 * Balises de partage (LinkedIn, WhatsApp, Teams, messageries) : complète ce que le contenu n'a pas fourni.
 * Rien n'est remplacé ; sans URL publique du site, rien n'est ajouté (une image de partage doit être absolue).
 */
function injectSocial(doc, pagePath, settings) {
  if (!SITE_URL || SITE_URL === '/') return;
  const get = (attr, name) => doc.head.querySelector(`meta[${attr}="${name}"]`);
  const add = (attr, name, content) => {
    if (!content || get(attr, name)) return;
    const m = doc.createElement('meta');
    m.setAttribute(attr, name);
    m.setAttribute('content', content);
    doc.head.appendChild(m);
  };
  if (!get('property', 'og:image') && existsSync(join(ROOT, DEFAULT_OG_IMAGE.path))) {
    add('property', 'og:image', new URL(DEFAULT_OG_IMAGE.path, SITE_URL).href);
    add('property', 'og:image:width', String(DEFAULT_OG_IMAGE.width));
    add('property', 'og:image:height', String(DEFAULT_OG_IMAGE.height));
  }
  add('property', 'og:url', new URL(pagePath === 'index.html' ? '' : pagePath, SITE_URL).href);
  add('property', 'og:site_name', (settings.general && settings.general.siteName) || 'Ana Finance');
  add('property', 'og:locale', 'fr_FR');
  if (get('property', 'og:image')) add('name', 'twitter:card', 'summary_large_image');
}

/** Données structurées schema.org Organization (accueil), à partir des paramètres du CMS. */
function injectOrganization(doc, settings, siteUrl) {
  const g = settings.general || {}; const c = settings.contact || {}; const so = settings.social || {};
  if (!g.siteName || !siteUrl) return;
  const sameAs = [so.linkedin, so.x, so.youtube].filter((u) => typeof u === 'string' && /^https:\/\//.test(u));
  const data = { '@context': 'https://schema.org', '@type': 'Organization', name: g.siteName, url: siteUrl, logo: new URL('assets/img/ana-logo-icon.png', siteUrl).href };
  if (c.email) data.email = c.email;
  if (c.phone) data.telephone = c.phone;
  if (c.address) data.address = c.address;
  if (sameAs.length) data.sameAs = sameAs;
  const s = doc.createElement('script');
  s.setAttribute('type', 'application/ld+json');
  s.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  doc.head.appendChild(s);
}

/**
 * Page 404 aux couleurs du site : l'accueil déjà construit (en-tête, pied de page, styles, scripts), dont le
 * contenu est remplacé par le message d'erreur. Elle suit donc toujours l'en-tête et le pied publiés.
 * GitHub Pages la sert à n'importe quelle profondeur : une balise <base> ramène tous les liens à la racine.
 */
function write404() {
  if (existsSync(join(ROOT, '404.html'))) return cpSync(join(ROOT, '404.html'), join(OUT, '404.html'));
  const home = join(OUT, 'index.html');
  const dom = existsSync(home) ? new JSDOM(readFileSync(home, 'utf8')) : null;
  const main = dom && dom.window.document.querySelector('main');
  if (!main) return writeFallback404();
  const doc = dom.window.document;
  const BTN = 'text-decoration:none;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:14px 26px;font-size:15px;font-weight:600;font-family:inherit;';
  main.innerHTML = `
    <section id="main" style="max-width:1440px;margin:0 auto;padding:88px 40px 104px;">
      <span style="display:block;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8b1fe0;margin:0 0 14px;">Erreur 404</span>
      <h1 class="ana-hero-h1" style="font-size:clamp(30px,5.6vw,61px);line-height:1.12;letter-spacing:-0.025em;font-weight:800;margin:0;max-width:24ch;">Cette page n'existe pas, ou plus.</h1>
      <p style="font-size:18px;line-height:29px;max-width:70ch;margin:24px 0 0;color:#514f60;">L'adresse a peut-être changé. Repartez de l'accueil, ou allez directement à l'une des pages les plus consultées.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:32px;">
        <a href="./" style="${BTN}background:linear-gradient(135deg,#000000,#8b1fe0 55%,#f23fd6 100%);color:#fff;">Retour à l'accueil</a>
        <a href="comment-ca-marche.html" style="${BTN}background:#fff;color:#16151c;border:1.5px solid #dcd9e6;">Comment ça marche</a>
        <a href="ressources.html#tarifs" style="${BTN}background:#fff;color:#16151c;border:1.5px solid #dcd9e6;">Tarifs</a>
        <a href="demo.html" style="${BTN}background:#fff;color:#16151c;border:1.5px solid #dcd9e6;">Demander une démo</a>
      </div>
    </section>`;
  doc.title = 'Page introuvable — Ana Finance';
  doc.head.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], meta[name="cms:seo-rev"], link[rel="canonical"], script[type="application/ld+json"]').forEach((el) => el.remove());
  let robots = doc.head.querySelector('meta[name="robots"]');
  if (!robots) { robots = doc.createElement('meta'); robots.setAttribute('name', 'robots'); doc.head.appendChild(robots); }
  robots.setAttribute('content', 'noindex');
  // Le lien d'évitement et les clés du CMS n'ont pas de sens ici (page générée, non éditable).
  doc.querySelectorAll('.ana-skip').forEach((el) => el.remove());
  doc.querySelectorAll('[data-cms], [data-cms-type], [data-cms-section]').forEach((el) => { el.removeAttribute('data-cms'); el.removeAttribute('data-cms-type'); el.removeAttribute('data-cms-section'); });
  // <base> calculé avant tout chargement : racine du domaine, ou /<dépôt>/ sous github.io.
  const base = doc.createElement('script');
  base.textContent = "(function(){var p=location.pathname.split('/');var b=location.hostname.endsWith('github.io')&&p[1]?'/'+p[1]+'/':'/';document.write('<base href=\"'+b+'\">');})();";
  const charset = doc.head.querySelector('meta[charset]');
  doc.head.insertBefore(base, charset ? charset.nextSibling : doc.head.firstChild);
  writeFileSync(join(OUT, '404.html'), dom.serialize());
}

/** Secours : page 404 minimale, si l'accueil n'a pas pu servir de modèle. */
function writeFallback404() {
  writeFileSync(join(OUT, '404.html'), `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page introuvable — Ana Finance</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui,sans-serif;background:#f8f9fc;color:#16151c;text-align:center;padding:24px}a{color:#8b1fe0;font-weight:600}</style>
</head><body><main><h1>Page introuvable</h1><p>Cette page n'existe pas ou a été déplacée.</p>
<p><a id="home" href="index.html">Retour à l'accueil</a></p></main>
<script>/* GitHub Pages sert 404.html à n'importe quelle profondeur : on calcule le lien vers la racine du site. */
(function(){var p=location.pathname.split('/');var base=location.hostname.endsWith('github.io')&&p[1]?'/'+p[1]+'/':'/';document.getElementById('home').href=base;})();</script>
</body></html>
`);
}

function writeSeoFiles(emitted) {
  const lines = ['User-agent: *', 'Disallow: /admin/'];
  if (SITE_URL && SITE_URL !== '/') {
    // Sous un chemin de base (/site/), le Disallow doit inclure ce chemin.
    const base = new URL(SITE_URL).pathname;
    lines[1] = 'Disallow: ' + base + 'admin/';
    const urls = emitted.filter((e) => !e.noindex).map((e) => {
      const loc = new URL(e.path === 'index.html' ? '' : e.path, SITE_URL).href;
      return `  <url><loc>${esc(loc)}</loc>${e.lastmod ? `<lastmod>${esc(String(e.lastmod).slice(0, 10))}</lastmod>` : ''}</url>`;
    });
    writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
    lines.push('', 'Sitemap: ' + new URL('sitemap.xml', SITE_URL).href);
  }
  writeFileSync(join(OUT, 'robots.txt'), lines.join('\n') + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch((e) => { console.error('[build] ÉCHEC :', e.message); process.exit(1); });
}

export { OUT, dirname };
