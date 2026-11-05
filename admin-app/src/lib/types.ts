import type { Content } from '@cms';

export type Role = 'admin' | 'editor';
export type Profile = { id: string; email: string; display_name: string; role: Role; active: boolean; created_at: string };
export type PageStatus = 'draft' | 'published' | 'archived';
export type PageRow = {
  id: string; slug: string; title: string; file_path: string | null; template_path: string | null; is_system: boolean;
  status: PageStatus; sort_order: number; published_at: string | null; updated_at: string; published_revision_id: string | null;
  draft_version: number; draft_updated_at: string; draft_updated_by: string | null; updated_by_name: string | null; updated_by_email: string | null;
  has_unpublished_changes: boolean; seo: Content['seo'] | null;
};
export type Revision = { id: string; page_id: string; number: number; kind: 'seed' | 'save' | 'publish' | 'restore' | 'duplicate'; message: string | null; created_by: string | null; created_at: string; content?: Content };
export type Draft = { page_id: string; content: Content; version: number; updated_at: string; updated_by: string | null };
export type Media = { id: string; storage_path: string; file_name: string; title: string; alt: string; mime_type: string; size_bytes: number; width: number | null; height: number | null; created_at: string; created_by: string | null; url?: string };
export type PublicationStatus = 'queued' | 'building' | 'deploying' | 'verifying' | 'succeeded' | 'failed' | 'cancelled';
export type Publication = { id: string; status: PublicationStatus; requested_by: string | null; requested_at: string; started_at: string | null; completed_at: string | null; manifest: { page_id: string; slug: string; revision_id: string }[]; message: string | null; github_run_url: string | null; error: string | null; verified_at: string | null };
export type AuditLog = { id: number; actor: string | null; action: string; entity_type: string; entity_id: string | null; summary: string; details: Record<string, unknown>; created_at: string };
export type ConversionDef = { id: string; event_name: string; label: string; description: string; is_conversion: boolean };
export type Lead = { id: string; form: string; name: string; email: string; company: string | null; phone: string | null; profile: string | null; message: string | null; page: string | null; created_at: string };
export type Settings = Record<'general' | 'contact' | 'social' | 'seo' | 'analytics', Record<string, unknown>>;
