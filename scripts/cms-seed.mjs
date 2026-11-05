#!/usr/bin/env node
/* Génère supabase/seed/content.sql : pages existantes + contenu initial extrait du HTML.
 * Idempotent : une page déjà présente (même slug) n'est pas modifiée.
 * Usage : node scripts/cms-seed.mjs [--out chemin.sql]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/site.mjs';
import { initialContent } from './lib/content.mjs';

const i = process.argv.indexOf('--out');
const out = resolve(ROOT, i > -1 ? process.argv[i + 1] : 'supabase/seed/content.sql');

const lit = (s) => (s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'");
const json = (o) => {
  const t = JSON.stringify(o);
  if (t.includes('$cms$')) throw new Error('Délimiteur $cms$ présent dans le contenu');
  return '$cms$' + t + '$cms$::jsonb';
};

const lines = [
  '-- Généré par scripts/cms-seed.mjs — ne pas modifier à la main.',
  '-- Contenu initial du CMS, extrait du HTML annoté (data-cms).',
  'begin;',
];
for (const p of initialContent(ROOT)) {
  lines.push(`
insert into public.pages (slug, title, file_path, is_system, status, sort_order)
values (${lit(p.slug)}, ${lit(p.title)}, ${lit(p.file_path)}, true, 'published', ${p.sort_order})
on conflict (slug) do nothing;
insert into public.page_revisions (page_id, number, kind, content, message)
select id, 1, 'seed', ${json(p.content)}, 'Contenu d''origine du site' from public.pages
where slug = ${lit(p.slug)} and not exists (select 1 from public.page_revisions r where r.page_id = pages.id);
insert into public.page_drafts (page_id, content, version)
select r.page_id, r.content, 1 from public.page_revisions r join public.pages p on p.id = r.page_id
where p.slug = ${lit(p.slug)} and r.number = 1 on conflict (page_id) do nothing;
update public.pages p set published_revision_id = r.id, published_at = now()
from public.page_revisions r where r.page_id = p.id and r.number = 1 and p.slug = ${lit(p.slug)} and p.published_revision_id is null;`);
}
lines.push('commit;', '');
writeFileSync(out, lines.join('\n'));
console.log('Seed écrit :', out);
