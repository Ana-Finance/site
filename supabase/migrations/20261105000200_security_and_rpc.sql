-- Ana Finance CMS — permissions (RLS) et fonctions métier.
--
-- Règles :
--   * anon : aucune lecture de table ; seule la fonction submit_lead est exécutable.
--   * authenticated : lecture réservée aux membres actifs (profiles) ; écritures via fonctions
--     security definer qui vérifient le rôle.
--   * service_role (Edge Functions) : fonctions de publication et d'export.

-- ------------------------------------------------------------------
-- Rôle courant
-- ------------------------------------------------------------------
create function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create function public.require_member() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
end $$;

create function public.require_admin() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
end $$;

-- ------------------------------------------------------------------
-- Journal d'activité (écrit uniquement par les fonctions)
-- ------------------------------------------------------------------
create function public.log_audit(p_action text, p_entity_type text, p_entity_id uuid, p_summary text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor, action, entity_type, entity_id, summary, details)
  values ((select id from public.profiles where id = auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_summary, ''), coalesce(p_details, '{}'::jsonb));
$$;

create function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  eid uuid;
begin
  begin eid := (rec ->> 'id')::uuid; exception when others then eid := null; end;
  perform public.log_audit(lower(tg_op), tg_table_name, eid,
    coalesce(rec ->> 'file_name', rec ->> 'event_name', rec ->> 'key', rec ->> 'from_path', ''),
    case when tg_table_name = 'site_settings' then jsonb_build_object('key', rec ->> 'key') else '{}'::jsonb end);
  return coalesce(new, old);
end $$;

create trigger media_audit after insert or update or delete on public.media_assets for each row execute function public.audit_row();
create trigger settings_audit after insert or update on public.site_settings for each row execute function public.audit_row();
create trigger conversions_audit after insert or update or delete on public.conversion_definitions for each row execute function public.audit_row();
create trigger redirects_audit after insert or update or delete on public.redirects for each row execute function public.audit_row();

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.pages enable row level security;
alter table public.page_revisions enable row level security;
alter table public.page_drafts enable row level security;
alter table public.media_assets enable row level security;
alter table public.publications enable row level security;
alter table public.redirects enable row level security;
alter table public.site_settings enable row level security;
alter table public.conversion_definitions enable row level security;
alter table public.leads enable row level security;
alter table public.audit_logs enable row level security;
alter table public.analytics_cache enable row level security;

-- Défense en profondeur : anon n'a aucun privilège sur les tables.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.profiles, public.pages, public.page_revisions, public.page_drafts, public.media_assets,
  public.publications, public.redirects, public.site_settings, public.conversion_definitions, public.leads, public.audit_logs to authenticated;
grant insert, update on public.media_assets to authenticated;
grant insert, update, delete on public.redirects, public.conversion_definitions to authenticated;
grant insert, update on public.site_settings to authenticated;
grant delete on public.leads to authenticated;
grant all on all tables in schema public to service_role;

create policy "membres : lecture" on public.profiles for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.pages for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.page_revisions for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.page_drafts for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.publications for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.redirects for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.site_settings for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.conversion_definitions for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.leads for select to authenticated using (public.is_member());
create policy "membres : lecture" on public.audit_logs for select to authenticated using (public.is_member());

create policy "membres : lecture" on public.media_assets for select to authenticated using (public.is_member());
create policy "membres : ajout" on public.media_assets for insert to authenticated
  with check (public.is_member() and created_by = auth.uid() and deleted_at is null);
-- Mise à jour des métadonnées ; la suppression passe par delete_media().
create policy "membres : métadonnées" on public.media_assets for update to authenticated
  using (public.is_member() and deleted_at is null) with check (public.is_member() and deleted_at is null);

create policy "admins : gestion" on public.redirects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins : gestion" on public.conversion_definitions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins : écriture" on public.site_settings for insert to authenticated with check (public.is_admin());
create policy "admins : modification" on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins : suppression" on public.leads for delete to authenticated using (public.is_admin());
-- analytics_cache : aucune policy → inaccessible hors service_role.

-- Colonnes protégées des médias : chemin et auteur non modifiables après création.
create function public.media_guard() returns trigger language plpgsql as $$
begin
  if new.storage_path <> old.storage_path or new.created_by is distinct from old.created_by
     or new.mime_type <> old.mime_type or new.size_bytes <> old.size_bytes then
    raise exception 'Champs du média non modifiables' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger media_guard before update on public.media_assets for each row
  when (current_user = 'authenticated') execute function public.media_guard();

-- ------------------------------------------------------------------
-- Fonctions : brouillons et révisions
-- ------------------------------------------------------------------
create function public.validate_content(p_content jsonb) returns void language plpgsql as $$
begin
  if jsonb_typeof(p_content) is distinct from 'object' or jsonb_typeof(p_content -> 'fields') is distinct from 'object' then
    raise exception 'INVALID_CONTENT' using errcode = '22023';
  end if;
  if octet_length(p_content::text) > 2000000 then
    raise exception 'CONTENT_TOO_LARGE' using errcode = '22023';
  end if;
end $$;

create function public.next_revision_number(p_page uuid) returns integer language sql stable as $$
  select coalesce(max(number), 0) + 1 from public.page_revisions where page_id = p_page
$$;

/* Enregistre le brouillon. Échoue avec DRAFT_CONFLICT si quelqu'un a enregistré entre-temps.
   p_snapshot = true crée aussi une révision d'historique. */
create function public.save_draft(p_page uuid, p_content jsonb, p_expected_version integer, p_message text default null, p_snapshot boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.page_drafts;
  rev uuid;
  pg public.pages;
begin
  perform public.require_member();
  perform public.validate_content(p_content);
  select * into pg from public.pages where id = p_page;
  if not found then raise exception 'PAGE_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into d from public.page_drafts where page_id = p_page for update;
  if not found then
    insert into public.page_drafts (page_id, content, version, updated_by) values (p_page, p_content, 1, auth.uid()) returning * into d;
  else
    if d.version <> p_expected_version then
      raise exception 'DRAFT_CONFLICT' using errcode = 'P0001', detail = json_build_object('current_version', d.version, 'updated_by', d.updated_by, 'updated_at', d.updated_at)::text;
    end if;
    update public.page_drafts set content = p_content, version = d.version + 1, updated_by = auth.uid(), updated_at = now()
      where page_id = p_page returning * into d;
  end if;
  if p_snapshot then
    insert into public.page_revisions (page_id, number, kind, content, message, created_by)
      values (p_page, public.next_revision_number(p_page), 'save', p_content, nullif(p_message, ''), auth.uid()) returning id into rev;
  end if;
  update public.pages set updated_by = auth.uid(), updated_at = now() where id = p_page;
  perform public.log_audit('save_draft', 'page', p_page, pg.title, jsonb_build_object('version', d.version, 'revision_id', rev));
  return jsonb_build_object('version', d.version, 'revision_id', rev, 'updated_at', d.updated_at);
end $$;

create function public.restore_revision(p_revision uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.page_revisions;
  d public.page_drafts;
  rev uuid;
begin
  perform public.require_member();
  select * into r from public.page_revisions where id = p_revision;
  if not found then raise exception 'REVISION_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into d from public.page_drafts where page_id = r.page_id for update;
  if d.version <> p_expected_version then raise exception 'DRAFT_CONFLICT' using errcode = 'P0001'; end if;
  update public.page_drafts set content = r.content, version = d.version + 1, updated_by = auth.uid(), updated_at = now()
    where page_id = r.page_id returning * into d;
  insert into public.page_revisions (page_id, number, kind, content, message, created_by)
    values (r.page_id, public.next_revision_number(r.page_id), 'restore', r.content, 'Restauration de la version ' || r.number, auth.uid()) returning id into rev;
  update public.pages set updated_by = auth.uid() where id = r.page_id;
  perform public.log_audit('restore_revision', 'page', r.page_id, 'Version ' || r.number, jsonb_build_object('from_revision', p_revision, 'revision_id', rev));
  return jsonb_build_object('version', d.version, 'revision_id', rev);
end $$;

-- ------------------------------------------------------------------
-- Fonctions : pages
-- ------------------------------------------------------------------
create function public.duplicate_page(p_source uuid, p_slug text, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  src public.pages;
  content jsonb;
  new_id uuid;
begin
  perform public.require_admin();
  select * into src from public.pages where id = p_source;
  if not found or src.slug = '_global' then raise exception 'PAGE_NOT_FOUND' using errcode = 'P0002'; end if;
  if exists (select 1 from public.pages where slug = p_slug) or exists (select 1 from public.redirects where from_path = p_slug || '.html') then
    raise exception 'SLUG_TAKEN' using errcode = '23505';
  end if;
  select d.content into content from public.page_drafts d where d.page_id = p_source;
  -- Une page dupliquée est d'abord indexable=false : à vérifier avant publication.
  content := jsonb_set(coalesce(content, '{"fields":{}}'::jsonb), '{seo}', coalesce(content -> 'seo', '{}'::jsonb) || jsonb_build_object('title', p_title, 'canonical', ''));
  insert into public.pages (slug, title, template_path, is_system, status, sort_order, updated_by)
    values (p_slug, p_title, coalesce(src.file_path, src.template_path), false, 'draft', (select coalesce(max(sort_order), 0) + 1 from public.pages), auth.uid())
    returning id into new_id;
  insert into public.page_drafts (page_id, content, version, updated_by) values (new_id, content, 1, auth.uid());
  insert into public.page_revisions (page_id, number, kind, content, message, created_by)
    values (new_id, 1, 'duplicate', content, 'Dupliquée depuis ' || src.title, auth.uid());
  perform public.log_audit('duplicate_page', 'page', new_id, p_title, jsonb_build_object('source', p_source));
  return new_id;
end $$;

create function public.set_page_status(p_page uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = public as $$
declare pg public.pages;
begin
  perform public.require_admin();
  select * into pg from public.pages where id = p_page for update;
  if not found then raise exception 'PAGE_NOT_FOUND' using errcode = 'P0002'; end if;
  if pg.slug in ('index', '_global') then raise exception 'PAGE_PROTECTED' using errcode = '42501'; end if;
  update public.pages
    set status = case when p_archived then 'archived'::public.page_status
                      when published_revision_id is not null then 'published'::public.page_status
                      else 'draft'::public.page_status end,
        updated_by = auth.uid()
    where id = p_page;
  perform public.log_audit(case when p_archived then 'archive_page' else 'unarchive_page' end, 'page', p_page, pg.title);
end $$;

/* Renomme le slug d'une page et crée une redirection depuis l'ancienne URL. */
create function public.rename_page(p_page uuid, p_slug text, p_title text)
returns void language plpgsql security definer set search_path = public as $$
declare pg public.pages;
begin
  perform public.require_admin();
  select * into pg from public.pages where id = p_page for update;
  if not found then raise exception 'PAGE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_title is not null and p_title <> pg.title then update public.pages set title = p_title, updated_by = auth.uid() where id = p_page; end if;
  if p_slug is null or p_slug = pg.slug then return; end if;
  if pg.slug in ('index', '_global') then raise exception 'PAGE_PROTECTED' using errcode = '42501'; end if;
  if exists (select 1 from public.pages where slug = p_slug) then raise exception 'SLUG_TAKEN' using errcode = '23505'; end if;
  update public.pages set slug = p_slug, file_path = null, template_path = coalesce(pg.file_path, pg.template_path), updated_by = auth.uid() where id = p_page;
  delete from public.redirects where from_path = p_slug || '.html';
  if pg.published_revision_id is not null then
    insert into public.redirects (from_path, to_path, created_by) values (pg.slug || '.html', p_slug || '.html', auth.uid())
      on conflict (from_path) do update set to_path = excluded.to_path;
    -- Les redirections existantes vers l'ancienne URL suivent.
    update public.redirects set to_path = p_slug || '.html' where to_path = pg.slug || '.html';
  end if;
  perform public.log_audit('rename_page', 'page', p_page, pg.slug || ' → ' || p_slug);
end $$;

-- ------------------------------------------------------------------
-- Fonctions : médias
-- ------------------------------------------------------------------
/* Refuse la suppression d'un média utilisé par un brouillon, une version publiée ou une publication en cours. */
create function public.media_usage(p_media uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(distinct jsonb_build_object('page_id', p.id, 'title', p.title, 'where', u.place)), '[]'::jsonb)
  from (
    select d.page_id, 'brouillon' as place from public.page_drafts d where d.content::text like '%' || p_media::text || '%'
    union all
    select r.page_id, 'en ligne' from public.pages pg join public.page_revisions r on r.id = pg.published_revision_id
      where r.content::text like '%' || p_media::text || '%'
  ) u join public.pages p on p.id = u.page_id
  where public.is_member()
$$;

create function public.delete_media(p_media uuid) returns text
language plpgsql security definer set search_path = public as $$
declare m public.media_assets; usage jsonb;
begin
  perform public.require_member();
  select * into m from public.media_assets where id = p_media and deleted_at is null for update;
  if not found then raise exception 'MEDIA_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.is_admin() and m.created_by is distinct from auth.uid() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  usage := public.media_usage(p_media);
  if jsonb_array_length(usage) > 0 then
    raise exception 'MEDIA_IN_USE' using errcode = 'P0001', detail = usage::text;
  end if;
  update public.media_assets set deleted_at = now() where id = p_media;
  return m.storage_path;
end $$;

-- ------------------------------------------------------------------
-- Fonctions : publication
-- ------------------------------------------------------------------
/* Fige les brouillons modifiés en révisions « publish » et met une publication en file.
   p_pages null = toutes les pages ayant des modifications non publiées. */
create function public.create_publication(p_pages uuid[] default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rec record;
  manifest jsonb := '[]'::jsonb;
  rev uuid;
  pub uuid;
begin
  perform public.require_admin();
  if exists (select 1 from public.publications where status in ('queued', 'building', 'deploying', 'verifying')) then
    raise exception 'PUBLICATION_IN_PROGRESS' using errcode = 'P0001';
  end if;
  for rec in
    select p.id, p.slug, p.status, d.content as draft, r.content as live, p.published_revision_id
    from public.pages p
    join public.page_drafts d on d.page_id = p.id
    left join public.page_revisions r on r.id = p.published_revision_id
    where p.status <> 'archived'
      and (p_pages is null or p.id = any (p_pages))
  loop
    if rec.live is not null and rec.live = rec.draft then continue; end if;
    insert into public.page_revisions (page_id, number, kind, content, message, created_by)
      values (rec.id, public.next_revision_number(rec.id), 'publish', rec.draft, nullif(p_message, ''), auth.uid())
      returning id into rev;
    manifest := manifest || jsonb_build_object('page_id', rec.id, 'slug', rec.slug, 'revision_id', rev);
  end loop;
  -- Archivage / désarchivage : effectif au prochain build même sans changement de contenu.
  if jsonb_array_length(manifest) = 0 and p_pages is null
     and not exists (select 1 from public.audit_logs a where a.action in ('archive_page', 'unarchive_page', 'rename_page')
                     and a.created_at > coalesce((select max(requested_at) from public.publications where status = 'succeeded'), '-infinity')) then
    raise exception 'NOTHING_TO_PUBLISH' using errcode = 'P0001';
  end if;
  if jsonb_array_length(manifest) = 0 and p_pages is not null then
    raise exception 'NOTHING_TO_PUBLISH' using errcode = 'P0001';
  end if;
  insert into public.publications (status, requested_by, manifest, message) values ('queued', auth.uid(), manifest, nullif(p_message, '')) returning id into pub;
  perform public.log_audit('request_publication', 'publication', pub, jsonb_array_length(manifest) || ' page(s)', jsonb_build_object('manifest', manifest));
  return pub;
end $$;

/* Mise à jour du statut par le workflow (via Edge Function, service_role). */
create function public.set_publication_status(p_publication uuid, p_status public.publication_status, p_run_id bigint default null, p_run_url text default null, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
declare cur public.publications;
begin
  select * into cur from public.publications where id = p_publication for update;
  if not found then raise exception 'PUBLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if cur.status in ('succeeded', 'failed', 'cancelled') then
    raise exception 'PUBLICATION_CLOSED' using errcode = 'P0001';
  end if;
  if p_status = 'succeeded' then raise exception 'USE_FINALIZE' using errcode = 'P0001'; end if;
  update public.publications set
    status = p_status,
    started_at = coalesce(started_at, case when p_status <> 'queued' then now() end),
    completed_at = case when p_status in ('failed', 'cancelled') then now() else completed_at end,
    github_run_id = coalesce(p_run_id, github_run_id),
    github_run_url = coalesce(p_run_url, github_run_url),
    error = coalesce(left(p_error, 2000), error)
  where id = p_publication;
  if p_status in ('failed', 'cancelled') then
    insert into public.audit_logs (actor, action, entity_type, entity_id, summary)
      values (cur.requested_by, 'publication_' || p_status, 'publication', p_publication, coalesce(left(p_error, 200), ''));
  end if;
end $$;

/* Appelé après vérification en ligne : bascule les pointeurs « publié ». */
create function public.finalize_publication(p_publication uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cur public.publications; e jsonb;
begin
  select * into cur from public.publications where id = p_publication for update;
  if not found then raise exception 'PUBLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if cur.status not in ('queued', 'building', 'deploying', 'verifying') then raise exception 'PUBLICATION_CLOSED' using errcode = 'P0001'; end if;
  for e in select * from jsonb_array_elements(cur.manifest) loop
    update public.pages set
      published_revision_id = (e ->> 'revision_id')::uuid,
      published_at = now(),
      status = case when status = 'archived' then status else 'published' end
    where id = (e ->> 'page_id')::uuid;
  end loop;
  update public.publications set status = 'succeeded', completed_at = now(), verified_at = now(), error = null where id = p_publication;
  insert into public.audit_logs (actor, action, entity_type, entity_id, summary)
    values (cur.requested_by, 'publication_succeeded', 'publication', p_publication, jsonb_array_length(cur.manifest) || ' page(s)');
end $$;

/* Contenu à construire : version du manifeste si fournie, sinon version publiée. */
create function public.cms_export(p_publication uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pub public.publications;
  pages jsonb;
  media jsonb;
  redirects jsonb;
  settings jsonb;
begin
  if p_publication is not null then
    select * into pub from public.publications where id = p_publication;
    if not found then raise exception 'PUBLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  with m as (
    select (e ->> 'page_id')::uuid as page_id, (e ->> 'revision_id')::uuid as revision_id
    from jsonb_array_elements(coalesce(pub.manifest, '[]'::jsonb)) e
  ), chosen as (
    select p.*, coalesce(m.revision_id, p.published_revision_id) as rev_id
    from public.pages p left join m on m.page_id = p.id
    where p.status <> 'archived'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'file_path', c.file_path, 'template_path', c.template_path, 'is_system', c.is_system,
      'status', 'published', 'published_at', coalesce(c.published_at, now()), 'content', r.content) order by c.sort_order), '[]'::jsonb)
    into pages
  from chosen c join public.page_revisions r on r.id = c.rev_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'storage_path', a.storage_path, 'mime_type', a.mime_type, 'width', a.width, 'height', a.height)), '[]'::jsonb)
    into media
  from public.media_assets a
  where a.deleted_at is null
    and exists (select 1 from jsonb_array_elements(pages) pg where (pg -> 'content')::text like '%"mediaId": "' || a.id::text || '"%');

  select coalesce(jsonb_agg(jsonb_build_object('from_path', from_path, 'to_path', to_path)), '[]'::jsonb) into redirects from public.redirects;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into settings from public.site_settings;

  return jsonb_build_object(
    'publication', case when pub.id is null then null else jsonb_build_object('id', pub.id, 'requested_at', pub.requested_at) end,
    'global', (select pg -> 'content' from jsonb_array_elements(pages) pg where pg ->> 'slug' = '_global'),
    'pages', (select coalesce(jsonb_agg(pg), '[]'::jsonb) from jsonb_array_elements(pages) pg where pg ->> 'slug' <> '_global'),
    'media', media,
    'redirects', redirects,
    'archived', (select coalesce(jsonb_agg(slug), '[]'::jsonb) from public.pages where status = 'archived'),
    'settings', settings
  );
end $$;

-- ------------------------------------------------------------------
-- Fonctions : membres
-- ------------------------------------------------------------------
create function public.update_my_profile(p_display_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_member();
  update public.profiles set display_name = left(coalesce(p_display_name, ''), 80) where id = auth.uid();
end $$;

create function public.set_member(p_user uuid, p_role public.app_role, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare remaining integer;
begin
  perform public.require_admin();
  select count(*) into remaining from public.profiles
    where role = 'admin' and active and id <> p_user;
  if remaining = 0 and (p_role <> 'admin' or not p_active) then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role, active = p_active where id = p_user;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.log_audit('set_member', 'profile', p_user, p_role::text || case when p_active then '' else ' (désactivé)' end);
end $$;

-- ------------------------------------------------------------------
-- Formulaires publics (anon)
-- ------------------------------------------------------------------
create function public.submit_lead(
  p_form text, p_name text, p_email text, p_company text default null, p_phone text default null,
  p_profile text default null, p_message text default null, p_consent boolean default false, p_page text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  if p_form not in ('demo', 'resource', 'contact') then raise exception 'INVALID_FORM' using errcode = '22023'; end if;
  if not coalesce(p_consent, false) then raise exception 'CONSENT_REQUIRED' using errcode = '22023'; end if;
  if p_email is null or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(p_email) > 254 then raise exception 'INVALID_EMAIL' using errcode = '22023'; end if;
  if coalesce(char_length(trim(p_name)), 0) not between 1 and 120 then raise exception 'INVALID_NAME' using errcode = '22023'; end if;
  if char_length(coalesce(p_company, '')) > 160 or char_length(coalesce(p_phone, '')) > 40 or char_length(coalesce(p_profile, '')) > 80
     or char_length(coalesce(p_message, '')) > 4000 or char_length(coalesce(p_page, '')) > 200 then
    raise exception 'FIELD_TOO_LONG' using errcode = '22023';
  end if;
  -- Limites anti-abus (sans stocker d'adresse IP).
  if (select count(*) from public.leads where lower(email) = lower(p_email) and created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from public.leads where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.leads (form, name, email, company, phone, profile, message, consent, page)
    values (p_form, trim(p_name), trim(p_email), nullif(trim(p_company), ''), nullif(trim(p_phone), ''), nullif(trim(p_profile), ''), nullif(trim(p_message), ''), true, nullif(p_page, ''))
    returning leads.id into id;
  return id;
end $$;

-- ------------------------------------------------------------------
-- Vue de synthèse (respecte la RLS de l'appelant)
-- ------------------------------------------------------------------
create view public.page_overview with (security_invoker = true) as
select
  p.id, p.slug, p.title, p.file_path, p.template_path, p.is_system, p.status, p.sort_order,
  p.published_at, p.updated_at, p.published_revision_id,
  d.version as draft_version, d.updated_at as draft_updated_at, d.updated_by as draft_updated_by,
  pr.display_name as updated_by_name, pr.email as updated_by_email,
  (r.content is distinct from d.content) as has_unpublished_changes,
  (d.content -> 'seo') as seo
from public.pages p
left join public.page_drafts d on d.page_id = p.id
left join public.page_revisions r on r.id = p.published_revision_id
left join public.profiles pr on pr.id = coalesce(d.updated_by, p.updated_by);
grant select on public.page_overview to authenticated;

-- ------------------------------------------------------------------
-- Droits d'exécution
-- ------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_role(), public.is_member(), public.is_admin() to authenticated;
grant execute on function public.save_draft(uuid, jsonb, integer, text, boolean), public.restore_revision(uuid, integer),
  public.duplicate_page(uuid, text, text), public.set_page_status(uuid, boolean), public.rename_page(uuid, text, text),
  public.media_usage(uuid), public.delete_media(uuid), public.create_publication(uuid[], text),
  public.update_my_profile(text), public.set_member(uuid, public.app_role, boolean) to authenticated;
grant execute on function public.submit_lead(text, text, text, text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.set_publication_status(uuid, public.publication_status, bigint, text, text),
  public.finalize_publication(uuid), public.cms_export(uuid) to service_role;
-- Fonctions utilisées par les policies et triggers (exécutées en security definer ou par les triggers).
grant execute on function public.touch_updated_at(), public.forbid_revision_change(), public.media_guard(), public.audit_row() to authenticated, service_role;

alter default privileges in schema public revoke execute on functions from public, anon;
