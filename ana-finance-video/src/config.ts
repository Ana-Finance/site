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
};

/** Dégradé de marque (texte, boutons, barres). */
export const BRAND_GRADIENT = `linear-gradient(100deg, ${COLORS.violet} 0%, ${COLORS.pink} 100%)`;

// ── Textes ────────────────────────────────────────────────────
// Règle : 8 mots maximum par plan.
export const TEXTS = {
  hook: {
    eyebrow: 'Experts-comptables · Auditeurs · Contrôleurs',
    question: 'Combien d’heures perdues en saisie cette semaine ?',
    highlight: ['heures'],
  },

  problem: {
    title: 'Les tâches répétitives s’empilent.',
    tasks: [
      { label: 'Saisie des factures', meta: 'factures à saisir', count: 248, icon: 'file' },
      { label: 'Rapprochements bancaires', meta: 'lignes à pointer', count: 1532, icon: 'bank' },
      { label: 'Reporting mensuel', meta: 'tableaux à consolider', count: 36, icon: 'chart' },
    ],
    meterLabel: 'Charge de l’équipe',
  },

  reveal: {
    brandFirst: 'Ana',
    brandSecond: 'Finance',
    promise: 'Des agents IA qui automatisent vos process.',
  },

  demo: {
    captions: [
      { step: '01', text: 'Vous décrivez la tâche.' },
      { step: '02', text: 'L’agent l’exécute, étape par étape.' },
      { step: '03', text: 'Vos indicateurs décollent.' },
    ],
    // Bulle de demande (côté utilisateur)
    userLabel: 'Vous',
    prompt: 'Saisis et catégorise les factures fournisseurs de juin',
    // Bulles de l'agent
    agentLabel: 'Agent Ana',
    thinking: 'Ana analyse votre demande…',
    steps: [
      { phase: 'Analyse', label: '248 factures lues et comprises' },
      { phase: 'Action', label: 'Dépenses catégorisées au plan comptable' },
      { phase: 'Action', label: '248 écritures générées' },
      { phase: 'Validation', label: 'Contrôle qualité : 0 anomalie' },
    ],
    done: 'Terminé · prêt à valider',
    // Bulles d'indicateurs
    kpis: [
      { icon: 'clock', from: 0, value: 47, decimals: 0, suffix: ' h', label: 'économisées ce mois', trend: '+32 %' },
      { icon: 'file', from: 0, value: 1248, decimals: 0, suffix: '', label: 'écritures générées', trend: '+58 %' },
      { icon: 'shield', from: 80, value: 99.2, decimals: 1, suffix: ' %', label: 'précision vérifiée', trend: '+4,1 pts' },
      { icon: 'check', from: 37, value: 0, decimals: 0, suffix: '', label: 'erreur de saisie', trend: '−100 %' },
    ],
    chartTitle: 'Heures libérées',
    chartValues: [6, 9, 12, 14, 18, 21, 25, 28, 33, 38, 42, 47],
  },

  benefits: {
    title: 'Pourquoi les cabinets choisissent Ana',
    cards: [
      { icon: 'clock', title: 'Gain de temps', subtitle: 'Des heures libérées chaque semaine', stat: '−47 h / mois' },
      { icon: 'shield', title: 'Zéro erreur de saisie', subtitle: 'Chaque écriture contrôlée', stat: '99,2 % précision' },
      { icon: 'history', title: 'Tout est traçable', subtitle: 'Chaque décision auditable et réversible', stat: '100 % auditable' },
    ],
    bigNumber: 90,
    bigSuffix: ' %',
    bigText: 'de votre temps pour ce qui compte vraiment.',
  },

  cta: {
    headline: 'Générez maintenant vos premières saisies.',
    button: 'Créer mon compte',
    url: 'ana-finance.com',
  },
};

// ── Audio ─────────────────────────────────────────────────────
// Fichiers dans public/audio (régénérables : python3 scripts/generate_audio.py)
export const AUDIO = {
  musicEnabled: true,
  music: 'audio/music.mp3',
  musicVolume: 0.42, // 0 → 1
  musicFadeOutFrames: 45,
  sfxEnabled: true,
  sfxVolume: 0.9, // volume global des effets sonores
};

// ── Assets (dossier /public) ──────────────────────────────────
export const ASSETS = {
  logoIcon: 'logo-icon.png',
  logoFull: 'logo-full.png', // logo complet (texte noir) : utilisé sur fond clair
};
