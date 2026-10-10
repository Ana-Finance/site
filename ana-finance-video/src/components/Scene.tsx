import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { fontFamily } from '../fonts';
import { COLORS } from '../config';
import { Background } from './Background';
import { CLAMP } from './utils';

/**
 * Conteneur commun à chaque scène : fond animé + sortie rapide
 * (fondu, léger zoom et flou) sur les `exit` dernières images.
 */
export const Scene: React.FC<{
  duration: number;
  offset: number;
  exit?: number;
  children: React.ReactNode;
}> = ({ duration, offset, exit = 10, children }) => {
  const frame = useCurrentFrame();
  const out =
    exit > 0
      ? interpolate(frame, [duration - exit, duration], [0, 1], {
          ...CLAMP,
          easing: Easing.in(Easing.cubic),
        })
      : 0;

  return (
    <AbsoluteFill style={{ fontFamily, color: COLORS.text }}>
      <Background offset={offset} />
      <AbsoluteFill
        style={{
          opacity: 1 - out,
          transform: `scale(${1 + out * 0.06})`,
          filter: `blur(${out * 14}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
