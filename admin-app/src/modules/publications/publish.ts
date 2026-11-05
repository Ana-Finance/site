import { api } from '../../lib/api';

/** Déclenche une publication réelle (Edge Function → GitHub Actions). Renvoie l'id de publication. */
export async function publishPages(pageIds: string[] | null, message?: string): Promise<string> {
  const res = await api.publish(pageIds, message);
  return res.publication_id;
}

export const STATUS_LABEL: Record<string, string> = {
  queued: 'En file d\'attente', building: 'Construction du site', deploying: 'Déploiement', verifying: 'Vérification en ligne',
  succeeded: 'En ligne', failed: 'Échec', cancelled: 'Annulée',
};
export const STEPS = ['queued', 'building', 'deploying', 'verifying', 'succeeded'] as const;
