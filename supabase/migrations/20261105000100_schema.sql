-- Ana Finance CMS — schéma
-- Mono-site. Toutes les tables ont la RLS activée (voir migration suivante).

create type public.app_role as enum ('admin', 'editor');
create type public.page_status as enum ('draft', 'published', 'archived');
create type public.publication_status as enum ('queued', 'building', 'deploying', 'verifying', 'succeeded', 'failed', 'cancelled');
create type public.revision_kind as enum ('seed', 'save', 'publish', 'restore', 'duplicate');

-- Membres de l'administration. Une ligne n'existe que pour les comptes explicitement invités :
-- un compte auth.users sans profil n'a accès à rien.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role public.app_role not null default 'editor',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_len check (char_length(display_name) <= 80)
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  file_path text,            -- fichier HTML source du repository (pages existantes)
  template_path text,        -- fichier modèle (pages créées par duplication)
  is_system boolean not null default false,
  status public.page_status not null default 'draft',
  sort_order integer not null default 0,
  published_revision_id uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint pages_slug_format check (slug = '_global' or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint pages_slug_len check (char_length(slug) <= 80),
  constraint pages_title_len check (char_length(title) between 1 and 160),
  constraint pages_source check (slug = '_global' or file_path is not null or template_path is not null),
  constraint pages_paths check (
    (file_path is null or file_path ~ '^[a-z0-9-]+\.html$') and (template_path is null or template_path ~ '^[a-z0-9-]+\.html$')
  )
);

-- Instantanés immuables (historique, restauration, publication).
create table public.page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  number integer not null,
  kind public.revision_kind not null,
  content jsonb not null,
  message text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, number),
  constraint page_revisions_content_shape check (jsonb_typeof(content) = 'object' and jsonb_typeof(content -> 'fields') = 'object'),
  constraint page_revisions_message_len check (message is null or char_length(message) <= 300)
);
create index page_revisions_page_idx on public.page_revisions (page_id, number desc);

alter table public.pages
  add constraint pages_published_revision_fk foreign key (published_revision_id) references public.page_revisions (id) on delete set null;

-- Brouillon courant (un par page). `version` sert de verrou optimiste.
create table public.page_drafts (
  page_id uuid primary key references public.pages (id) on delete cascade,
  content jsonb not null,
  version integer not null default 1,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint page_drafts_content_shape check (jsonb_typeof(content) = 'object' and jsonb_typeof(content -> 'fields') = 'object')
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  file_name text not null,
  title text not null default '',
  alt text not null default '',
  mime_type text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint media_mime check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif')),
  constraint media_size check (size_bytes > 0 and size_bytes <= 10485760),
  constraint media_path check (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  constraint media_text_len check (char_length(title) <= 160 and char_length(alt) <= 300 and char_length(file_name) <= 200)
);
create index media_assets_created_idx on public.media_assets (created_at desc) where deleted_at is null;

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  status public.publication_status not null default 'queued',
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  manifest jsonb not null default '[]'::jsonb,   -- [{page_id, slug, revision_id}]
  message text,
  github_run_id bigint,
  github_run_url text,
  error text,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);
-- Une seule publication active à la fois.
create unique index publications_single_active on public.publications ((true))
  where status in ('queued', 'building', 'deploying', 'verifying');
create index publications_requested_idx on public.publications (requested_at desc);

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint redirects_from check (from_path ~ '^[a-z0-9]+(-[a-z0-9]+)*\.html$'),
  constraint redirects_to check (to_path ~ '^([a-z0-9]+(-[a-z0-9]+)*\.html(#[A-Za-z0-9_-]+)?|https://.+)$')
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_settings_key check (key in ('general', 'contact', 'social', 'seo', 'analytics'))
);

create table public.conversion_definitions (
  id uuid primary key default gen_random_uuid(),
  event_name text not null unique,
  label text not null,
  description text not null default '',
  is_conversion boolean not null default true,
  created_at timestamptz not null default now(),
  constraint conversion_event_format check (event_name ~ '^[a-z][a-z0-9_]{1,60}$')
);

-- Demandes réellement envoyées par les formulaires du site.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  form text not null,
  name text not null,
  email text not null,
  company text,
  phone text,
  profile text,
  message text,
  consent boolean not null,
  page text,
  created_at timestamptz not null default now(),
  constraint leads_form check (form in ('demo', 'resource', 'contact')),
  constraint leads_consent check (consent)
);
create index leads_created_idx on public.leads (created_at desc);
create index leads_email_idx on public.leads (lower(email), created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

-- Cache des réponses analytics (accès service_role uniquement).
create table public.analytics_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- updated_at automatique
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();
create trigger media_touch before update on public.media_assets for each row execute function public.touch_updated_at();
create trigger publications_touch before update on public.publications for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();

-- Les révisions sont immuables.
create function public.forbid_revision_change() returns trigger language plpgsql as $$
begin
  raise exception 'Les révisions sont immuables' using errcode = '42501';
end $$;
create trigger page_revisions_immutable before update on public.page_revisions for each row execute function public.forbid_revision_change();
