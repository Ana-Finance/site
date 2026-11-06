#!/usr/bin/env node
/* Configuration Supabase pour GitHub Actions, écrite dans $GITHUB_ENV.
 *
 * Priorité : variables GitHub (SUPABASE_URL, SUPABASE_ANON_KEY, CMS_EXPORT_URL, SITE_URL)
 * puis valeurs déduites : référence du projet (variable SUPABASE_PROJECT_REF, sinon supabase/project.json)
 * et clé publique « anon » lue via l'API Supabase avec le secret SUPABASE_ACCESS_TOKEN.
 * Seules des valeurs publiques sont produites (URL, clé anon protégée par la RLS).
 *
 * Exporte : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, CMS_EXPORT_URL, SITE_URL
 * NO_CONTENT=1 (pull requests) : CMS_EXPORT_URL vide, le site est construit depuis le HTML source.
 */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Sans dépendance npm : utilisable dans les jobs qui n'exécutent pas « npm ci ».
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const e = process.env;
const file = join(ROOT, 'supabase/project.json');
const project = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const ref = e.VAR_SUPABASE_PROJECT_REF || project.ref || '';
const siteUrl = (e.VAR_SITE_URL || project.siteUrl || '').replace(/\/?$/, '/');

let url = e.VAR_SUPABASE_URL || (ref ? `https://${ref}.supabase.co` : '');
let anon = e.VAR_SUPABASE_ANON_KEY || '';
let source = anon ? 'variables GitHub' : '';

if (!anon && ref && e.SUPABASE_ACCESS_TOKEN) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}` } });
  if (!res.ok) { console.error(`::error::Lecture de la clé publique Supabase impossible (HTTP ${res.status}).`); process.exit(1); }
  const keys = await res.json();
  anon = (keys.find((k) => k.name === 'anon') || {}).api_key || '';
  const service = (keys.find((k) => k.name === 'service_role') || {}).api_key;
  if (service) console.log(`::add-mask::${service}`); // jamais exportée, masquée par précaution
  source = 'API Supabase';
}
const exportUrl = e.NO_CONTENT === '1' ? '' : (e.VAR_CMS_EXPORT_URL || (ref ? `https://${ref}.supabase.co/functions/v1/cms-export` : ''));

const out = { VITE_SUPABASE_URL: anon ? url : '', VITE_SUPABASE_ANON_KEY: anon, CMS_EXPORT_URL: exportUrl, SITE_URL: siteUrl === '/' ? '' : siteUrl };
if (e.GITHUB_ENV) appendFileSync(e.GITHUB_ENV, Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
console.log(`Projet Supabase : ${ref || 'non défini'} · clé publique : ${anon ? 'trouvée (' + source + ')' : 'ABSENTE'} · export du contenu : ${exportUrl ? 'actif' : 'désactivé'} · site : ${out.SITE_URL || '—'}`);
if (!anon) console.log('::warning::Administration construite sans configuration Supabase (écran « non configurée »).');
