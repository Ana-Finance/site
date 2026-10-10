// Géométrie de la maquette (en px, repère = fenêtre de l'app).
export const WIN = { w: 1640, h: 830, left: 140, top: 206 };
export const TITLE_BAR = 46;
export const SIDEBAR = 280;
export const MAIN = { x: SIDEBAR, y: TITLE_BAR, w: WIN.w - SIDEBAR, h: WIN.h - TITLE_BAR };

// Chronologie de la démo (images locales à la scène).
export const T = {
  cursorIn: 14,
  inputClick: 34,
  typeStart: 40,
  typeEnd: 104,
  toButton: 108,
  buttonClick: 124,
  panelIn: 130,
  stepStart: 148,
  stepEvery: 38,
  stepDuration: 28,
  toast: 294,
  dashboard: 336,
  captionSwitch1: 140,
  captionSwitch2: 330,
};

// Positions clés du curseur (repère fenêtre).
export const INPUT_POS = { x: 1140, y: 402 };
export const BUTTON_POS = { x: MAIN.x + 1222, y: MAIN.y + 349 };
