// Accès aux données. Toutes les requêtes passent par la RLS ; les écritures sensibles par des RPC.
import { supabase, invoke, AppError } from './supabase';
import type { Content } from '@cms';
import type { AuditLog, ConversionDef, Draft, Lead, Media, PageRow, Profile, Publication, Revision, Settings, Role } from './types';

function check<T>(res: { data: T | null; error: { message: string; details?: string } | null }): T {
  if (res.error) throw new AppError(res.error.message, res.error.message.split(' ')[0], res.error.details);
  return res.data as T;
}

export const api = {
  async me(): Promise<Profile | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    return check(await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle()) as Profile | null;
  },
  async profiles(): Promise<Profile[]> { return check(await supabase.from('profiles').select('*').order('created_at')); },

  async pages(): Promise<PageRow[]> { return check(await supabase.from('page_overview').select('*').order('sort_order')); },
  async page(id: string): Promise<PageRow> { return check(await supabase.from('page_overview').select('*').eq('id', id).single()); },
  async pageBySlug(slug: string): Promise<PageRow | null> { return check(await supabase.from('page_overview').select('*').eq('slug', slug).maybeSingle()); },
  async draft(pageId: string): Promise<Draft> { return check(await supabase.from('page_drafts').select('*').eq('page_id', pageId).single()); },
  async drafts(): Promise<Draft[]> { return check(await supabase.from('page_drafts').select('*')); },
  async saveDraft(pageId: string, content: Content, expectedVersion: number, message?: string, snapshot = true): Promise<{ version: number; revision_id: string | null; updated_at: string }> {
    return check(await supabase.rpc('save_draft', { p_page: pageId, p_content: content, p_expected_version: expectedVersion, p_message: message ?? null, p_snapshot: snapshot }));
  },
  async revisions(pageId: string): Promise<Revision[]> {
    return check(await supabase.from('page_revisions').select('id, page_id, number, kind, message, created_by, created_at').eq('page_id', pageId).order('number', { ascending: false }).limit(100));
  },
  async revision(id: string): Promise<Revision> { return check(await supabase.from('page_revisions').select('*').eq('id', id).single()); },
  async restoreRevision(revisionId: string, expectedVersion: number) { return check(await supabase.rpc('restore_revision', { p_revision: revisionId, p_expected_version: expectedVersion })); },
  async duplicatePage(sourceId: string, slug: string, title: string): Promise<string> { return check(await supabase.rpc('duplicate_page', { p_source: sourceId, p_slug: slug, p_title: title })); },
  async setArchived(pageId: string, archived: boolean) { return check(await supabase.rpc('set_page_status', { p_page: pageId, p_archived: archived })); },
  async renamePage(pageId: string, slug: string | null, title: string | null) { return check(await supabase.rpc('rename_page', { p_page: pageId, p_slug: slug, p_title: title })); },

  async media(): Promise<Media[]> { return check(await supabase.from('media_assets').select('*').is('deleted_at', null).order('created_at', { ascending: false })); },
  async updateMedia(id: string, patch: Partial<Pick<Media, 'title' | 'alt' | 'file_name' | 'width' | 'height' | 'size_bytes'>>) { return check(await supabase.from('media_assets').update(patch).eq('id', id).select().single()); },
  async mediaUsage(id: string): Promise<{ page_id: string; title: string; where: string }[]> { return check(await supabase.rpc('media_usage', { p_media: id })); },
  async deleteMedia(m: Media) {
    const path = check(await supabase.rpc('delete_media', { p_media: m.id })) as string;
    const { error } = await supabase.storage.from('media').remove([path]);
    if (error) throw new AppError('Média retiré de la bibliothèque, mais le fichier n\'a pas pu être supprimé : ' + error.message);
  },
  async signedUrls(paths: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!paths.length) return map;
    const { data, error } = await supabase.storage.from('media').createSignedUrls(paths, 3600);
    if (error) throw new AppError(error.message);
    (data || []).forEach((d) => { if (d.signedUrl && d.path) map.set(d.path, d.signedUrl); });
    return map;
  },

  async publications(limit = 30): Promise<Publication[]> { return check(await supabase.from('publications').select('*').order('requested_at', { ascending: false }).limit(limit)); },
  async publication(id: string): Promise<Publication> { return check(await supabase.from('publications').select('*').eq('id', id).single()); },
  async publish(pageIds: string[] | null, message?: string): Promise<{ publication_id: string }> { return invoke('publish', { pages: pageIds, message }); },

  async audit(limit = 50, entityId?: string): Promise<AuditLog[]> {
    let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (entityId) q = q.eq('entity_id', entityId);
    return check(await q);
  },

  async settings(): Promise<Settings> {
    const rows = check(await supabase.from('site_settings').select('key, value')) as { key: keyof Settings; value: Record<string, unknown> }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Settings;
  },
  async saveSetting(key: keyof Settings, value: Record<string, unknown>) { return check(await supabase.from('site_settings').upsert({ key, value }).select().single()); },

  async conversions(): Promise<ConversionDef[]> { return check(await supabase.from('conversion_definitions').select('*').order('event_name')); },
  async saveConversion(c: Partial<ConversionDef>) { return check(await supabase.from('conversion_definitions').upsert(c).select().single()); },
  async deleteConversion(id: string) { return check(await supabase.from('conversion_definitions').delete().eq('id', id)); },

  async leads(limit = 200): Promise<Lead[]> { return check(await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(limit)); },
  async redirects(): Promise<{ id: string; from_path: string; to_path: string; created_at: string }[]> { return check(await supabase.from('redirects').select('*').order('created_at', { ascending: false })); },
  async deleteRedirect(id: string) { return check(await supabase.from('redirects').delete().eq('id', id)); },

  async members(): Promise<{ members: (Profile & { last_sign_in_at: string | null; confirmed: boolean })[] }> { return invoke('admin-users', { action: 'list' }); },
  async invite(email: string, role: Role) { return invoke('admin-users', { action: 'invite', email, role }); },
  async removeMember(userId: string) { return invoke('admin-users', { action: 'remove', user_id: userId }); },
  async setMember(userId: string, role: Role, active: boolean) { return check(await supabase.rpc('set_member', { p_user: userId, p_role: role, p_active: active })); },
  async updateMyName(name: string) { return check(await supabase.rpc('update_my_profile', { p_display_name: name })); },
};
