-- Tests de permissions. Chaque bloc échoue (exception) si l'attente n'est pas satisfaite.
\set ON_ERROR_STOP 1
\o /dev/null

-- Fixtures (superutilisateur)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test'),
  ('00000000-0000-0000-0000-00000000000e', 'editor@test'),
  ('00000000-0000-0000-0000-00000000000f', 'outsider@test');
insert into public.profiles (id, email, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test', 'admin'),
  ('00000000-0000-0000-0000-00000000000e', 'editor@test', 'editor');

create function pg_temp.expect_error(sql text, pattern text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm !~* pattern then raise exception 'Erreur inattendue pour [%] : %', sql, sqlerrm; end if;
    return;
  end;
  raise exception 'Une erreur « % » était attendue pour : %', pattern, sql;
end $$;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'ÉCHEC : %', label; end if;
end $$;
grant execute on function pg_temp.expect_error(text, text), pg_temp.check(boolean, text) to anon, authenticated, service_role;

-- ================================================================
-- 1. Visiteur anonyme
-- ================================================================
set role anon;
select pg_temp.expect_error('select * from public.pages', 'permission denied');
select pg_temp.expect_error('select * from public.page_drafts', 'permission denied');
select pg_temp.expect_error('select * from public.page_revisions', 'permission denied');
select pg_temp.expect_error('select * from public.leads', 'permission denied');
select pg_temp.expect_error('select * from public.profiles', 'permission denied');
select pg_temp.expect_error('select * from public.site_settings', 'permission denied');
select pg_temp.expect_error('select * from public.page_overview', 'permission denied');
select pg_temp.expect_error($q$select public.save_draft(gen_random_uuid(), '{"fields":{}}', 1)$q$, 'permission denied');
select pg_temp.expect_error($q$select public.cms_export(null)$q$, 'permission denied');
select pg_temp.expect_error($q$select public.finalize_publication(gen_random_uuid())$q$, 'permission denied');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('media', 'x/y.png')$q$, 'row-level security');
-- Formulaire public : accepté seulement s'il est valide
select pg_temp.check(public.submit_lead('demo', 'Martin', 'martin@cabinet.fr', 'Cabinet', null, 'Cabinets', 'Bonjour', true, 'demo.html') is not null, 'submit_lead valide');
select pg_temp.expect_error($q$select public.submit_lead('demo', 'Martin', 'martin@cabinet.fr', null, null, null, null, false, null)$q$, 'CONSENT_REQUIRED');
select pg_temp.expect_error($q$select public.submit_lead('demo', 'Martin', 'pas-un-email', null, null, null, null, true, null)$q$, 'INVALID_EMAIL');
select pg_temp.expect_error($q$select public.submit_lead('spam', 'Martin', 'm@x.fr', null, null, null, null, true, null)$q$, 'INVALID_FORM');
select public.submit_lead('demo', 'M', 'flood@x.fr', null, null, null, null, true, null);
select public.submit_lead('demo', 'M', 'flood@x.fr', null, null, null, null, true, null);
select public.submit_lead('demo', 'M', 'flood@x.fr', null, null, null, null, true, null);
select pg_temp.expect_error($q$select public.submit_lead('demo', 'M', 'FLOOD@x.fr', null, null, null, null, true, null)$q$, 'RATE_LIMITED');
reset role;

-- ================================================================
-- 2. Compte authentifié sans profil (inscription non autorisée)
-- ================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select pg_temp.check((select count(*) from public.pages) = 0, 'outsider ne voit aucune page');
select pg_temp.check((select count(*) from public.leads) = 0, 'outsider ne voit aucun lead');
select pg_temp.check((select count(*) from public.profiles) = 0, 'outsider ne voit aucun profil');
select pg_temp.expect_error($q$select public.save_draft((select id from public.pages limit 1), '{"fields":{}}', 1)$q$, 'NOT_AUTHORIZED');
select pg_temp.expect_error($q$insert into public.media_assets (storage_path, file_name, mime_type, size_bytes, created_by) values ('00000000-0000-0000-0000-00000000000f/a.png', 'a.png', 'image/png', 10, '00000000-0000-0000-0000-00000000000f')$q$, 'row-level security');
select pg_temp.expect_error($q$insert into public.profiles (id, email, role) values ('00000000-0000-0000-0000-00000000000f', 'x', 'admin')$q$, 'permission denied');
reset role;

-- ================================================================
-- 3. Éditeur
-- ================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select pg_temp.check((select count(*) from public.pages) = 15, 'éditeur voit les 15 pages (14 + _global)');
select pg_temp.check(public.my_role() = 'editor', 'rôle éditeur');
select pg_temp.check((select count(*) from public.leads) >= 1, 'éditeur voit les leads');
-- Enregistrement d'un brouillon puis conflit sur version périmée
select pg_temp.check(
  (public.save_draft((select id from public.pages where slug = 'index'),
    jsonb_set((select content from public.page_drafts d join public.pages p on p.id = d.page_id where p.slug = 'index'), '{fields,index.s1.h1-1}', '{"text":"Titre modifié"}'),
    1, 'Test éditeur') ->> 'version')::int = 2, 'save_draft version 2');
select pg_temp.expect_error($q$select public.save_draft((select id from public.pages where slug = 'index'), '{"fields":{}}', 1)$q$, 'DRAFT_CONFLICT');
select pg_temp.expect_error($q$select public.save_draft((select id from public.pages where slug = 'index'), '{"nope":1}', 2)$q$, 'INVALID_CONTENT');
select pg_temp.check((select has_unpublished_changes from public.page_overview where slug = 'index'), 'modification non publiée détectée');
select pg_temp.check(not (select has_unpublished_changes from public.page_overview where slug = 'agents'), 'page non modifiée');
-- Actions réservées aux admins
select pg_temp.expect_error($q$select public.create_publication(null, null)$q$, 'ADMIN_REQUIRED');
select pg_temp.expect_error($q$select public.duplicate_page((select id from public.pages where slug = 'agents'), 'agents-2', 'Copie')$q$, 'ADMIN_REQUIRED');
select pg_temp.expect_error($q$select public.set_page_status((select id from public.pages where slug = 'agents'), true)$q$, 'ADMIN_REQUIRED');
select pg_temp.expect_error($q$select public.set_member('00000000-0000-0000-0000-00000000000e', 'admin', true)$q$, 'ADMIN_REQUIRED');
select pg_temp.expect_error($q$insert into public.redirects (from_path, to_path) values ('a.html', 'b.html')$q$, 'row-level security');
select pg_temp.expect_error($q$select public.set_publication_status(gen_random_uuid(), 'failed')$q$, 'permission denied');
update public.site_settings set value = '{"hack":true}' where key = 'general';
reset role;
select pg_temp.check((select value ->> 'hack' from public.site_settings where key = 'general') is null, 'éditeur ne modifie pas les paramètres');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
-- Révisions immuables, tables internes inaccessibles
select pg_temp.expect_error($q$update public.page_revisions set message = 'x'$q$, 'permission denied');
select pg_temp.expect_error($q$select * from public.analytics_cache$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.audit_logs (action, entity_type) values ('x', 'y')$q$, 'permission denied');
-- Médias : ajout sous son propre nom uniquement
insert into public.media_assets (id, storage_path, file_name, mime_type, size_bytes, width, height, created_by)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000e/logo.png', 'logo.png', 'image/png', 1200, 200, 80, '00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$insert into public.media_assets (storage_path, file_name, mime_type, size_bytes, created_by) values ('00000000-0000-0000-0000-00000000000e/b.png', 'b.png', 'image/png', 10, '00000000-0000-0000-0000-00000000000a')$q$, 'row-level security');
select pg_temp.expect_error($q$insert into public.media_assets (storage_path, file_name, mime_type, size_bytes, created_by) values ('00000000-0000-0000-0000-00000000000e/c.svg', 'c.svg', 'image/svg+xml', 10, '00000000-0000-0000-0000-00000000000e')$q$, 'media_mime');
select pg_temp.expect_error($q$update public.media_assets set storage_path = '00000000-0000-0000-0000-00000000000e/z.png' where id = '11111111-1111-1111-1111-111111111111'$q$, 'non modifiables');
update public.media_assets set alt = 'Logo client' where id = '11111111-1111-1111-1111-111111111111';
insert into storage.objects (bucket_id, name) values ('media', '00000000-0000-0000-0000-00000000000e/logo.png');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('media', '00000000-0000-0000-0000-00000000000a/autre.png')$q$, 'row-level security');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('media', '00000000-0000-0000-0000-00000000000e/script.svg')$q$, 'row-level security');
-- Utilisation du média dans le brouillon de la page index → suppression refusée
select public.save_draft((select id from public.pages where slug = 'index'),
  jsonb_set((select content from public.page_drafts d join public.pages p on p.id = d.page_id where p.slug = 'index'), '{fields,index.s3.slot-1}',
    '{"mediaId":"11111111-1111-1111-1111-111111111111","alt":"Logo client"}'),
  2, 'Ajout logo');
select pg_temp.expect_error($q$select public.delete_media('11111111-1111-1111-1111-111111111111')$q$, 'MEDIA_IN_USE');
delete from storage.objects where name = '00000000-0000-0000-0000-00000000000e/logo.png'; -- filtré par la RLS (0 ligne)
reset role;
select pg_temp.check((select count(*) from storage.objects where name = '00000000-0000-0000-0000-00000000000e/logo.png') = 1, 'fichier non supprimé tant que le média est utilisé');

-- ================================================================
-- 4. Administrateur : publication complète
-- ================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_error($q$select public.set_member('00000000-0000-0000-0000-00000000000a', 'editor', true)$q$, 'LAST_ADMIN');
select pg_temp.expect_error($q$select public.set_page_status((select id from public.pages where slug = 'index'), true)$q$, 'PAGE_PROTECTED');
select pg_temp.expect_error($q$select public.create_publication(array[(select id from public.pages where slug = 'agents')], null)$q$, 'NOTHING_TO_PUBLISH');
create temp table t_pub as select public.create_publication(null, 'Test') as id;
grant select on t_pub to authenticated, service_role;
select pg_temp.check((select jsonb_array_length(manifest) from public.publications where id = (select id from t_pub)) = 1, 'manifeste : 1 page modifiée');
select pg_temp.expect_error($q$select public.create_publication(null, null)$q$, 'PUBLICATION_IN_PROGRESS');
select pg_temp.expect_error($q$select public.finalize_publication((select id from t_pub))$q$, 'permission denied');
-- Tant que la publication n'est pas confirmée, la version en ligne ne change pas
select pg_temp.check((select r.content #>> '{fields,index.s1.h1-1,text}' from public.pages p join public.page_revisions r on r.id = p.published_revision_id where p.slug = 'index') <> 'Titre modifié', 'pointeur publié inchangé avant confirmation');
-- Duplication et renommage
create temp table t_dup as select public.duplicate_page((select id from public.pages where slug = 'cabinets'), 'cabinets-2', 'Cabinets (copie)') as id;
select pg_temp.check((select template_path from public.pages where slug = 'cabinets-2') = 'cabinets.html', 'modèle de la copie');
select pg_temp.check((select status from public.pages where slug = 'cabinets-2') = 'draft', 'copie en brouillon');
select pg_temp.expect_error($q$select public.duplicate_page((select id from public.pages where slug = 'cabinets'), 'cabinets-2', 'X')$q$, 'SLUG_TAKEN');
select public.rename_page((select id from public.pages where slug = 'carrieres'), 'recrutement', 'Recrutement');
select pg_temp.check((select to_path from public.redirects where from_path = 'carrieres.html') = 'recrutement.html', 'redirection créée');
reset role;

-- Le workflow (service_role) construit puis confirme
set role service_role;
select pg_temp.check((public.cms_export((select id from t_pub)) #>> '{publication,id}')::uuid = (select id from t_pub), 'export lié à la publication');
select pg_temp.check((select pg #>> '{content,fields,index.s1.h1-1,text}' from jsonb_array_elements(public.cms_export((select id from t_pub)) -> 'pages') pg where pg ->> 'slug' = 'index') = 'Titre modifié', 'export : contenu du manifeste');
select pg_temp.check((select pg #>> '{content,fields,index.s1.h1-1,text}' from jsonb_array_elements(public.cms_export(null) -> 'pages') pg where pg ->> 'slug' = 'index') <> 'Titre modifié', 'export sans publication : version en ligne');
select pg_temp.check(jsonb_array_length(public.cms_export((select id from t_pub)) -> 'media') = 1, 'export : média référencé inclus');
select pg_temp.check(public.cms_export(null) -> 'global' -> 'fields' ? 'g.header.a-1', 'export : contenu partagé');
select pg_temp.check(not exists (select 1 from jsonb_array_elements(public.cms_export(null) -> 'pages') pg where pg ->> 'slug' = 'cabinets-2'), 'brouillon jamais publié exclu de l''export');
select public.set_publication_status((select id from t_pub), 'building', 42, 'https://github.com/x/y/actions/runs/42');
select pg_temp.expect_error($q$select public.set_publication_status((select id from t_pub), 'succeeded')$q$, 'USE_FINALIZE');
select public.finalize_publication((select id from t_pub));
select pg_temp.expect_error($q$select public.finalize_publication((select id from t_pub))$q$, 'PUBLICATION_CLOSED');
reset role;
select pg_temp.check((select r.content #>> '{fields,index.s1.h1-1,text}' from public.pages p join public.page_revisions r on r.id = p.published_revision_id where p.slug = 'index') = 'Titre modifié', 'pointeur publié basculé après confirmation');
select pg_temp.check((select status from public.publications where id = (select id from t_pub)) = 'succeeded', 'publication réussie');
select pg_temp.check(exists (select 1 from public.audit_logs where action = 'publication_succeeded'), 'journal de publication');

-- Média publié : suppression toujours refusée
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select has_unpublished_changes from public.page_overview where slug = 'index') = false, 'plus de modification en attente');
-- Restauration de la version 1 (contenu d'origine)
select public.restore_revision((select r.id from public.page_revisions r join public.pages p on p.id = r.page_id where p.slug = 'index' and r.number = 1),
  (select version from public.page_drafts d join public.pages p on p.id = d.page_id where p.slug = 'index'));
select pg_temp.check((select d.content #>> '{fields,index.s1.h1-1,text}' from public.page_drafts d join public.pages p on p.id = d.page_id where p.slug = 'index') <> 'Titre modifié', 'restauration dans le brouillon');
select pg_temp.expect_error($q$select public.delete_media('11111111-1111-1111-1111-111111111111')$q$, 'MEDIA_IN_USE'); -- encore en ligne
-- Échec d'une publication : statut failed, pointeurs inchangés
create temp table t_pub2 as select public.create_publication(null, null) as id;
grant select on t_pub2 to service_role;
reset role;
set role service_role;
select public.set_publication_status((select id from t_pub2), 'failed', null, null, 'Build échoué');
reset role;
select pg_temp.check((select r.content #>> '{fields,index.s1.h1-1,text}' from public.pages p join public.page_revisions r on r.id = p.published_revision_id where p.slug = 'index') = 'Titre modifié', 'échec : version en ligne conservée');
select pg_temp.check((select count(*) from public.publications where status in ('queued','building','deploying','verifying')) = 0, 'plus aucune publication active');
\o
\echo '  ✓ toutes les assertions de permissions sont satisfaites'
