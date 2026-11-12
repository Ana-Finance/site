// Non-régression du site public : publier le contenu initial doit redonner exactement le DOM d'origine.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JSDOM } from 'jsdom';
import { ROOT, listPages } from '../scripts/lib/site.mjs';
import { initialContent } from '../scripts/lib/content.mjs';
import { extractModel, applyContent, mergeContent } from '../cms/core.js';

const out = mkdtempSync(join(tmpdir(), 'ana-build-'));
const contentFile = join(out, 'export.json');

function exportFrom(pages) {
  const global = pages.find((p) => p.slug === '_global');
  return {
    publication: { id: 'test-publication' },
    global: global.content,
    pages: pages.filter((p) => p.slug !== '_global').map((p) => ({ ...p, status: 'published' })),
    media: [],
    redirects: [],
  };
}
function runBuild(exp, dir) {
  writeFileSync(contentFile, JSON.stringify(exp));
  execFileSync('node', ['scripts/build-site.mjs', '--content', contentFile, '--out', dir], { cwd: ROOT, stdio: 'pipe' });
}
const norm = (html) => new JSDOM(html).serialize();

describe('build du site avec le contenu initial', () => {
  const dir = join(out, 'site');
  beforeAll(() => runBuild(exportFrom(initialContent(ROOT)), dir));

  for (const file of listPages()) {
    it(`${file} : DOM identique à la source`, () => {
      const src = norm(readFileSync(join(ROOT, file), 'utf8'));
      const built = readFileSync(join(dir, file), 'utf8');
      expect(built).toBe(src);
    });
  }

  it('page 404 aux couleurs du site, non indexée et sans clé du CMS', () => {
    const html = readFileSync(join(dir, '404.html'), 'utf8');
    const doc = new JSDOM(html).window.document;
    expect(doc.title).toBe('Page introuvable — Ana Finance');
    expect(doc.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex');
    expect(doc.querySelector('nav'), 'en-tête du site').not.toBeNull();
    expect(doc.querySelector('footer'), 'pied de page du site').not.toBeNull();
    expect(doc.querySelector('main h1').textContent).toContain("n'existe pas");
    expect(doc.querySelector('[data-cms]')).toBeNull();
    expect(html).toContain('<base href=');
  });

  it('écrit les fichiers techniques', () => {
    for (const f of ['404.html', 'robots.txt', 'cms-publication.json', 'assets/css/site.css', '.nojekyll', 'cms/core.js']) expect(existsSync(join(dir, f)), f).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'cms-publication.json'), 'utf8')).publication_id).toBe('test-publication');
  });
});

describe('annotation du HTML source', () => {
  // Le contenu des pages évolue désormais dans le HTML comme dans le CMS : on ne compare plus au site
  // d'avant le CMS. On vérifie à la place que tout élément éditable porte une clé, et qu'aucun champ
  // modifié n'a gardé une clé dont l'ancienne valeur est encore enregistrée en base (scripts/cms-rekey.mjs).
  it('clés à jour : aucun élément éditable sans clé, aucun champ modifié sous une ancienne clé', () => {
    let hasBase = true;
    try { execFileSync('git', ['rev-parse', '--verify', '--quiet', 'origin/main^{commit}'], { cwd: ROOT, stdio: 'pipe' }); } catch { hasBase = false; }
    const args = ['scripts/cms-rekey.mjs', '--check'];
    if (!hasBase) args.push('--base', 'HEAD'); // historique absent (CI en clone superficiel) : contrôle des clés manquantes seulement
    execFileSync('node', args, { cwd: ROOT, stdio: 'pipe' });
  });

  it('clés uniques par page, sauf éléments partagés de valeur identique', () => {
    for (const file of listPages()) {
      const doc = new JSDOM(readFileSync(join(ROOT, file), 'utf8')).window.document;
      const seen = new Map();
      for (const f of extractModel(doc).fields) {
        if (seen.has(f.key)) expect(JSON.stringify(seen.get(f.key)), `${file} ${f.key}`).toBe(JSON.stringify(f.value));
        seen.set(f.key, f.value);
      }
    }
  });
});

describe('publication d\'une modification', () => {
  const dir = join(out, 'site-edit');
  beforeAll(() => {
    const pages = initialContent(ROOT);
    const home = pages.find((p) => p.slug === 'index');
    // Le grand titre est un texte riche (un mot en dégradé), le paragraphe qui le suit un texte simple.
    const src = new JSDOM(readFileSync(join(ROOT, 'index.html'), 'utf8')).window.document;
    const h1 = src.querySelector('h1');
    const lead = src.querySelector('h1 + p');
    expect(h1.getAttribute('data-cms-type')).toBe('rich');
    expect(lead.getAttribute('data-cms-type')).toBe('text');
    home.content.fields[h1.getAttribute('data-cms')] = { html: 'Nouveau <span class="ana-grad">titre</span><script>alert(1)</script>' };
    home.content.fields[lead.getAttribute('data-cms')] = { text: 'Nouveau texte <script>alert(1)</script>' };
    home.content.seo.title = 'Titre SEO modifié';
    home.content.sections.hidden = ['s3'];
    const g = pages.find((p) => p.slug === '_global');
    g.content.fields['g.header.a-1'] = { text: 'Prix', href: 'javascript:alert(1)' };
    runBuild(exportFrom(pages), dir);
  });

  it('applique texte, SEO, masquage de section et contenu partagé sur toutes les pages', () => {
    const doc = new JSDOM(readFileSync(join(dir, 'index.html'), 'utf8')).window.document;
    expect(doc.querySelector('h1').textContent).toBe('Nouveau titre'); // texte riche : script supprimé, mise en forme autorisée conservée
    expect(doc.querySelector('h1 .ana-grad').textContent).toBe('titre');
    expect(doc.querySelector('h1 + p').textContent).toBe('Nouveau texte <script>alert(1)</script>'); // texte simple : jamais interprété
    expect(doc.querySelector('h1 script, h1 + p script')).toBeNull();
    expect(doc.title).toBe('Titre SEO modifié');
    expect(doc.querySelector('[data-cms-section="s3"]').hasAttribute('hidden')).toBe(true);
    for (const f of ['index.html', 'agents.html', 'ressources.html']) {
      const d = new JSDOM(readFileSync(join(dir, f), 'utf8')).window.document;
      const a = d.querySelector('[data-cms="g.header.a-1"]');
      expect(a.textContent.trim()).toBe('Prix');
      expect(a.getAttribute('href')).toBe('ressources.html#tarifs'); // URL javascript: refusée
    }
  });
});

describe('textes SEO révisés dans le HTML', () => {
  const dirOld = join(out, 'site-seo-ancien');
  const dirNew = join(out, 'site-seo-cms');
  const withSeo = (seo) => {
    const pages = initialContent(ROOT);
    const home = pages.find((p) => p.slug === 'index');
    home.content.seo = { ...home.content.seo, ...seo };
    return exportFrom(pages);
  };
  beforeAll(() => {
    const stale = withSeo({ title: 'Ancien titre enregistré', description: 'Ancienne description' });
    delete stale.pages.find((p) => p.slug === 'index').content.seo.rev; // contenu enregistré avant la révision du HTML
    runBuild(stale, dirOld);
    runBuild(withSeo({ title: 'Titre choisi dans le CMS' }), dirNew); // seo.rev à jour (lu dans le HTML)
  });
  it('un contenu plus ancien que la révision du HTML ne remplace pas le titre ni la description', () => {
    const src = new JSDOM(readFileSync(join(ROOT, 'index.html'), 'utf8')).window.document;
    const doc = new JSDOM(readFileSync(join(dirOld, 'index.html'), 'utf8')).window.document;
    expect(doc.title).toBe(src.title);
    expect(doc.querySelector('meta[name="description"]').getAttribute('content')).toBe(src.querySelector('meta[name="description"]').getAttribute('content'));
  });
  it('un contenu enregistré depuis la révision prime de nouveau', () => {
    const doc = new JSDOM(readFileSync(join(dirNew, 'index.html'), 'utf8')).window.document;
    expect(doc.title).toBe('Titre choisi dans le CMS');
  });
});

describe('cms/core en mémoire', () => {
  it('assainit le HTML riche', () => {
    const doc = new JSDOM('<p data-cms="k" data-cms-type="rich">a</p>').window.document;
    applyContent(doc, mergeContent(null, { fields: { k: { html: 'ok <img src=x onerror=alert(1)><a href="javascript:x" onclick="y">l</a><span style="background:url(http://e)">s</span><strong>b</strong>' } } }));
    const html = doc.querySelector('p').innerHTML;
    expect(html).toBe('ok <a>l</a><span>s</span><strong>b</strong>');
  });
});

describe('configuration publique injectée au build', () => {
  const dir = join(out, 'site-config');
  beforeAll(() => {
    const exp = exportFrom(initialContent(ROOT));
    exp.public = { analyticsDomain: 'ana.example', analyticsScript: 'https://plausible.io/js/script.js', supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' };
    exp.settings = { general: { siteName: 'Ana Finance', siteUrl: 'https://ana.example/site/' }, contact: { email: 'contact@ana.example' }, social: { linkedin: 'https://linkedin.com/company/ana', x: 'javascript:alert(1)' } };
    runBuild(exp, dir);
  });
  it('script de mesure présent sur toutes les pages, sans secret', () => {
    for (const file of listPages()) {
      const html = readFileSync(join(dir, file), 'utf8');
      const doc = new JSDOM(html).window.document;
      expect(doc.querySelectorAll('script[src$="assets/js/ana-analytics.js"]').length, file).toBe(1);
      expect(doc.querySelector('meta[name="ana:analytics-domain"]').getAttribute('content')).toBe('ana.example');
      expect(html).not.toMatch(/service_role|PLAUSIBLE_API_KEY|CMS_BUILD_TOKEN/);
    }
  });
  it('canonical, sitemap, robots et données structurées depuis les paramètres', () => {
    const doc = new JSDOM(readFileSync(join(dir, 'index.html'), 'utf8')).window.document;
    expect(doc.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://ana.example/site/');
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
    expect(ld).toMatchObject({ '@type': 'Organization', name: 'Ana Finance', email: 'contact@ana.example', sameAs: ['https://linkedin.com/company/ana'] });
    const sitemap = readFileSync(join(dir, 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://ana.example/site/agents.html</loc>');
    expect(readFileSync(join(dir, 'robots.txt'), 'utf8')).toContain('Disallow: /site/admin/');
  });
  it('balises de partage : image par défaut du dépôt, adresse de la page, carte large', () => {
    for (const file of ['index.html', 'agents.html']) {
      const doc = new JSDOM(readFileSync(join(dir, file), 'utf8')).window.document;
      const meta = (sel) => doc.head.querySelector(sel)?.getAttribute('content');
      expect(meta('meta[property="og:image"]'), file).toBe('https://ana.example/site/assets/img/partage-ana-finance.png');
      expect(meta('meta[property="og:url"]'), file).toBe('https://ana.example/site/' + (file === 'index.html' ? '' : file));
      expect(meta('meta[name="twitter:card"]'), file).toBe('summary_large_image');
    }
    expect(existsSync(join(dir, 'assets/img/partage-ana-finance.png'))).toBe(true);
  });
});

describe('check-site', () => {
  it('bloque un site contenant une clé service_role', () => {
    const dir = join(out, 'site');
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role: 'service_role' })}.c2lnbmF0dXJlLWZhdXNzZQ`;
    writeFileSync(join(dir, 'assets/js/fuite.js'), `const k = "${jwt}";`);
    let failed = false;
    try { execFileSync('node', ['scripts/check-site.mjs', dir], { cwd: ROOT, stdio: 'pipe' }); } catch (e) { failed = String(e.stderr).includes('service_role'); }
    expect(failed).toBe(true);
  });
});
