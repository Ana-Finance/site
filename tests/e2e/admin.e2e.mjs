#!/usr/bin/env node
// Test de bout en bout de l'administration (Playwright + faux backend en mémoire + site servi sous /site/).
// Usage : node tests/e2e/admin.e2e.mjs [--screens]
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { ROOT } from '../../scripts/lib/site.mjs';
import { startFakeSupabase } from './fake-supabase.mjs';
import { startStatic } from './static-server.mjs';

// Playwright : installation locale si présente, sinon installation globale de l'environnement.
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));
const SCREENS = process.argv.includes('--screens');
const shots = join(ROOT, 'tests/e2e/screenshots');
if (SCREENS) mkdirSync(shots, { recursive: true });
const out = mkdtempSync(join(tmpdir(), 'ana-e2e-'));
const env = { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' };
execFileSync('npx', ['vite', 'build', '--config', 'admin-app/vite.config.ts', '--logLevel', 'error'], { cwd: ROOT, env, stdio: 'inherit' });
// Export simulé : contenu initial + configuration publique pointant vers le faux backend.
const { initialContent } = await import('../../scripts/lib/content.mjs');
const pagesInit = initialContent(ROOT);
const exportFile = join(out, '..', 'ana-e2e-export.json');
writeFileSync(exportFile, JSON.stringify({
  publication: null, global: pagesInit.find((p) => p.slug === '_global').content,
  pages: pagesInit.filter((p) => p.slug !== '_global').map((p) => ({ ...p, status: 'published' })), media: [], redirects: [],
  public: { analyticsDomain: 'ana.test', analyticsScript: 'https://plausible.io/js/script.js', supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: 'test-anon-key' },
}));
execFileSync('node', ['scripts/build-site.mjs', '--out', out, '--content', exportFile], { cwd: ROOT, stdio: 'pipe' });

const fake = await startFakeSupabase();
const web = await startStatic(out);
const browser = await chromium.launch();
const BASE = 'http://127.0.0.1:4173/site/';
let failures = 0;
const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['✓', name]); }
  catch (e) { failures++; results.push(['✗', name + ' — ' + e.message.split('\n')[0]]); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

async function login(page, email, password) {
  await page.goto(BASE + 'admin/');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCREENS ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await step('le site public est servi sous /site/ et inchangé', async () => {
    const r = await page.goto(BASE);
    expect(r.ok(), 'HTTP ' + r.status());
    expect((await page.locator('h1').first().textContent()).includes('ressaisir'), 'titre de l\'accueil');
    const scripts = await page.$$eval('script[src]', (s) => s.map((x) => x.getAttribute('src')));
    expect(!scripts.some((s) => s.includes('admin') || s.includes('supabase')), 'aucun code d\'administration chargé par le site public');
  });

  await step('formulaire démo : envoi réel, conversion comptée après confirmation serveur', async () => {
    await page.route('https://plausible.io/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await page.goto(BASE + 'demo.html');
    await page.fill('input[name="nom"]', 'Martin Durand');
    await page.fill('input[name="email"]', 'martin@cabinet.fr');
    await page.fill('input[name="societe"]', 'Cabinet Durand');
    await page.selectOption('select[name="profil"]', { index: 1 });
    await page.check('input[name="consent"]');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => (window.plausible.q || []).some((a) => a[0] === 'form_demo_success'), null, { timeout: 5000 });
    expect(fake.db.leads.length === 1 && fake.db.leads[0].email === 'martin@cabinet.fr', 'demande enregistrée');
    expect(await page.locator('[data-if="formSent"]').isVisible(), 'confirmation affichée');
  });

  await step('formulaire de contact : bouton inactif tant qu\'il est incomplet, puis envoi réel', async () => {
    await page.goto(BASE + 'ressources.html');
    const submit = page.locator('#contact form button[type="submit"]');
    await page.fill('#contact input[name="nom"]', 'Camille Roy');
    await page.fill('#contact input[name="email"]', 'camille@cabinet.fr');
    expect(await submit.isDisabled(), 'envoi impossible sans message ni consentement');
    expect(fake.db.leads.length === 1, 'rien n\'est parti');
    await page.fill('#contact textarea[name="message"]', 'Une question sur la sécurité.');
    await page.check('#contact input[name="consent"]');
    expect(await submit.isEnabled(), 'envoi possible une fois le formulaire complet');
    await submit.click();
    await page.waitForFunction(() => (window.plausible.q || []).some((a) => a[0] === 'form_resource_success'), null, { timeout: 5000 });
    const lead = fake.db.leads[1];
    expect(fake.db.leads.length === 2 && lead.form === 'contact' && lead.page === 'ressources', 'message enregistré comme contact');
    expect(await page.locator('#contact [data-if="formSent"]').isVisible(), 'confirmation affichée');
  });

  await step('formulaire de contact : refus du serveur affiché, avec l\'adresse de secours', async () => {
    await page.getByRole('button', { name: 'Envoyer un autre message' }).click();
    await page.fill('#contact input[name="nom"]', 'Camille Roy');
    await page.fill('#contact input[name="email"]', 'trop@test.fr');
    await page.fill('#contact textarea[name="message"]', 'Encore une question.');
    await page.check('#contact input[name="consent"]');
    await page.click('#contact form button[type="submit"]');
    await page.getByRole('alert').filter({ hasText: 'Trop de demandes' }).waitFor({ timeout: 5000 });
    expect(fake.db.leads.length === 2, 'aucune demande enregistrée');
  });

  await step('candidature : enregistrée comme demande, avec le lien vers le CV', async () => {
    await page.goto(BASE + 'carrieres.html');
    await page.fill('#candidature input[name="nom"]', 'Alex Martin');
    await page.fill('#candidature input[name="email"]', 'alex@exemple.fr');
    await page.fill('#candidature input[name="lien"]', 'https://exemple.fr/cv-alex');
    await page.fill('#candidature textarea[name="message"]', 'Ingénieur, intéressé par les agents.');
    await page.check('#candidature input[name="consent"]');
    await page.click('#candidature form button[type="submit"]');
    await page.locator('#candidature [data-if="formSent"]').waitFor({ state: 'visible', timeout: 5000 });
    const lead = fake.db.leads[2];
    expect(fake.db.leads.length === 3 && lead.page === 'carrieres' && lead.profile === 'Candidature spontanée', 'candidature enregistrée');
    expect(lead.message.includes('Lien : https://exemple.fr/cv-alex'), 'lien du CV joint au message');
  });

  // ——— Site public sur téléphone ———
  await step('téléphone : menu défilable, tous les liens atteignables sur un petit écran', async () => {
    const c = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE + 'index.html');
    const burger = p.locator('.ana-nav-burger');
    await burger.click();
    for (const k of ['toggleMobileFeatures', 'toggleMobileCases']) await p.locator(`[data-on-click="${k}"]`).first().click();
    expect(await burger.getAttribute('aria-expanded') === 'true', 'bouton du menu marqué ouvert');
    expect(await p.evaluate(() => getComputedStyle(document.documentElement).overflow) === 'hidden', 'la page ne défile pas derrière le menu');
    const last = p.locator('.ana-mobile-panel a', { hasText: 'Créer un compte' });
    await last.scrollIntoViewIfNeeded();
    const ok = await last.evaluate((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + 20, r.top + r.height / 2); return r.bottom <= innerHeight && !!top && (top === el || el.contains(top)); });
    expect(ok, '« Créer un compte » atteignable, sans être recouvert par la barre fixe');
    await burger.click();
    expect(await p.evaluate(() => getComputedStyle(document.documentElement).overflow) !== 'hidden', 'la page défile de nouveau, menu fermé');
    await c.close();
  });

  await step('téléphone : barre fixe masquée tant qu\'un bouton de démo est à l\'écran', async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await c.newPage();
    await p.goto(BASE + 'index.html');
    const bar = p.locator('.ana-mobile-sticky-cta');
    await p.waitForTimeout(300);
    expect(await bar.evaluate((el) => getComputedStyle(el).visibility) === 'hidden', 'barre masquée en haut de l\'accueil (bouton du haut de page visible)');
    await p.evaluate(() => { const el = document.querySelector('#fonctionnement'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 300); });
    await p.waitForTimeout(500);
    expect(await bar.evaluate((el) => getComputedStyle(el).visibility) === 'visible', 'barre affichée une fois le bouton hors de l\'écran');
    for (const page2 of ['carrieres.html', 'mentions-legales.html', '404.html']) {
      await p.goto(BASE + page2);
      expect(await p.locator('.ana-mobile-sticky-cta').count() === 0, 'pas de barre fixe sur ' + page2);
    }
    await c.close();
  });

  await step('téléphone : fenêtre de détail aux couleurs de la carte, étapes et champs sur une colonne', async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await c.newPage();
    await p.goto(BASE + 'cabinets.html');
    const card = p.locator('details.ana-acc').first();
    const tint = await card.locator('.ana-pill').evaluate((el) => getComputedStyle(el).color);
    await card.locator('summary').click();
    const box = p.locator('[data-ana-bulle] [role="dialog"]');
    await box.waitFor({ timeout: 3000 });
    expect(await box.locator('.ana-pill').evaluate((el) => getComputedStyle(el).color) === tint, 'pictogramme de la fenêtre dans la teinte de la page');
    expect(tint !== 'rgb(139, 31, 224)', 'la page Cabinets a sa propre teinte (indigo), pas le violet par défaut');
    await p.keyboard.press('Escape');
    const step1 = await p.locator('#pilote .ana-step-row').first().evaluate((el) => { const [a, b] = el.children; return b.getBoundingClientRect().top >= a.getBoundingClientRect().bottom && b.getBoundingClientRect().width > 250; });
    expect(step1, 'étapes du pilote : libellé au-dessus du texte, sur toute la largeur');
    await p.goto(BASE + 'carrieres.html');
    const widths = await p.locator('form input[name="nom"], form input[name="email"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(widths.length === 2 && widths.every((w) => w > 250), 'candidature : nom et e-mail sur toute la largeur (' + widths.join(', ') + ')');
    expect(await p.locator('form input[name="email"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize)) >= 16, 'champs à 16 px (pas de zoom automatique sur iPhone)');
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over <= 1, 'aucun débordement horizontal');
    await c.close();
  });

  await step('schéma des agents : aucun mot coupé, du téléphone au grand écran', async () => {
    // 440 px : l'iPhone sur lequel le défaut a été signalé. Les autres largeurs encadrent les seuils de la chaîne
    // (une, deux, trois puis six colonnes) et le cas d'un portable à 1093 px, où six colonnes ne tenaient pas.
    for (const w of [320, 375, 440, 520, 521, 760, 761, 1093, 1180, 1181, 1440]) {
      const c = await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: w < 1000, hasTouch: w < 1000 });
      const p = await c.newPage();
      await p.goto(BASE + 'agents.html');
      await p.evaluate(() => document.fonts.ready);
      const m = await p.evaluate(() => {
        const chaine = document.querySelector('.ana-sch-6');
        const bloc = chaine.closest('.ana-bloc');
        const range = document.createRange();
        const coupes = [];
        const walker = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          for (const mot of n.nodeValue.matchAll(/\S+/g)) {
            range.setStart(n, mot.index);
            range.setEnd(n, mot.index + mot[0].length);
            const lignes = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 0.5).map((r) => Math.round(r.top))).size;
            // seule coupure admise : une césure prévue (trait d'union ou césure conditionnelle)
            if (lignes > 1 && !/[­-]/.test(mot[0])) coupes.push(mot[0]);
          }
        }
        return { coupes, colonnes: getComputedStyle(chaine).gridTemplateColumns.split(' ').length, depasse: document.documentElement.scrollWidth - window.innerWidth };
      });
      expect(m.coupes.length === 0, w + ' px : mot coupé (' + m.coupes.join(', ') + ')');
      expect(m.depasse <= 1, w + ' px : débordement horizontal');
      if (w <= 520) expect(m.colonnes === 1, w + ' px : les six agents sur une colonne (' + m.colonnes + ')');
      await c.close();
    }
  });

  await step('accès direct à /admin/ : écran de connexion', async () => {
    await page.goto(BASE + 'admin/#/pages');
    await page.getByRole('heading', { name: 'Connexion' }).waitFor({ timeout: 8000 });
    if (SCREENS) await page.screenshot({ path: join(shots, '01-login.png') });
  });

  await step('identifiants incorrects refusés', async () => {
    await login(page, 'admin@test.fr', 'mauvais');
    await page.getByText('Identifiants incorrects.').waitFor({ timeout: 5000 });
  });

  await step('compte authentifié sans profil : accès refusé', async () => {
    await login(page, 'intrus@test.fr', 'motdepasse-intrus');
    await page.getByText('Accès non autorisé').waitFor({ timeout: 8000 });
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await page.getByRole('heading', { name: 'Connexion' }).waitFor();
  });

  await step('connexion admin → dashboard sans chiffres fictifs', async () => {
    await login(page, 'admin@test.fr', 'motdepasse-admin');
    await page.getByRole('heading', { name: /Bonjour|Bonsoir/ }).waitFor({ timeout: 8000 });
    await page.getByText('Analytics non configuré').first().waitFor();
    await page.getByText('Santé du site').waitFor();
    await page.getByText('Site public en ligne').waitFor();
  });

  await step('tableau de bord : alerte des nouvelles demandes, puis « marquer comme vues »', async () => {
    await page.getByText('3 nouvelles demandes').waitFor({ timeout: 8000 });
    await page.getByText('alex@exemple.fr').first().waitFor();
    expect((await page.locator('.sidebar .nav-item', { hasText: 'Demandes' }).locator('.count').textContent()) === '3', 'pastille du menu');
    await page.getByRole('button', { name: 'Marquer comme vues' }).click();
    await page.getByText('Aucune nouvelle demande').waitFor({ timeout: 5000 });
    expect(await page.locator('.sidebar .nav-item', { hasText: 'Demandes' }).locator('.count').count() === 0, 'pastille retirée');
    await page.waitForTimeout(600);
    if (SCREENS) await page.screenshot({ path: join(shots, '02-dashboard.png') });
  });

  await step('liste des pages : 14 pages + en-tête/pied', async () => {
    await page.getByRole('link', { name: 'Pages' }).first().click();
    await page.getByRole('table').waitFor();
    const n = await page.locator('tbody tr').count();
    expect(n === 14, `${n} lignes`);
    await page.getByText('En-tête et pied de page').first().waitFor();
    if (SCREENS) await page.screenshot({ path: join(shots, '03-pages.png') });
  });

  await step('éditeur visuel : sélection dans l\'aperçu réel et modification du titre', async () => {
    await page.goto(BASE + 'admin/#/editor/index');
    const frame = page.frameLocator('iframe[title="Aperçu de la page"]');
    await frame.locator('h1').first().waitFor({ timeout: 10000 });
    await frame.locator('h1').first().click();
    // Le grand titre est un texte enrichi (un mot en dégradé) : il se modifie dans la zone de saisie riche.
    const box = page.locator('.editor-props .rich').first();
    await box.waitFor();
    expect((await box.innerText()).includes('ressaisir'), 'valeur initiale dans le panneau');
    expect(await box.locator('.ana-grad').count() === 1, 'mot en dégradé repris dans le panneau');
    await box.evaluate((el) => { el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, 'Un titre modifié depuis l\'éditeur'); });
    await frame.locator('h1', { hasText: 'Un titre modifié depuis l\'éditeur' }).waitFor({ timeout: 3000 });
    await page.getByText('Modifications non enregistrées').waitFor();
    if (SCREENS) await page.screenshot({ path: join(shots, '04-editor.png') });
  });

  await step('annuler / rétablir', async () => {
    const frame = page.frameLocator('iframe[title="Aperçu de la page"]');
    await page.getByRole('button', { name: /Annuler \(Ctrl\+Z\)/ }).click();
    await frame.locator('h1', { hasText: 'ressaisir' }).waitFor({ timeout: 3000 });
    await page.getByRole('button', { name: /Rétablir/ }).click();
    await frame.locator('h1', { hasText: 'Un titre modifié' }).waitFor({ timeout: 3000 });
  });

  await step('mot en dégradé : posé depuis l\'éditeur sur le mot sélectionné', async () => {
    const frame = page.frameLocator('iframe[title="Aperçu de la page"]');
    const box = page.locator('.editor-props .rich').first();
    await box.evaluate((el) => {
      const node = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.nodeValue.includes('modifié'));
      const at = node.nodeValue.indexOf('modifié');
      const range = document.createRange();
      range.setStart(node, at); range.setEnd(node, at + 'modifié'.length);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    });
    await page.getByRole('button', { name: 'Mot en dégradé' }).dispatchEvent('mousedown');
    await frame.locator('h1 .ana-grad', { hasText: 'modifié' }).waitFor({ timeout: 3000 });
    expect((await frame.locator('h1').first().innerText()).replace(/\s+/g, ' ').trim() === 'Un titre modifié depuis l\'éditeur', 'texte du titre inchangé');
  });

  await step('scène du visuel produit : l\'emplacement de la capture se sélectionne dans l\'aperçu', async () => {
    const frame = page.frameLocator('iframe[title="Aperçu de la page"]');
    expect(await frame.locator('.ana-scene-gabarit').isVisible(), 'gabarit visible tant qu\'aucune capture n\'est déposée');
    await frame.locator('.ana-scene-capture').click({ position: { x: 220, y: 140 } });
    await page.locator('.editor-props').getByRole('button', { name: 'Choisir une image' }).waitFor({ timeout: 3000 });
  });

  await step('masquer et réafficher une section dans l\'aperçu', async () => {
    const frame = page.frameLocator('iframe[title="Aperçu de la page"]');
    await page.getByRole('button', { name: 'Masquer la section' }).nth(2).click(); // 3e section visible : s4
    expect(await frame.locator('[data-cms-section="s4"]').isHidden(), 'section s4 masquée');
    await page.getByRole('button', { name: 'Afficher la section' }).nth(1).click();
    expect(await frame.locator('[data-cms-section="s4"]').isVisible(), 'section s4 réaffichée');
  });

  await step('section masquée par défaut (références clients) : réaffichable depuis l\'éditeur', async () => {
    const frame = page.frameLocator('iframe[title="Aperçu de la page"]');
    expect(await frame.locator('[data-cms-section="s3"]').isHidden(), 'section s3 masquée par défaut');
    await page.getByRole('button', { name: 'Afficher la section' }).first().click();
    expect(await frame.locator('[data-cms-section="s3"]').isVisible(), 'section s3 affichée');
    await page.getByRole('button', { name: 'Masquer la section' }).nth(2).click();
    expect(await frame.locator('[data-cms-section="s3"]').isHidden(), 'section s3 de nouveau masquée');
  });

  await step('modes tablette et mobile (largeur réelle de la page)', async () => {
    const frameEl = page.locator('iframe[title="Aperçu de la page"]');
    await page.getByRole('button', { name: 'Mobile' }).click();
    await page.waitForTimeout(300);
    const w = await frameEl.evaluate((f) => f.contentWindow.innerWidth);
    expect(w === 390, 'largeur mobile ' + w);
    const burger = await page.frameLocator('iframe[title="Aperçu de la page"]').locator('.ana-nav-burger').isVisible();
    expect(burger, 'menu burger visible en mobile (media queries du site appliquées)');
    if (SCREENS) await page.screenshot({ path: join(shots, '05-editor-mobile.png') });
    await page.getByRole('button', { name: 'Desktop' }).click();
  });

  await step('enregistrement du brouillon (verrou de version)', async () => {
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await page.getByText('Brouillon enregistré').first().waitFor({ timeout: 5000 });
    const d = fake.db.page_drafts.find((x) => x.page_id === fake.db.pages.find((p) => p.slug === 'index').id);
    expect(d.version === 2, 'version ' + d.version);
    const titre = Object.values(d.content.fields).find((v) => (v.html || '').replace(/<[^>]+>/g, '') === 'Un titre modifié depuis l\'éditeur');
    expect(!!titre, 'contenu enregistré');
    expect(titre.html.includes('<span class="ana-grad">modifié</span>'), 'mot en dégradé enregistré');
  });

  await step('publication : demande réelle puis suivi (aucun succès annoncé avant confirmation)', async () => {
    await page.getByRole('button', { name: 'Publier', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publier' }).click();
    await page.getByText('Publication en cours de suivi').waitFor({ timeout: 8000 });
    expect(fake.db.publications.length === 1, 'publication créée');
    expect(await page.locator('.notice.success').count() === 0, 'pas de faux succès');
    if (SCREENS) await page.screenshot({ path: join(shots, '06-publication.png') });
  });

  await step('aperçu plein écran du brouillon', async () => {
    await page.goto(BASE + 'admin/#/preview/index');
    await page.getByText('Aperçu du brouillon — non publié').waitFor();
    await page.frameLocator('iframe').locator('h1', { hasText: 'Un titre modifié' }).waitFor({ timeout: 8000 });
  });

  await step('SEO, médias, paramètres et recherche globale se chargent', async () => {
    for (const [hash, text] of [['seo', 'Redirections'], ['media', 'Glissez des images ici'], ['settings', 'URL publique du site'], ['analytics', 'Analytics non configuré'], ['demandes', 'Ingénieur, intéressé par les agents.']]) {
      await page.goto(BASE + 'admin/#/' + hash);
      await page.getByText(text).first().waitFor({ timeout: 8000 });
    }
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder('Rechercher une page, un texte, un média…').fill('agents');
    await page.getByRole('option').filter({ hasText: 'Les agents Ana' }).first().waitFor();
    if (SCREENS) await page.screenshot({ path: join(shots, '07-search.png') });
    await page.keyboard.press('Escape');
  });

  await step('thème sombre', async () => {
    await page.goto(BASE + 'admin/#/dashboard');
    await page.getByRole('button', { name: 'Changer de thème' }).click(); // clair
    await page.getByRole('button', { name: 'Changer de thème' }).click(); // sombre
    expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'data-theme=dark');
    await page.waitForTimeout(500);
    if (SCREENS) await page.screenshot({ path: join(shots, '08-dashboard-dark.png') });
  });

  await step('éditeur : publication refusée à un éditeur', async () => {
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p2 = await c2.newPage();
    await login(p2, 'editor@test.fr', 'motdepasse-editeur');
    await p2.getByRole('heading', { name: /Bonjour|Bonsoir/ }).waitFor({ timeout: 8000 });
    await p2.goto(BASE + 'admin/#/editor/agents');
    await p2.frameLocator('iframe').locator('h1').first().waitFor({ timeout: 10000 });
    expect(await p2.getByRole('button', { name: 'Publier', exact: true }).isDisabled(), 'bouton Publier désactivé');
    await c2.close();
  });

  await step('mobile : aucun débordement horizontal', async () => {
    const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SCREENS ? 2 : 1, isMobile: true });
    const p3 = await c3.newPage();
    await login(p3, 'admin@test.fr', 'motdepasse-admin');
    await p3.getByRole('heading', { name: /Bonjour|Bonsoir/ }).waitFor({ timeout: 8000 });
    for (const h of ['dashboard', 'pages', 'media', 'seo', 'publications', 'settings']) {
      await p3.goto(BASE + 'admin/#/' + h);
      await p3.waitForTimeout(700);
      const over = await p3.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over <= 1, `${h} déborde de ${over}px`);
      if (SCREENS && (h === 'dashboard' || h === 'pages')) await p3.screenshot({ path: join(shots, `09-mobile-${h}.png`) });
    }
    await c3.close();
  });

  await step('aucune erreur JavaScript', async () => { expect(!errors.length, errors.join(' | ')); });
} finally {
  await browser.close();
  fake.close();
  web.close();
  // Rebuild sans variables de test pour ne pas laisser une admin pointant vers le faux backend.
  execFileSync('npx', ['vite', 'build', '--config', 'admin-app/vite.config.ts', '--logLevel', 'error'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '', VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '' } });
}
results.forEach((r) => console.log(r[0], r[1]));
console.log(failures ? `\n${failures} échec(s)` : '\nTous les scénarios e2e passent.');
process.exit(failures ? 1 : 0);
