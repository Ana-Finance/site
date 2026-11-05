import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ImagePlus, Save, SearchCheck, Trash2, XCircle } from 'lucide-react';
import type { Seo as SeoT } from '@cms';
import { api } from '../../lib/api';
import { usePageDraft } from '../../lib/draft';
import { errorMessage } from '../../lib/supabase';
import { publicPageUrl } from '../../lib/site';
import { resolveMediaUrls } from '../../lib/media';
import { useAsync } from '../../components/hooks';
import { Badge, Button, Card, Drawer, Empty, Field, Notice, Spinner, Switch, useConfirm, useToast } from '../../components/ui';
import { useAuth } from '../../app/auth';
import { MediaPicker } from '../media/MediaPicker';
import type { PageRow } from '../../lib/types';

type Issue = { level: 'bad' | 'warn'; text: string };
export function seoIssues(seo: SeoT | null | undefined): Issue[] {
  const s = seo || {};
  const out: Issue[] = [];
  const t = (s.title || '').trim(); const d = (s.description || '').trim();
  if (!t) out.push({ level: 'bad', text: 'Meta title manquant' });
  else if (t.length > 65) out.push({ level: 'warn', text: `Title long (${t.length} car.) : risque de troncature` });
  else if (t.length < 25) out.push({ level: 'warn', text: 'Title court' });
  if (!d) out.push({ level: 'bad', text: 'Meta description manquante' });
  else if (d.length > 165) out.push({ level: 'warn', text: `Description longue (${d.length} car.)` });
  else if (d.length < 70) out.push({ level: 'warn', text: 'Description courte' });
  if (!s.ogImage) out.push({ level: 'warn', text: 'Pas d\'image de partage (Open Graph)' });
  if (s.noindex) out.push({ level: 'warn', text: 'Page exclue des moteurs (noindex)' });
  return out;
}

function SeoEditor({ page, onClose, onSaved }: { page: PageRow; onClose: () => void; onSaved: () => void }) {
  const d = usePageDraft(page.slug);
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [ogUrl, setOgUrl] = useState<string | null>(null);
  const seo = d.state?.content.seo || {};
  const og = seo.ogImage;
  useEffect(() => {
    if (og?.mediaId) resolveMediaUrls([og.mediaId]).then((m) => setOgUrl(m.get(og.mediaId!)?.url || null));
    else setOgUrl(og?.src || null);
  }, [og?.mediaId, og?.src]);
  const missingAlt = useMemo(() => (d.state ? d.state.model.fields.filter((f) => (f.type === 'image' || (f.type === 'slot' && (d.valueOf(f.key)?.mediaId || d.valueOf(f.key)?.src))) && !(d.valueOf(f.key)?.alt || '').trim()) : []), [d]);

  async function save() {
    try { await d.save('SEO'); toast({ tone: 'success', title: 'SEO enregistré dans le brouillon', text: 'Publiez la page pour mettre à jour les balises en ligne.' }); onSaved(); }
    catch (e) { toast({ tone: 'error', title: 'Échec', text: errorMessage(e) }); }
  }
  const title = seo.title || ''; const desc = seo.description || '';
  return (
    <Drawer title={`SEO — ${page.title}`} onClose={onClose} footer={<><Button onClick={onClose}>Fermer</Button><Button variant="primary" icon={<Save />} disabled={!d.dirty} loading={d.saving} onClick={save}>Enregistrer le brouillon</Button></>}>
      {!d.state ? <Spinner /> : (
        <>
          <div className="stack-sm">
            <span className="small muted strong">Aperçu Google (indicatif)</span>
            <div className="serp">
              <div className="url"><i />{publicPageUrl(page.slug).replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>
              <div className="title">{title || 'Titre manquant'}</div>
              <div className="desc">{desc || 'Google générera un extrait à partir du contenu de la page.'}</div>
            </div>
          </div>
          <Field label="Meta title" counter={{ value: title.length, min: 25, max: 60 }} hint="50 à 60 caractères recommandés.">
            <input className="input" value={title} onChange={(e) => d.setSeo({ title: e.target.value })} />
          </Field>
          <Field label="Meta description" counter={{ value: desc.length, min: 70, max: 160 }} hint="120 à 160 caractères recommandés.">
            <textarea className="textarea" rows={3} value={desc} onChange={(e) => d.setSeo({ description: e.target.value })} />
          </Field>
          <div className="divider" />
          <b className="small">Partage (Open Graph)</b>
          <div className="og-card">
            <div className="og-img">{ogUrl ? <img src={ogUrl} alt="" /> : <span className="small">Aucune image</span>}</div>
            <div className="og-txt"><b className="small">{seo.ogTitle || title || 'Titre'}</b><span className="small muted">{seo.ogDescription || desc}</span></div>
          </div>
          <div className="row">
            <Button size="sm" icon={<ImagePlus />} onClick={() => setPicking(true)}>{og ? 'Changer l\'image' : 'Choisir une image'}</Button>
            {og && <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => d.setSeo({ ogImage: null })}>Retirer</Button>}
            <span className="hint">1200 × 630 px recommandé.</span>
          </div>
          <Field label="Titre de partage" hint="Vide = meta title."><input className="input" value={seo.ogTitle || ''} onChange={(e) => d.setSeo({ ogTitle: e.target.value })} /></Field>
          <Field label="Description de partage" hint="Vide = meta description."><textarea className="textarea" rows={2} value={seo.ogDescription || ''} onChange={(e) => d.setSeo({ ogDescription: e.target.value })} /></Field>
          <div className="divider" />
          <Field label="URL canonique" hint="Vide = adresse de la page (générée automatiquement au build)."><input className="input mono" placeholder={publicPageUrl(page.slug)} value={seo.canonical || ''} onChange={(e) => d.setSeo({ canonical: e.target.value })} /></Field>
          <Switch checked={!!seo.noindex} onChange={(v) => d.setSeo({ noindex: v })} label="Exclure des moteurs de recherche (noindex) et du sitemap" />
          <Field label="Adresse (slug)"><div className="row"><code>{page.slug}.html</code><Link className="small" to={`/pages/${page.id}`} onClick={onClose}>Modifier dans les réglages de la page</Link></div></Field>
          <div className="stack-sm">
            <b className="small">Textes alternatifs</b>
            {missingAlt.length ? missingAlt.map((f) => <div key={f.key} className="row small"><AlertTriangle size={14} color="var(--warning)" />{f.label}<Link to={`/editor/${page.slug}?field=${encodeURIComponent(f.key)}`} onClick={onClose}>Compléter</Link></div>) : <span className="small muted">Toutes les images ont un texte alternatif.</span>}
          </div>
          {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(m) => { d.setSeo({ ogImage: { mediaId: m.id, width: m.width ?? undefined, height: m.height ?? undefined } }); setPicking(false); }} />}
        </>
      )}
    </Drawer>
  );
}

export default function Seo() {
  const pages = useAsync(() => api.pages(), []);
  const redirects = useAsync(() => api.redirects(), []);
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<PageRow | null>(null);
  const rows = (pages.data || []).filter((p) => p.slug !== '_global' && p.status !== 'archived');
  const issues = rows.map((p) => ({ p, issues: seoIssues(p.seo) }));
  const bad = issues.filter((x) => x.issues.some((i) => i.level === 'bad')).length;

  return (
    <div className="content">
      <div className="page-head"><div><h1>SEO</h1><p>Balises générées dans le HTML statique de chaque page à la publication (pas d'injection JavaScript).</p></div></div>
      <div className="grid g-3">
        <Card><div className="stack-sm"><span className="small muted">Pages indexables</span><b style={{ fontSize: 22 }}>{rows.filter((p) => !p.seo?.noindex).length}</b><span className="small faint">incluses dans sitemap.xml</span></div></Card>
        <Card><div className="stack-sm"><span className="small muted">Pages avec un champ manquant</span><b style={{ fontSize: 22 }}>{bad}</b></div></Card>
        <Card><div className="stack-sm"><span className="small muted">Redirections actives</span><b style={{ fontSize: 22 }}>{redirects.data?.length ?? '—'}</b></div></Card>
      </div>
      {pages.error && <Notice tone="danger">{errorMessage(pages.error)}</Notice>}
      <Card bodyClass="table-wrap">
        <table className="table responsive">
          <thead><tr><th>Page</th><th>Meta title</th><th>Description</th><th>État</th><th className="actions" /></tr></thead>
          <tbody>{issues.map(({ p, issues: is }) => (
            <tr key={p.id}>
              <td><b>{p.title}</b><div className="small faint mono">{p.slug}.html</div></td>
              <td data-hide-mobile className="small truncate" style={{ maxWidth: 260 }}>{p.seo?.title || <span className="faint">—</span>}</td>
              <td data-hide-mobile className="small"><span className="muted">{(p.seo?.description || '').length} car.</span></td>
              <td>{is.length === 0 ? <Badge tone="success"><CheckCircle2 size={11} />Complet</Badge> : (
                <span className="stack-sm">{is.slice(0, 2).map((i) => <span key={i.text} className="row small" style={{ gap: 4 }}>{i.level === 'bad' ? <XCircle size={12} color="var(--danger)" /> : <AlertTriangle size={12} color="var(--warning)" />}{i.text}</span>)}</span>
              )}</td>
              <td className="actions"><Button size="sm" icon={<SearchCheck />} onClick={() => setEdit(p)}>Optimiser</Button></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <Card title="Redirections" subtitle="Créées automatiquement lors d'un changement d'adresse ; générées en pages HTML de redirection (GitHub Pages n'a pas de redirections serveur).">
        {redirects.data?.length ? (
          <div className="list">{redirects.data.map((r) => (
            <div key={r.id} className="list-item"><code className="grow">{r.from_path} → {r.to_path}</code>
              {isAdmin && <Button size="sm" variant="ghost" iconOnly aria-label="Supprimer" icon={<Trash2 />} onClick={async () => {
                if (!(await confirm({ title: 'Supprimer la redirection ?', danger: true, confirm: 'Supprimer', text: `${r.from_path} renverra une erreur 404 après la prochaine publication.` }))) return;
                try { await api.deleteRedirect(r.id); redirects.reload(); } catch (e) { toast({ tone: 'error', title: 'Échec', text: errorMessage(e) }); }
              }} />}
            </div>
          ))}</div>
        ) : <Empty title="Aucune redirection" />}
      </Card>
      <Notice>Le sitemap (<code>sitemap.xml</code>) et <code>robots.txt</code> sont générés à chaque publication. Sur une adresse github.io/site/, les moteurs ne lisent pas robots.txt (il doit être à la racine du domaine) : soumettez le sitemap dans Google Search Console, ou utilisez un domaine personnalisé.</Notice>
      {edit && <SeoEditor page={edit} onClose={() => setEdit(null)} onSaved={() => pages.reload()} />}
    </div>
  );
}
