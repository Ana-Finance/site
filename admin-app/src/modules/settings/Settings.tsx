import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ImagePlus, Plus, Save, Trash2, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { ago } from '../../lib/format';
import { useAsync } from '../../components/hooks';
import { Badge, Button, Card, Field, Modal, Notice, Spinner, Switch, Tabs, useConfirm, useToast } from '../../components/ui';
import { useAuth } from '../../app/auth';
import { MediaPicker } from '../media/MediaPicker';
import type { ConversionDef, Role, Settings as S } from '../../lib/types';

type Tab = 'general' | 'contact' | 'seo' | 'analytics' | 'conversions' | 'members' | 'profile';

function SettingForm({ k, fields, settings, onSaved, help }: { k: keyof S; fields: { key: string; label: string; hint?: string; type?: string; placeholder?: string }[]; settings: S; onSaved: () => void; help?: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const [v, setV] = useState<Record<string, unknown>>(settings[k] || {});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => setV(settings[k] || {}), [settings, k]);
  const dirty = JSON.stringify(v) !== JSON.stringify(settings[k] || {});
  async function save() {
    setBusy(true);
    try { await api.saveSetting(k, v); toast({ tone: 'success', title: 'Paramètres enregistrés', text: 'Pris en compte à la prochaine publication.' }); onSaved(); }
    catch (e) { toast({ tone: 'error', title: 'Échec', text: errorMessage(e) }); } finally { setBusy(false); }
  }
  return (
    <Card footer={isAdmin && <Button variant="primary" icon={<Save />} disabled={!dirty} loading={busy} onClick={save}>Enregistrer</Button>}>
      <div className="stack">
        {!isAdmin && <Notice>Lecture seule : modifiable par un administrateur.</Notice>}
        {help}
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <input className="input" type={f.type || 'text'} disabled={!isAdmin} placeholder={f.placeholder} value={String(v[f.key] ?? '')} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
          </Field>
        ))}
      </div>
    </Card>
  );
}

function SeoGlobal({ settings, onSaved }: { settings: S; onSaved: () => void }) {
  const { isAdmin } = useAuth();
  const [picking, setPicking] = useState(false);
  const toast = useToast();
  const og = settings.seo?.defaultOgImage as { mediaId: string } | null;
  async function set(v: unknown) {
    try { await api.saveSetting('seo', { ...(settings.seo || {}), defaultOgImage: v }); toast({ tone: 'success', title: 'Image par défaut enregistrée' }); onSaved(); }
    catch (e) { toast({ tone: 'error', title: 'Échec', text: errorMessage(e) }); }
  }
  return (
    <Card title="Image de partage par défaut" subtitle="Utilisée comme og:image pour les pages qui n'en définissent pas.">
      <div className="row">
        {og ? <Badge tone="success">Image définie</Badge> : <Badge>Aucune</Badge>}
        {isAdmin && <Button size="sm" icon={<ImagePlus />} onClick={() => setPicking(true)}>Choisir</Button>}
        {isAdmin && og && <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => set(null)}>Retirer</Button>}
      </div>
      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(m) => { setPicking(false); set({ mediaId: m.id, width: m.width, height: m.height }); }} />}
    </Card>
  );
}

function Conversions() {
  const { data, reload, error } = useAsync(() => api.conversions(), []);
  const { isAdmin } = useAuth();
  const [edit, setEdit] = useState<Partial<ConversionDef> | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  async function save(c: Partial<ConversionDef>) {
    try { await api.saveConversion(c); setEdit(null); reload(); } catch (e) { toast({ tone: 'error', title: 'Échec', text: errorMessage(e) }); }
  }
  return (
    <Card title="Événements de conversion" subtitle="Événements envoyés par le site ; cochez ceux qui comptent comme conversions." actions={isAdmin && <Button size="sm" icon={<Plus />} onClick={() => setEdit({ event_name: '', label: '', description: '', is_conversion: true })}>Ajouter</Button>}>
      {error && <Notice tone="danger">{errorMessage(error)}</Notice>}
      <Notice>Chaque événement doit aussi être déclaré comme <b>Goal → Custom event</b> dans Plausible, avec exactement le même nom. Les formulaires n'émettent leur événement qu'après confirmation de l'enregistrement par le serveur.</Notice>
      <div className="list" style={{ marginTop: 10 }}>
        {(data || []).map((c) => (
          <div key={c.id} className="list-item">
            <div className="grow"><b>{c.label}</b> <code className="faint">{c.event_name}</code><div className="small muted">{c.description}</div></div>
            <Switch checked={c.is_conversion} disabled={!isAdmin} onChange={(v) => save({ ...c, is_conversion: v })} label="Conversion" />
            {isAdmin && <Button size="sm" variant="ghost" onClick={() => setEdit(c)}>Modifier</Button>}
            {isAdmin && <Button size="sm" variant="ghost" iconOnly aria-label="Supprimer" icon={<Trash2 />} onClick={async () => { if (await confirm({ title: 'Supprimer cet événement ?', danger: true, confirm: 'Supprimer', text: c.event_name })) { await api.deleteConversion(c.id); reload(); } }} />}
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? 'Modifier l\'événement' : 'Nouvel événement'} onClose={() => setEdit(null)} footer={<><Button onClick={() => setEdit(null)}>Annuler</Button><Button variant="primary" disabled={!/^[a-z][a-z0-9_]{1,60}$/.test(edit.event_name || '') || !edit.label} onClick={() => save(edit)}>Enregistrer</Button></>}>
          <Field label="Nom technique" hint="Minuscules, chiffres et _ (identique dans Plausible)."><input className="input mono" value={edit.event_name} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, event_name: e.target.value })} /></Field>
          <Field label="Libellé"><input className="input" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></Field>
          <Field label="Description"><textarea className="textarea" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <Switch checked={!!edit.is_conversion} onChange={(v) => setEdit({ ...edit, is_conversion: v })} label="Compter comme conversion" />
          <Notice>Pour un nouvel événement, le site doit l'émettre : <code>anaAnalytics.track('{edit.event_name || 'nom'}')</code> ou un lien portant <code>data-ana-event="{edit.event_name || 'nom'}"</code>.</Notice>
        </Modal>
      )}
    </Card>
  );
}

function Members() {
  const { isAdmin, profile } = useAuth();
  const { data, error, reload, loading } = useAsync(() => (isAdmin ? api.members() : api.profiles().then((m) => ({ members: m.map((x) => ({ ...x, last_sign_in_at: null, confirmed: true })) }))), [isAdmin]);
  const [invite, setInvite] = useState<{ email: string; role: Role } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  async function send() {
    if (!invite) return;
    setBusy(true);
    try { await api.invite(invite.email, invite.role); toast({ tone: 'success', title: 'Invitation envoyée', text: invite.email }); setInvite(null); reload(); }
    catch (e) { toast({ tone: 'error', title: 'Invitation impossible', text: errorMessage(e) }); } finally { setBusy(false); }
  }
  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast({ tone: 'success', title: ok }); reload(); } catch (e) { toast({ tone: 'error', title: 'Action impossible', text: errorMessage(e) }); }
  }
  return (
    <Card title="Comptes administrateurs" subtitle="Inscription publique désactivée : seuls les comptes invités ont accès." actions={isAdmin && <Button size="sm" variant="primary" icon={<UserPlus />} onClick={() => setInvite({ email: '', role: 'editor' })}>Inviter</Button>} bodyClass="table-wrap">
      {error && <Notice tone="danger">{errorMessage(error)}</Notice>}
      {loading && !data ? <Spinner /> : (
        <table className="table responsive">
          <thead><tr><th>Membre</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th className="actions" /></tr></thead>
          <tbody>{(data?.members || []).map((m) => (
            <tr key={m.id}>
              <td><b>{m.display_name || m.email}</b><div className="small muted">{m.email}{m.id === profile?.id && ' (vous)'}</div></td>
              <td>{isAdmin && m.id !== profile?.id ? (
                <select className="select" style={{ height: 30, width: 'auto' }} value={m.role} onChange={(e) => act(() => api.setMember(m.id, e.target.value as Role, m.active), 'Rôle modifié')}>
                  <option value="admin">Administrateur</option><option value="editor">Éditeur</option>
                </select>) : <Badge tone={m.role === 'admin' ? 'accent' : undefined}>{m.role === 'admin' ? 'Administrateur' : 'Éditeur'}</Badge>}</td>
              <td>{!m.active ? <Badge tone="warning">Désactivé</Badge> : m.confirmed ? <Badge tone="success" dot>Actif</Badge> : <Badge tone="info">Invitation envoyée</Badge>}</td>
              <td data-hide-mobile className="small muted">{m.last_sign_in_at ? ago(m.last_sign_in_at) : '—'}</td>
              <td className="actions">{isAdmin && m.id !== profile?.id && <>
                <Button size="sm" variant="ghost" onClick={() => act(() => api.setMember(m.id, m.role, !m.active), m.active ? 'Compte désactivé' : 'Compte réactivé')}>{m.active ? 'Désactiver' : 'Réactiver'}</Button>
                <Button size="sm" variant="ghost" iconOnly aria-label="Supprimer" icon={<Trash2 />} onClick={async () => { if (await confirm({ title: 'Supprimer ce compte ?', danger: true, confirm: 'Supprimer', text: `${m.email} perdra définitivement l'accès. Son historique est conservé.` })) act(() => api.removeMember(m.id), 'Compte supprimé'); }} />
              </>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <div style={{ marginTop: 12 }}><Notice><b>Administrateur</b> : tout, dont publication, utilisateurs et paramètres. <b>Éditeur</b> : modifie les brouillons et gère ses médias ; ne publie pas.</Notice></div>
      {invite && (
        <Modal title="Inviter un membre" onClose={() => setInvite(null)} footer={<><Button onClick={() => setInvite(null)}>Annuler</Button><Button variant="primary" loading={busy} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)} onClick={send}>Envoyer l'invitation</Button></>}>
          <Field label="E-mail"><input className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} autoFocus /></Field>
          <Field label="Rôle"><select className="select" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}><option value="editor">Éditeur</option><option value="admin">Administrateur</option></select></Field>
          <span className="hint">La personne reçoit un lien pour choisir son mot de passe.</span>
        </Modal>
      )}
    </Card>
  );
}

function Profile() {
  const { profile, refreshProfile, session } = useAuth();
  const [name, setName] = useState(profile?.display_name || '');
  const toast = useToast();
  return (
    <Card title="Mon profil" footer={<Button variant="primary" disabled={name === profile?.display_name} onClick={async () => { try { await api.updateMyName(name); await refreshProfile(); toast({ tone: 'success', title: 'Profil mis à jour' }); } catch (e) { toast({ tone: 'error', title: 'Échec', text: errorMessage(e) }); } }}>Enregistrer</Button>}>
      <div className="stack">
        <Field label="Nom affiché"><input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="E-mail"><input className="input" value={session?.user.email || ''} disabled /></Field>
        <span className="hint">Pour changer de mot de passe : déconnectez-vous puis « Mot de passe oublié ? ».</span>
      </div>
    </Card>
  );
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'general';
  const settings = useAsync(() => api.settings(), []);
  const s = settings.data;
  return (
    <div className="content">
      <div className="page-head"><div><h1>Paramètres</h1><p>Configuration du site, de l'analytics et des accès.</p></div></div>
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { value: 'general', label: 'Général' }, { value: 'contact', label: 'Coordonnées & réseaux' }, { value: 'seo', label: 'SEO global' },
        { value: 'analytics', label: 'Analytics' }, { value: 'conversions', label: 'Conversions' }, { value: 'members', label: 'Utilisateurs' }, { value: 'profile', label: 'Mon profil' },
      ]} />
      {settings.error && <Notice tone="danger">{errorMessage(settings.error)}</Notice>}
      {!s && !['conversions', 'members', 'profile'].includes(tab) ? <Spinner /> : null}
      {s && tab === 'general' && <SettingForm k="general" settings={s} onSaved={settings.reload} fields={[
        { key: 'siteName', label: 'Nom du site' },
        { key: 'siteUrl', label: 'URL publique du site', type: 'url', hint: 'Avec la barre finale, ex. https://ana-finance.github.io/site/. Sert aux URL canoniques, au sitemap et à la vérification des publications.' },
      ]} />}
      {s && tab === 'contact' && (
        <div className="stack">
          <SettingForm k="contact" settings={s} onSaved={settings.reload} help={<Notice>Ces informations alimentent les données structurées (schema.org Organization) de la page d'accueil. Les coordonnées affichées dans le pied de page se modifient dans Pages → En-tête et pied de page.</Notice>} fields={[
            { key: 'email', label: 'E-mail de contact', type: 'email' }, { key: 'phone', label: 'Téléphone', placeholder: '+33 1 23 45 67 89' }, { key: 'address', label: 'Adresse postale' },
          ]} />
          <SettingForm k="social" settings={s} onSaved={settings.reload} fields={[
            { key: 'linkedin', label: 'LinkedIn', type: 'url' }, { key: 'x', label: 'X (Twitter)', type: 'url' }, { key: 'youtube', label: 'YouTube', type: 'url' },
          ]} />
        </div>
      )}
      {s && tab === 'seo' && <SeoGlobal settings={s} onSaved={settings.reload} />}
      {s && tab === 'analytics' && <SettingForm k="analytics" settings={s} onSaved={settings.reload}
        help={<Notice>Plausible : renseignez le domaine tel que déclaré dans votre compte. La clé API n'est <b>jamais</b> saisie ici : elle est stockée dans les secrets Supabase (<code>PLAUSIBLE_API_KEY</code>, voir docs/SETUP.md). Le script de mesure est ajouté aux pages à la prochaine publication.</Notice>}
        fields={[{ key: 'domain', label: 'Domaine Plausible', placeholder: 'ana-finance.github.io/site' }, { key: 'scriptSrc', label: 'URL du script', hint: 'Par défaut https://plausible.io/js/script.js (ou script de votre instance auto-hébergée).' }]} />}
      {tab === 'conversions' && <Conversions />}
      {tab === 'members' && <Members />}
      {tab === 'profile' && <Profile />}
    </div>
  );
}
