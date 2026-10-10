import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../config';
import { alpha } from './utils';

/**
 * Fond sombre animé : halos violet/rose qui dérivent lentement + grille fine.
 * `offset` = image de départ de la scène, pour un mouvement continu entre scènes.
 */
export const Background: React.FC<{ offset?: number }> = ({ offset = 0 }) => {
  const t = (useCurrentFrame() + offset) / 30;

  const x1 = 18 + Math.sin(t * 0.32) * 10;
  const y1 = 22 + Math.cos(t * 0.27) * 8;
  const x2 = 84 + Math.cos(t * 0.22) * 9;
  const y2 = 82 + Math.sin(t * 0.36) * 7;
  const x3 = 55 + Math.sin(t * 0.18) * 14;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(ellipse 55% 60% at ${x1}% ${y1}%, ${alpha(COLORS.violet, 0.34)} 0%, transparent 70%)`,
            `radial-gradient(ellipse 45% 50% at ${x2}% ${y2}%, ${alpha(COLORS.pink, 0.22)} 0%, transparent 70%)`,
            `radial-gradient(ellipse 40% 30% at ${x3}% 108%, ${alpha(COLORS.violet, 0.25)} 0%, transparent 70%)`,
          ].join(', '),
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          backgroundPosition: `${(t * 6) % 96}px ${(t * 6) % 96}px`,
          maskImage:
            'radial-gradient(ellipse 70% 65% at 50% 50%, black 0%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 65% at 50% 50%, black 0%, transparent 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.7) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
