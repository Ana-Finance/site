// Demandes reçues par les formulaires du site : libellés lisibles et suivi « vu / pas encore vu ».
// Le repère « vu » est propre à chaque navigateur (stockage local) : il ne demande aucune modification de la base.
import { useCallback, useEffect, useState } from 'react';
import type { Lead } from './types';

export type LeadKind = 'Démo' | 'Candidature' | 'Contact';

/** Type de demande tel qu'on le lit : la page d'origine précise le formulaire « contact ». */
export function leadKind(l: Pick<Lead, 'form' | 'page' | 'profile'>): LeadKind {
  if (l.form === 'demo') return 'Démo';
  if (l.page === 'carrieres' || /candidature/i.test(l.profile || '')) return 'Candidature';
  return 'Contact';
}

const KEY = 'ana-admin:demandes-vues';
const CHANGED = 'ana-admin:demandes-vues';
const RECENT_MS = 30 * 24 * 3600 * 1000;

function readSeen(): number {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}

/** Demandes arrivées depuis la dernière consultation ; à la première visite, celles des 30 derniers jours. */
export function unseenLeads(leads: Lead[], seen: number, now = Date.now()): Lead[] {
  const since = seen || now - RECENT_MS;
  return leads.filter((l) => new Date(l.created_at).getTime() > since);
}

/** Repère « vu jusqu'à », partagé entre le menu, le tableau de bord et la page Demandes. */
export function useLeadsSeen() {
  const [seen, setSeen] = useState(readSeen);
  useEffect(() => {
    const sync = () => setSeen(readSeen());
    window.addEventListener(CHANGED, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(CHANGED, sync); window.removeEventListener('storage', sync); };
  }, []);
  const markSeen = useCallback((leads: Lead[]) => {
    const latest = leads.reduce((m, l) => Math.max(m, new Date(l.created_at).getTime()), Date.now());
    try { localStorage.setItem(KEY, String(latest)); } catch { /* stockage indisponible : l'alerte reviendra à la prochaine visite */ }
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return { seen, markSeen };
}
