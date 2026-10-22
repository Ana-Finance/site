/**
 * ─────────────────────────────────────────────────────────────
 *  ANA FINANCE — CONFIGURATION DE LA VIDÉO
 *  Tous les textes, couleurs et durées sont modifiables ici.
 * ─────────────────────────────────────────────────────────────
 */

// ── Format ────────────────────────────────────────────────────
export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
};

// ── Durée de chaque scène (en images, 30 images = 1 s) ────────
export const SCENES = {
  hook: 120, // 0 → 4 s
  problem: 180, // 4 → 10 s
  reveal: 150, // 10 → 15 s
  demo: 510, // 15 → 32 s
  benefits: 240, // 32 → 40 s
  cta: 150, // 40 → 45 s
};

export type SceneKey = keyof typeof SCENES;

const SCENE_ORDER: SceneKey[] = [
  'hook',
  'problem',
  'reveal',
  'demo',
  'benefits',
  'cta',
];

export const TOTAL_DURATION = SCENE_ORDER.reduce(
  (sum, key) => sum + SCENES[key],
  0,
);

/** Image de départ d'une scène dans la vidéo complète. */
export const sceneStart = (key: SceneKey) => {
  let start = 0;
  for (const k of SCENE_ORDER) {
    if (k === key) return start;
    start += SCENES[k];
  }
  return start;
};

// ── Couleurs ──────────────────────────────────────────────────
export const COLORS = {
  // Marque
  pink: '#FF83FB',
  violet: '#A50AFF',
  black: '#000000',

  // Fond clair
  background: '#F8F6FC',
  surface: '#FFFFFF',
  text: '#0E0B16',
  textMuted: 'rgba(14, 11, 22, 0.62)',
  textSubtle: 'rgba(14, 11, 22, 0.42)',
  border: 'rgba(14, 11, 22, 0.08)',
  violetSoft: '#F3E6FF',
  shadow: '0 24px 60px rgba(88, 28, 135, 0.12), 0 2px 6px rgba(14, 11, 22, 0.04)',

  // États
  success: '#16A34A',
  successSoft: '#DCFCE7',
  danger: '#E11D48',

  // Couleur de chaque métier (badges et agents)
  persona: {
    Audit: '#2563EB',
    Comptabilité: '#A50AFF',
    'Contrôle de gestion': '#0D9488',
  } as Record<string, string>,
};

/** Dégradé de marque (texte, boutons, barres). */
export const BRAND_GRADIENT = `linear-gradient(100deg, ${COLORS.violet} 0%, ${COLORS.pink} 100%)`;

// ── Textes ────────────────────────────────────────────────────
// Règle : 8 mots maximum par plan.
export const TEXTS = {
  hook: {
    eyebrow: 'Audit · Expertise comptable · Contrôle de gestion',
    question: 'Combien d’heures de clôture passées à copier-coller ?',
    highlight: ['heures', 'copier-coller'],
  },

  problem: {
    title: 'Busy season : les tâches s’empilent.',
    // tag = métier concerné (couleur dans COLORS.persona)
    tasks: [
      { tag: 'Audit', label: 'Revue des pièces justificatives', meta: 'pièces à tester', count: 1840, icon: 'file' },
      { tag: 'Comptabilité', label: 'Rapprochements bancaires', meta: 'lignes à pointer', count: 1532, icon: 'bank' },
      { tag: 'Comptabilité', label: 'Écritures de clôture (FNP, CCA)', meta: 'écritures à passer', count: 248, icon: 'card' },
      { tag: 'Contrôle de gestion', label: 'Analyse budget vs réel', meta: 'écarts à commenter', count: 64, icon: 'chart' },
    ],
    meterLabel: 'Charge de l’équipe',
  },

  reveal: {
    brandFirst: 'Ana',
    brandSecond: 'Finance',
    promise: 'Vos collaborateurs IA en audit, compta et contrôle.',
  },

  demo: {
    captions: [
      { step: '01', text: 'Vous confiez la tâche.' },
      { step: '02', text: 'L’agent l’exécute, étape par étape.' },
      { step: '03', text: 'Chaque métier a ses agents.' },
    ],
    // Bulle de demande (côté utilisateur)
    userLabel: 'Vous · Manager audit',
    prompt: 'Prépare la revue analytique et justifie les écarts > 5 %',
    // Bulles de l'agent
    agentLabel: 'Agent Ana',
    thinking: 'Ana analyse la balance…',
    steps: [
      { phase: 'Analyse', label: 'Balance N / N-1 importée : 12 480 lignes' },
      { phase: 'Action', label: '23 écarts significatifs détectés' },
      { phase: 'Action', label: 'Écarts justifiés par les pièces' },
      { phase: 'Validation', label: 'Feuille de travail prête à revoir' },
    ],
    done: 'Terminé · envoyé en revue',
    // Bulles « un agent par métier » : tâches automatisées + indicateur qui monte
    agents: [
      {
        persona: 'Audit',
        name: 'Agent Audit',
        icon: 'shield',
        tasks: ['Revue analytique', 'Tests de détail', 'Circularisations'],
        from: 80, value: 99.2, decimals: 1, suffix: ' %', metricLabel: 'précision vérifiée',
      },
      {
        persona: 'Comptabilité',
        name: 'Agent Comptable',
        icon: 'file',
        tasks: ['Saisie et lettrage', 'Rapprochements bancaires', 'Écritures de clôture'],
        from: 0, value: 47, decimals: 0, suffix: ' h', metricLabel: 'économisées ce mois',
      },
      {
        persona: 'Contrôle de gestion',
        name: 'Agent Contrôle de gestion',
        icon: 'chart',
        tasks: ['Budget vs réel', 'Reporting mensuel', 'Prévisions de trésorerie'],
        from: 0, value: 1248, decimals: 0, suffix: '', metricLabel: 'analyses traçables',
      },
    ],
  },

  benefits: {
    title: 'Pourquoi auditeurs et contrôleurs adoptent Ana',
    cards: [
      { icon: 'clock', title: 'Busy season allégée', subtitle: 'La production confiée aux agents', stat: '−47 h / mois' },
      { icon: 'shield', title: 'Zéro erreur de saisie', subtitle: 'Chaque écriture contrôlée', stat: '99,2 % précision' },
      { icon: 'history', title: 'Piste d’audit complète', subtitle: 'Chaque décision tracée et réversible', stat: '100 % auditable' },
    ],
    bigNumber: 90,
    bigSuffix: ' %',
    bigText: 'de votre temps pour l’analyse et le conseil.',
  },

  cta: {
    headline: 'Confiez votre prochaine clôture à vos agents.',
    button: 'Demander une démo',
    url: 'ana-finance.com',
  },
};

// ── Audio ─────────────────────────────────────────────────────
// Fichiers dans public/audio (régénérables : python3 scripts/generate_audio.py)
export const AUDIO = {
  musicEnabled: true,
  music: 'audio/music.mp3',
  musicVolume: 0.85, // 0 → 1
  musicFadeOutFrames: 45,
  sfxEnabled: true,
  sfxVolume: 1, // volume global des effets sonores
};

// ── Assets (dossier /public) ──────────────────────────────────
export const ASSETS = {
  logoIcon: 'logo-icon.png',
  logoFull: 'logo-full.png', // logo complet (texte noir) : utilisé sur fond clair
};
