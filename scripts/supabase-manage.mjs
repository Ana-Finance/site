#!/usr/bin/env node
/* Gestion du projet Supabase depuis GitHub Actions (workflow « Supabase — gestion »).
 *
 *   node scripts/supabase-manage.mjs <commande> [options]
 *
 * Commandes :
 *   diagnostic         état du projet (lecture seule)
 *   migrations         applique les migrations manquantes (reconnaît celles exécutées à la main)
 *   seed               contenu initial des pages (idempotent)
 *   auth               URL de l'admin ajoutée aux redirections, mots de passe ≥ 12 caractères
 *                      (ne ferme pas les inscriptions : projet partagé avec l'app ANA)
 *   admin              invite un membre et lui donne un rôle : --email x@y.fr --role admin|editor
 *   variables-github   écrit SUPABASE_URL, SUPABASE_ANON_KEY, CMS_EXPORT_URL, SITE_URL dans GitHub
 *
 * Variables d'environnement :
 *   SUPABASE_ACCESS_TOKEN   jeton personnel Supabase (secret GitHub)
 *   SUPABASE_PROJECT_REF    référence du projet
 *   SITE_URL                URL publique du site (défaut : https://ana-finance.github.io/site/)
 *   CMS_GITHUB_TOKEN, GITHUB_REPOSITORY   pour variables-github
 *   LOCAL_DATABASE_URL      tests uniquement : exécute le SQL sur une base locale (psql) au lieu de l'API
 *
 * Aucun secret n'est jamais affiché : les clés lues via l'API sont masquées dans les journaux.
 */
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './lib/site.mjs';

const API = 'https://api.supabase.com/v1';
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => { const i = args.indexOf('--' + name); return i > -1 ? args[i + 1] : undefined; };
const env = (n, required = true) => {
  const v = process.env[n];
  if (!v && required) throw new Error(`Variable manquante : ${n} (voir docs/SUPABASE_WORKFLOWS.md)`);
  return v || '';
};
const SITE_URL = (process.env.SITE_URL || 'https://ana-finance.github.io/site/').replace(/\/?$/, '/');
const ADMIN_URL = SITE_URL + 'admin/';
const LOCAL = process.env.LOCAL_DATABASE_URL;

const summary = [];
function log(line = '') { console.log(line); summary.push(line); }
function mask(v) { if (v && process.env.GITHUB_ACTIONS) console.log(`::add-mask::${v}`); }
function flushSummary() {
  if (process.env.GITHUB_STEP_SUMMARY && summary.length) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
}

async function api(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { authorization: `Bearer ${env('SUPABASE_ACCESS_TOKEN')}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API Supabase ${init.method || 'GET'} ${path} → HTTP ${res.status} : ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
const ref = () => env('SUPABASE_PROJECT_REF');

/** Exécute du SQL (rôle postgres) et renvoie les lignes du dernier résultat. */
export async function sql(query) {
  if (LOCAL) {
    // Tests : même SQL, sur une base locale.
    const out = execFileSync('psql', [LOCAL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', `select coalesce(json_agg(t), '[]') from (${query.trim().replace(/;\s*$/, '')}) t`], { encoding: 'utf8' });
    return JSON.parse(out.trim() || '[]');
  }
  return api(`/projects/${ref()}/database/query`, { method: 'POST', body: JSON.stringify({ query }) });
}
async function exec(script) {
  if (LOCAL) { execFileSync('psql', [LOCAL, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], { input: script, stdio: ['pipe', 'pipe', 'inherit'] }); return; }
  await api(`/projects/${ref()}/database/query`, { method: 'POST', body: JSON.stringify({ query: script }) });
}

/* ------------------------------------------------------------------ */
/* Migrations                                                          */
/* ------------------------------------------------------------------ */

// Objet témoin de chaque migration : s'il existe déjà, la migration a été exécutée à la main (éditeur SQL).
const MARKERS = {
  '20261105000100': `select to_regclass('public.pages') is not null as ok`,
  '20261105000200': `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'save_draft') as ok`,
  '20261105000300': `select exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'media : lecture membres') as ok`,
  '20261105000400': `select (to_regclass('public.site_settings') is not null) and exists (select 1 from public.conversion_definitions where event_name = 'form_demo_success') as ok`,
};

function localMigrations() {
  return readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort()
    .map((f) => ({ version: f.slice(0, 14), name: f.slice(15, -4), file: f, body: readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8') }));
}

async function ensureHistoryTable() {
  // Même table que la CLI Supabase : compatible avec « supabase db push » ultérieur.
  await exec(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
}

export async function migrations() {
  await ensureHistoryTable();
  const done = new Set((await sql(`select version from supabase_migrations.schema_migrations`)).map((r) => r.version));
  let applied = 0;
  for (const m of localMigrations()) {
    if (done.has(m.version)) { log(`= ${m.file} : déjà appliquée`); continue; }
    const marker = MARKERS[m.version];
    if (marker && (await sql(marker))[0]?.ok) {
      await exec(`insert into supabase_migrations.schema_migrations (version, name) values ('${m.version}', '${m.name}') on conflict do nothing;`);
      log(`≈ ${m.file} : déjà présente (exécutée à la main), enregistrée sans être rejouée`);
      continue;
    }
    // Une transaction par migration : tout ou rien.
    await exec(`begin;\n${m.body}\ninsert into supabase_migrations.schema_migrations (version, name) values ('${m.version}', '${m.name}');\ncommit;`);
    log(`+ ${m.file} : appliquée`);
    applied++;
  }
  log(`Migrations : ${applied} appliquée(s).`);
}

export async function seed() {
  const before = (await sql(`select count(*)::int as n from public.pages`))[0].n;
  await exec(readFileSync(join(ROOT, 'supabase/seed/content.sql'), 'utf8'));
  const after = (await sql(`select count(*)::int as n from public.pages`))[0].n;
  log(`Contenu initial : ${after} page(s) en base (${after - before} ajoutée(s)).`);
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

// Projet partagé avec l'app ANA (dépôt Ana-Finance/app) : l'app a besoin des inscriptions (email + Google)
// et de ses propres URL de redirection. On ne ferme donc pas les inscriptions et on n'écrase rien :
// l'URL de l'admin est AJOUTÉE à la liste. L'accès au CMS reste réservé aux comptes qui ont un profil
// actif (créé par invitation, aucun droit d'écriture sur profiles pour « authenticated »).
const splitUrls = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export async function auth() {
  const cur = await api(`/projects/${ref()}/config/auth`);
  const urls = splitUrls(cur.uri_allow_list);
  if (!urls.includes(ADMIN_URL)) urls.push(ADMIN_URL);
  const body = { uri_allow_list: urls.join(','), password_min_length: 12, mailer_autoconfirm: false };
  if (!cur.site_url) body.site_url = ADMIN_URL; // seulement si rien n'est réglé (l'app peut l'avoir choisie)
  await api(`/projects/${ref()}/config/auth`, { method: 'PATCH', body: JSON.stringify(body) });
  const cfg = await api(`/projects/${ref()}/config/auth`);
  const adminOk = splitUrls(cfg.uri_allow_list).includes(ADMIN_URL);
  log(`Auth : inscriptions ${cfg.disable_signup ? 'fermées' : 'ouvertes (app ANA)'} · URL du site ${cfg.site_url} · admin dans les redirections ${adminOk ? '✓' : '✗'} · mot de passe ≥ ${cfg.password_min_length}`);
  if (!adminOk) throw new Error(`L'URL de l'admin (${ADMIN_URL}) est absente des URL de redirection.`);
}

/* ------------------------------------------------------------------ */
/* Clés et membres                                                     */
/* ------------------------------------------------------------------ */

async function keys() {
  const list = await api(`/projects/${ref()}/api-keys?reveal=true`);
  const find = (...names) => list.find((k) => names.includes(k.name))?.api_key;
  const anon = find('anon');
  const service = find('service_role');
  mask(service);
  if (!anon || !service) throw new Error('Clés anon / service_role introuvables (Project Settings → API Keys → Legacy API keys doivent être actives).');
  return { anon, service };
}

export async function admin() {
  const email = String(opt('email') || '').trim().toLowerCase();
  const role = opt('role') === 'editor' ? 'editor' : 'admin';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse e-mail invalide (option --email).');
  const { service } = await keys();
  const base = `https://${ref()}.supabase.co/auth/v1`;
  const h = { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' };

  // Compte existant ? (créé dans le tableau de bord, ou invitation précédente)
  let user = null;
  for (let page = 1; page <= 10 && !user; page++) {
    const r = await fetch(`${base}/admin/users?page=${page}&per_page=200`, { headers: h });
    if (!r.ok) throw new Error(`Liste des comptes impossible : HTTP ${r.status}`);
    const { users = [] } = await r.json();
    user = users.find((u) => (u.email || '').toLowerCase() === email) || null;
    if (users.length < 200) break;
  }
  if (!user) {
    const r = await fetch(`${base}/invite?redirect_to=${encodeURIComponent(ADMIN_URL)}`, { method: 'POST', headers: h, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Invitation refusée : HTTP ${r.status} ${j.msg || j.message || ''}`);
    user = j;
    log(`Invitation envoyée à ${email} : la personne choisit son mot de passe via le lien reçu.`);
  } else {
    log(`Compte existant trouvé pour ${email}.`);
  }
  const safe = email.replace(/'/g, "''");
  await exec(`insert into public.profiles (id, email, role, active) values ('${user.id}', '${safe}', '${role}', true)
on conflict (id) do update set role = excluded.role, active = true;`);
  log(`Rôle « ${role} » attribué à ${email}.`);
}

/* ------------------------------------------------------------------ */
/* Variables GitHub                                                    */
/* ------------------------------------------------------------------ */

export async function githubVariables() {
  const { anon } = await keys();
  const values = {
    SUPABASE_URL: `https://${ref()}.supabase.co`,
    SUPABASE_ANON_KEY: anon, // publique par conception (protégée par la RLS)
    CMS_EXPORT_URL: `https://${ref()}.supabase.co/functions/v1/cms-export`,
    SITE_URL,
  };
  const token = process.env.CMS_GITHUB_TOKEN;
  const repo = env('GITHUB_REPOSITORY');
  const failed = [];
  for (const [name, value] of Object.entries(values)) {
    if (!token) { failed.push(name); continue; }
    const h = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' };
    let r = await fetch(`https://api.github.com/repos/${repo}/actions/variables/${name}`, { method: 'PATCH', headers: h, body: JSON.stringify({ name, value }) });
    if (r.status === 404) r = await fetch(`https://api.github.com/repos/${repo}/actions/variables`, { method: 'POST', headers: h, body: JSON.stringify({ name, value }) });
    if (r.ok) log(`Variable GitHub ${name} : enregistrée ✓`);
    else failed.push(name);
  }
  if (failed.length) {
    log('');
    log(`Variables à créer à la main (Settings → Secrets and variables → Actions → Variables), le jeton CMS_GITHUB_TOKEN n'ayant pas la permission « Variables : Read and write » :`);
    for (const n of failed) log(`- ${n} = ${values[n]}`);
  }
}

/* ------------------------------------------------------------------ */
/* Diagnostic                                                          */
/* ------------------------------------------------------------------ */

export async function diagnostic() {
  const ok = (b) => (b ? '✓' : '✗');
  log(`## Diagnostic Supabase — projet ${ref()}`);
  if (!LOCAL) {
    const p = await api(`/projects/${ref()}`);
    log(`Projet « ${p.name} » · région ${p.region} · statut ${p.status}`);
  }
  const s = (await sql(`select
    to_regclass('public.pages') is not null as tables,
    (select count(*)::int from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as nb_tables,
    (select count(*)::int from pg_tables where schemaname = 'public' and rowsecurity) as nb_rls,
    (select count(*)::int from storage.buckets where id = 'media' and not public) as bucket_prive,
    to_regclass('supabase_migrations.schema_migrations') is not null as historique`))[0];
  log(`Tables : ${s.nb_tables} (RLS active sur ${s.nb_rls}) ${ok(s.tables && s.nb_rls === s.nb_tables)}`);
  log(`Bucket « media » privé : ${ok(s.bucket_prive === 1)}`);
  if (s.historique) {
    const v = (await sql(`select version from supabase_migrations.schema_migrations order by version`)).map((r) => r.version);
    const missing = localMigrations().filter((m) => !v.includes(m.version)).map((m) => m.file);
    log(`Migrations enregistrées : ${v.length} ${missing.length ? '· manquantes : ' + missing.join(', ') : '✓'}`);
  } else log('Migrations : historique absent (lancer « migrations »).');
  if (s.tables) {
    const c = (await sql(`select (select count(*)::int from public.pages) as pages,
      (select count(*)::int from public.profiles where role = 'admin' and active) as admins,
      (select count(*)::int from public.profiles) as membres,
      (select count(*)::int from public.publications) as publications`))[0];
    log(`Pages : ${c.pages} ${ok(c.pages >= 15)} · administrateurs actifs : ${c.admins} ${ok(c.admins > 0)} · membres : ${c.membres} · publications : ${c.publications}`);
  }
  if (!LOCAL) {
    const cfg = await api(`/projects/${ref()}/config/auth`);
    log(`Auth : inscriptions ${cfg.disable_signup ? 'fermées' : 'ouvertes (app ANA)'} · URL du site ${cfg.site_url || '—'} · admin dans les redirections ${ok(splitUrls(cfg.uri_allow_list).includes(ADMIN_URL))}`);
    const fns = await api(`/projects/${ref()}/functions`);
    const want = ['publish', 'analytics', 'admin-users', 'cms-export'];
    const have = new Set(fns.map((f) => f.slug));
    log(`Fonctions : ${want.map((w) => `${w} ${ok(have.has(w))}`).join(' · ')}`);
    const secrets = new Set((await api(`/projects/${ref()}/secrets`)).map((x) => x.name));
    const need = ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'CMS_BUILD_TOKEN', 'ADMIN_URL', 'SITE_URL', 'ALLOWED_ORIGINS'];
    log(`Secrets des fonctions : ${need.map((n) => `${n} ${ok(secrets.has(n))}`).join(' · ')} · PLAUSIBLE_API_KEY ${secrets.has('PLAUSIBLE_API_KEY') ? '✓' : '(facultatif, absent)'}`);
  }
}

const COMMANDS = { diagnostic, migrations, seed, auth, admin, 'variables-github': githubVariables };

if (import.meta.url === `file://${process.argv[1]}`) {
  const fn = COMMANDS[cmd];
  if (!fn) { console.error(`Commande inconnue « ${cmd} ». Disponibles : ${Object.keys(COMMANDS).join(', ')}`); process.exit(2); }
  fn().then(() => flushSummary()).catch((e) => { log(`✗ ${e.message}`); flushSummary(); process.exit(1); });
}
