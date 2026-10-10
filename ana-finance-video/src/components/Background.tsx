import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../config';
import { alpha } from './utils';

/**
 * Fond clair animé : halos violet/rose très doux qui dérivent + grille fine.
 * `offset` = image de départ de la scène, pour un mouvement continu entre scènes.
 */
export const Background: React.FC<{ offset?: number }> = ({ offset = 0 }) => {
  const t = (useCurrentFrame() + offset) / 30;

  const x1 = 14 + Math.sin(t * 0.32) * 10;
  const y1 = 18 + Math.cos(t * 0.27) * 8;
  const x2 = 86 + Math.cos(t * 0.22) * 9;
  const y2 = 84 + Math.sin(t * 0.36) * 7;
  const x3 = 60 + Math.sin(t * 0.18) * 14;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(ellipse 50% 55% at ${x1}% ${y1}%, ${alpha(COLORS.violet, 0.14)} 0%, transparent 70%)`,
            `radial-gradient(ellipse 45% 50% at ${x2}% ${y2}%, ${alpha(COLORS.pink, 0.2)} 0%, transparent 70%)`,
            `radial-gradient(ellipse 40% 30% at ${x3}% -8%, ${alpha(COLORS.pink, 0.12)} 0%, transparent 70%)`,
          ].join(', '),
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(14,11,22,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(14,11,22,0.045) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          backgroundPosition: `${(t * 6) % 96}px ${(t * 6) % 96}px`,
          maskImage:
            'radial-gradient(ellipse 70% 65% at 50% 50%, black 0%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 65% at 50% 50%, black 0%, transparent 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
