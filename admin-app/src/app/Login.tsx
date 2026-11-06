import { useState, type FormEvent } from 'react';
import { KeyRound, LogIn, Mail, ShieldX } from 'lucide-react';
import { supabase, errorMessage } from '../lib/supabase';
import { Button, Field, Notice } from '../components/ui';
import { useAuth } from './auth';
import { siteBase } from '../lib/site';

export const logo = new URL('assets/img/ana-logo-icon.png', siteBase).href;

function Brand() {
  return <div className="brand"><img src={logo} alt="" /><div>Ana Finance<small>Administration</small></div></div>;
}

export function AuthScreen({ children }: { children: React.ReactNode }) {
  return <div className="center-screen auth-bg"><div className="card auth-card"><Brand />{children}</div></div>;
}

export function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Identifiants incorrects.' : error.message);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.href.split('#')[0] });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <AuthScreen>
      <div className="stack-sm" style={{ textAlign: 'center' }}>
        <h1>{mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}</h1>
        <p className="muted small">{mode === 'login' ? 'Accès réservé aux membres invités.' : 'Recevez un lien de réinitialisation par e-mail.'}</p>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {sent ? (
        <Notice tone="success">Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.</Notice>
      ) : (
        <form className="stack" onSubmit={submit}>
          <Field label="E-mail" htmlFor="email"><input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {mode === 'login' && (
            <Field label="Mot de passe" htmlFor="password"><input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          )}
          <Button type="submit" variant="primary" className="block" loading={busy} icon={mode === 'login' ? <LogIn /> : <Mail />}>{mode === 'login' ? 'Se connecter' : 'Envoyer le lien'}</Button>
        </form>
      )}
      <Button variant="ghost" size="sm" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(null); setSent(false); }} icon={<KeyRound />}>
        {mode === 'login' ? 'Mot de passe oublié ?' : 'Retour à la connexion'}
      </Button>
    </AuthScreen>
  );
}

export function SetPassword() {
  const { passwordSetup, clearPasswordSetup } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 12) return setError('12 caractères minimum.');
    if (pw !== pw2) return setError('Les deux mots de passe ne correspondent pas.');
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    clearPasswordSetup();
  }
  return (
    <AuthScreen>
      <div className="stack-sm" style={{ textAlign: 'center' }}>
        <h1>{passwordSetup === 'invite' ? 'Bienvenue' : 'Nouveau mot de passe'}</h1>
        <p className="muted small">Choisissez un mot de passe d'au moins 12 caractères.</p>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <form className="stack" onSubmit={submit}>
        <Field label="Mot de passe" htmlFor="pw"><input id="pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Confirmation" htmlFor="pw2"><input id="pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        <Button type="submit" variant="primary" className="block" loading={busy}>Enregistrer</Button>
      </form>
    </AuthScreen>
  );
}

export function Denied() {
  const { signOut, session } = useAuth();
  return (
    <AuthScreen>
      <div className="empty" style={{ padding: 0 }}>
        <div className="icon-tile"><ShieldX /></div>
        <h3>Accès non autorisé</h3>
        <p>Le compte {session?.user.email} n'est pas membre de l'administration, ou a été désactivé. Demandez une invitation à un administrateur.</p>
      </div>
      <Button onClick={signOut} className="block">Se déconnecter</Button>
    </AuthScreen>
  );
}

export function NotConfigured() {
  return (
    <AuthScreen>
      <Notice tone="warning" title="Administration non configurée">
        L'adresse et la clé publique de Supabase n'étaient pas disponibles lors du déploiement
        (secret GitHub <code>SUPABASE_ACCESS_TOKEN</code>, ou variables <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code>).
        Voir <code>docs/SUPABASE_WORKFLOWS.md</code>, puis relancer « Build &amp; déploiement ».
      </Notice>
    </AuthScreen>
  );
}
