// Faux backend Supabase EN MÉMOIRE, réservé aux tests e2e de l'interface (jamais utilisé en production).
// Implémente le sous-ensemble d'API utilisé par l'admin : auth, PostgREST (filtres simples), RPC, storage, functions.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { initialContent } from '../../scripts/lib/content.mjs';
import { ROOT } from '../../scripts/lib/site.mjs';

export function createStore() {
  const now = () => new Date().toISOString();
  const users = [
    { id: '00000000-0000-0000-0000-00000000000a', email: 'admin@test.fr', password: 'motdepasse-admin', role: 'admin' },
    { id: '00000000-0000-0000-0000-00000000000e', email: 'editor@test.fr', password: 'motdepasse-editeur', role: 'editor' },
    { id: '00000000-0000-0000-0000-00000000000f', email: 'intrus@test.fr', password: 'motdepasse-intrus', role: null },
  ];
  const db = { profiles: [], pages: [], page_drafts: [], page_revisions: [], publications: [], audit_logs: [], media_assets: [], site_settings: [], conversion_definitions: [], leads: [], redirects: [] };
  users.filter((u) => u.role).forEach((u) => db.profiles.push({ id: u.id, email: u.email, display_name: u.role === 'admin' ? 'Romain' : 'Clara', role: u.role, active: true, created_at: now() }));
  initialContent(ROOT).forEach((p) => {
    const id = randomUUID(); const rev = randomUUID();
    db.pages.push({ id, slug: p.slug, title: p.title, file_path: p.file_path, template_path: null, is_system: true, status: 'published', sort_order: p.sort_order, published_at: now(), updated_at: now(), published_revision_id: rev });
    db.page_revisions.push({ id: rev, page_id: id, number: 1, kind: 'seed', content: p.content, message: 'Contenu d\'origine', created_by: null, created_at: now() });
    db.page_drafts.push({ page_id: id, content: structuredClone(p.content), version: 1, updated_at: now(), updated_by: null });
  });
  db.site_settings.push({ key: 'general', value: { siteName: 'Ana Finance', siteUrl: 'http://127.0.0.1:4173/' } }, { key: 'analytics', value: { provider: 'plausible', domain: '' } });
  db.conversion_definitions.push({ id: randomUUID(), event_name: 'form_demo_success', label: 'Démo', description: '', is_conversion: true });
  return { users, db };
}

const overview = (db) => db.pages.map((p) => {
  const d = db.page_drafts.find((x) => x.page_id === p.id);
  const r = db.page_revisions.find((x) => x.id === p.published_revision_id);
  const pr = db.profiles.find((x) => x.id === d?.updated_by);
  return { ...p, draft_version: d.version, draft_updated_at: d.updated_at, draft_updated_by: d.updated_by, updated_by_name: pr?.display_name ?? null, updated_by_email: pr?.email ?? null, has_unpublished_changes: JSON.stringify(r?.content) !== JSON.stringify(d.content), seo: d.content.seo };
});

function filterRows(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const [op, ...rest] = v.split('.'); const val = rest.join('.');
    out = out.filter((r) => {
      const x = r[k];
      if (op === 'eq') return String(x) === val;
      if (op === 'neq') return String(x) !== val;
      if (op === 'is') return val === 'null' ? x == null : String(x) === val;
      if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, '')).includes(String(x));
      return true;
    });
  }
  const order = params.get('order');
  if (order) { const [col, dir] = order.split('.'); out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === 'desc' ? -1 : 1)); }
  const limit = params.get('limit');
  return limit ? out.slice(0, Number(limit)) : out;
}

export function startFakeSupabase(port = 54321) {
  const { users, db } = createStore();
  const tokens = new Map();
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*', ...headers });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204);
    let raw = ''; for await (const c of req) raw += c;
    const body = raw && (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : raw;
    const auth = (req.headers.authorization || '').replace('Bearer ', '');
    const user = tokens.get(auth);
    const profile = user && db.profiles.find((p) => p.id === user.id && p.active);
    calls.push({ method: req.method, path: url.pathname, body });
    const pgErr = (msg, status = 400) => send(status, { code: 'P0001', message: msg, details: null, hint: null });
    const p = url.pathname;

    if (p === '/auth/v1/token') {
      const u = users.find((x) => x.email === body.email && x.password === body.password);
      if (!u) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
      const t = randomUUID(); tokens.set(t, u);
      return send(200, { access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: randomUUID(), user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } });
    }
    if (p === '/auth/v1/user') return user ? send(200, { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }) : send(401, { msg: 'invalid' });
    if (p === '/auth/v1/logout') return send(204);

    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice(13);
      if (fn === 'submit_lead') {
        if (!body.p_consent) return pgErr('CONSENT_REQUIRED');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.p_email || '')) return pgErr('INVALID_EMAIL');
        if (body.p_email === 'trop@test.fr') return pgErr('RATE_LIMITED'); // refus serveur, pour tester l'affichage de l'erreur
        const id = randomUUID();
        db.leads.push({ id, form: body.p_form, name: body.p_name, email: body.p_email, company: body.p_company, phone: body.p_phone, profile: body.p_profile, message: body.p_message, page: body.p_page, created_at: new Date().toISOString() });
        return send(200, id);
      }
      if (!profile) return pgErr('NOT_AUTHORIZED', 403);
      if (fn === 'save_draft') {
        const d = db.page_drafts.find((x) => x.page_id === body.p_page);
        if (d.version !== body.p_expected_version) return pgErr('DRAFT_CONFLICT');
        d.content = body.p_content; d.version++; d.updated_by = user.id; d.updated_at = new Date().toISOString();
        const n = Math.max(...db.page_revisions.filter((r) => r.page_id === d.page_id).map((r) => r.number)) + 1;
        const id = randomUUID(); db.page_revisions.push({ id, page_id: d.page_id, number: n, kind: 'save', content: structuredClone(d.content), message: body.p_message, created_by: user.id, created_at: d.updated_at });
        db.audit_logs.push({ id: db.audit_logs.length + 1, actor: user.id, action: 'save_draft', entity_type: 'page', entity_id: d.page_id, summary: '', details: { version: d.version }, created_at: d.updated_at });
        return send(200, { version: d.version, revision_id: id, updated_at: d.updated_at });
      }
      if (fn === 'media_usage') return send(200, []);
      return pgErr('UNSUPPORTED_IN_FAKE ' + fn);
    }

    if (p.startsWith('/rest/v1/')) {
      const table = p.slice(9);
      if (!profile) return send(200, req.headers.accept?.includes('vnd.pgrst.object') ? null : []);
      const rows = table === 'page_overview' ? overview(db) : db[table];
      if (!rows) return pgErr('unknown table ' + table, 404);
      if (req.method === 'GET') {
        const out = filterRows(rows, url.searchParams);
        if ((req.headers.accept || '').includes('vnd.pgrst.object')) return out.length === 1 ? send(200, out[0]) : send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains ' + out.length + ' rows', hint: null });
        return send(200, out);
      }
      return pgErr('write not supported in fake: ' + table);
    }

    if (p.startsWith('/functions/v1/')) {
      const fn = p.slice(14);
      if (!profile) return send(401, { error: { code: 'NOT_AUTHORIZED', message: 'Session invalide' } });
      if (fn === 'analytics') return send(200, { configured: false, provider: 'plausible', missing: ['PLAUSIBLE_API_KEY (secret Supabase)'] });
      if (fn === 'publish') {
        if (profile.role !== 'admin') return send(403, { error: { code: 'ADMIN_REQUIRED', message: 'Réservé aux administrateurs' } });
        const manifest = overview(db).filter((x) => x.has_unpublished_changes && (!body.pages || body.pages.includes(x.id))).map((x) => ({ page_id: x.id, slug: x.slug, revision_id: randomUUID() }));
        if (!manifest.length) return send(409, { error: { code: 'NOTHING_TO_PUBLISH', message: 'NOTHING_TO_PUBLISH' } });
        const id = randomUUID();
        db.publications.push({ id, status: 'queued', requested_by: user.id, requested_at: new Date().toISOString(), manifest, github_run_url: null, error: null, started_at: null, completed_at: null, message: null, verified_at: null });
        return send(202, { publication_id: id, status: 'queued' });
      }
      return send(404, { error: { code: 'UNKNOWN', message: fn } });
    }
    if (p.startsWith('/storage/v1/object/sign/')) return send(200, (body.paths || []).map((x) => ({ path: x, signedURL: '/storage/v1/fake/' + x, error: null })));
    send(404, { message: 'not found ' + p });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, db, calls, close: () => server.close() })));
}
