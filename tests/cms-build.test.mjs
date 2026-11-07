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

  it('écrit les fichiers techniques', () => {
    for (const f of ['404.html', 'robots.txt', 'cms-publication.json', 'assets/css/site.css', '.nojekyll', 'cms/core.js']) expect(existsSync(join(dir, f)), f).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'cms-publication.json'), 'utf8')).publication_id).toBe('test-publication');
  });
});

describe('annotation du HTML source', () => {
  // Dernier commit avant l'introduction du CMS : référence fixe du HTML d'origine.
  const PRE_CMS = '521a2bab98b5dababc882df93565bf41ee672a95';
  it('ne modifie que des attributs data-cms* par rapport au site d\'origine', () => {
    let original;
    try { original = execFileSync('git', ['show', PRE_CMS + ':index.html'], { cwd: ROOT, stdio: 'pipe' }).toString(); } catch { return; } // historique absent (CI shallow)
    // Changement volontaire : le lien « Accéder à la plateforme » pointe vers le domaine de l'app.
    const strip = (s) => s.replace(/ data-cms(-type|-section)?="[^"]*"/g, '')
      .replaceAll('https://app.ana-finance.com/', 'https://anafinance.lovable.app/');
    // Fichiers modifiés volontairement (envoi réel des formulaires) : vérifiés par les tests de formulaires.
    const INTENTIONAL = new Set(['demo.html', 'ressources.html']);
    for (const file of listPages()) {
      if (INTENTIONAL.has(file)) continue;
      let base;
      try { base = execFileSync('git', ['show', PRE_CMS + ':' + file], { cwd: ROOT, stdio: 'pipe' }).toString(); } catch { continue; }
      expect(strip(readFileSync(join(ROOT, file), 'utf8')), file).toBe(base);
    }
    expect(original.length).toBeGreaterThan(0);
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
    const h1Key = Object.keys(home.content.fields).find((k) => k.endsWith('.h1-1'));
    home.content.fields[h1Key] = { text: 'Nouveau titre <script>alert(1)</script>' };
    home.content.seo.title = 'Titre SEO modifié';
    home.content.sections.hidden = ['s3'];
    const g = pages.find((p) => p.slug === '_global');
    g.content.fields['g.header.a-1'] = { text: 'Prix', href: 'javascript:alert(1)' };
    runBuild(exportFrom(pages), dir);
  });

  it('applique texte, SEO, masquage de section et contenu partagé sur toutes les pages', () => {
    const doc = new JSDOM(readFileSync(join(dir, 'index.html'), 'utf8')).window.document;
    expect(doc.querySelector('h1').textContent).toBe('Nouveau titre <script>alert(1)</script>');
    expect(doc.querySelector('h1 script')).toBeNull();
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
