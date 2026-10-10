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

  // Textes sur fond sombre
  textOnDark: '#FFFFFF',
  mutedOnDark: 'rgba(255, 255, 255, 0.62)',
  subtleOnDark: 'rgba(255, 255, 255, 0.38)',
  cardOnDark: 'rgba(255, 255, 255, 0.045)',
  borderOnDark: 'rgba(255, 255, 255, 0.10)',
  danger: '#FF4D6D',

  // Interface de l'application (maquette)
  uiBg: '#F3F4F8',
  uiSurface: '#FFFFFF',
  uiBorder: '#E5E6EE',
  uiText: '#15151F',
  uiMuted: '#6B6F80',
  uiPrimary: '#9A12F5',
  uiPrimarySoft: '#F2E6FF',
  uiKpi: '#4C1D95',
  uiKpiBand: 'linear-gradient(90deg, #EDE3FF 0%, #E6ECFF 50%, #EEDDFB 100%)',
  uiSuccess: '#22C55E',
  uiWarning: '#F59E0B',
  uiInfo: '#3B82F6',
  uiTitleBar: '#ECEDF2',
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
    windowUrl: 'app.ana-finance.com',
    org: { initials: 'NR', name: 'Nimbus Robotics', sub: 'Série A · SaaS' },
    user: { initials: 'CR', name: 'Camille Roy', role: 'CFO' },
    nav: ['Cockpit DAF', 'Finance', 'Banque & Paiements', 'Clôture comptable', 'AI & Écosystème'],
    pageTitle: 'Agents IA',
    pageSubtitle: 'Confiez vos tâches de production. Vous gardez le contrôle.',
    composerTitle: 'Confier une tâche',
    chips: ['Ana choisit', 'Comptable', 'CFO', 'Clôture', 'Audit'],
    prompt: 'Saisis et catégorise les factures fournisseurs de juin',
    button: 'Confier',
    runTitle: 'Agent Comptable · en cours',
    runDone: 'Agent Comptable · terminé',
    steps: [
      { label: 'Analyse de 248 factures', detail: 'Lecture IA + OCR' },
      { label: 'Catégorisation des dépenses', detail: 'Plan comptable PCG' },
      { label: 'Génération des écritures', detail: '248 écritures' },
      { label: 'Validation par Audit Bot', detail: '0 anomalie' },
    ],
    toast: 'Tâche terminée · 248 écritures prêtes',
    dashTitle: 'Cockpit DAF',
    dashSubtitle: 'Impact de vos agents ce mois-ci',
    kpis: [
      { value: 47, decimals: 0, suffix: ' h', label: 'économisées ce mois', sub: '≈ 1,2 ETP comptable' },
      { value: 1248, decimals: 0, suffix: '', label: 'écritures générées', sub: 'traçables et réversibles' },
      { value: 99.2, decimals: 1, suffix: ' %', label: 'précision vérifiée', sub: 'contrôlée par Audit Bot' },
      { value: 0, decimals: 0, suffix: '', label: 'erreur de saisie', sub: 'sur 30 jours' },
    ],
    chartTitle: 'Heures économisées par mois',
    chartMonths: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
    chartValues: [6, 9, 12, 14, 18, 21, 25, 28, 33, 38, 42, 47],
    activityTitle: 'Activité des agents',
    activities: [
      { text: '248 factures saisies', time: 'à l’instant' },
      { text: 'Banque rapprochée à 100 %', time: 'il y a 4 min' },
      { text: 'FNP de juin préparées', time: 'il y a 12 min' },
      { text: 'Relances clients envoyées', time: 'il y a 26 min' },
    ],
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

// ── Assets (dossier /public) ──────────────────────────────────
export const ASSETS = {
  logoIcon: 'logo-icon.png',
  logoFull: 'logo-full.png',
};
