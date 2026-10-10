import type React from 'react';
import { BRAND_GRADIENT } from '../config';

/** Convertit une couleur hex (#RRGGBB) en rgba avec opacité. */
export const alpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Format nombre à la française : 1 248 · 99,2 */
export const formatFr = (value: number, decimals = 0) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

/** Remplace les espaces avant ? ! : ; par des espaces insécables. */
export const frenchSpacing = (text: string) =>
  text.replace(/ ([?!:;»])/g, ' $1');

export const gradientText: React.CSSProperties = {
  backgroundImage: BRAND_GRADIENT,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

export const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;
