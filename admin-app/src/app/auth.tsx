import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, authRedirectType } from '../lib/supabase';
import { api } from '../lib/api';
import type { Profile } from '../lib/types';

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  /** Le compte est authentifié mais n'a pas (ou plus) de profil actif : aucun accès. */
  denied: boolean;
  passwordSetup: 'invite' | 'recovery' | null;
  clearPasswordSetup: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [passwordSetup, setPasswordSetup] = useState<'invite' | 'recovery' | null>(authRedirectType);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setDenied(false); return; }
    try {
      const p = await api.me();
      setProfile(p && p.active ? p : null);
      setDenied(!p || !p.active);
    } catch { setProfile(null); setDenied(true); }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
      if (/access_token|type=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#/');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordSetup('recovery');
      if (event === 'SIGNED_OUT') { setProfile(null); setDenied(false); }
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(() => loadProfile(s), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const value: AuthState = {
    ready, session, profile, denied, passwordSetup,
    isAdmin: profile?.role === 'admin',
    clearPasswordSetup: () => setPasswordSetup(null),
    refreshProfile: () => loadProfile(session),
    signOut: async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
