import React from 'react';
import {
  Img,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ASSETS, COLORS, TEXTS } from '../config';
import { alpha, CLAMP } from './utils';

/** Icône de l'app avec reflet lumineux qui balaie la surface. */
export const LogoIcon: React.FC<{
  size: number;
  shineAt?: number;
  glow?: number;
}> = ({ size, shineAt = 30, glow = 1 }) => {
  const frame = useCurrentFrame();
  const shine = interpolate(frame, [shineAt, shineAt + 26], [-130, 130], CLAMP);
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: size * 0.13,
        overflow: 'hidden',
        boxShadow: `0 ${size * 0.12}px ${size * 0.35}px ${alpha(COLORS.violet, 0.3 * glow)}, 0 0 ${size * 0.5}px ${alpha(COLORS.pink, 0.25 * glow)}`,
      }}
    >
      <Img
        src={staticFile(ASSETS.logoIcon)}
        style={{ width: size, height: size, display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
          transform: `translateX(${shine}%)`,
        }}
      />
    </div>
  );
};

/** Logotype « Ana Finance » lettre par lettre. */
export const Wordmark: React.FC<{
  fontSize: number;
  delay?: number;
  stagger?: number;
}> = ({ fontSize, delay = 0, stagger = 2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const first = TEXTS.reveal.brandFirst.split('');
  const second = TEXTS.reveal.brandSecond.split('');
  const letters = [
    ...first.map((ch) => ({ ch, color: COLORS.text })),
    { ch: '\u00A0', color: COLORS.text },
    ...second.map((ch, j) => ({
      ch,
      color: interpolateColors(
        j / Math.max(1, second.length - 1),
        [0, 1],
        [COLORS.violet, COLORS.pink],
      ),
    })),
  ];

  return (
    <div
      style={{
        display: 'flex',
        fontSize,
        fontWeight: 700,
        letterSpacing: '-0.045em',
        lineHeight: 1.1,
      }}
    >
      {letters.map((l, i) => {
        const p = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 200, mass: 0.7 },
        });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${(1 - p) * 0.5}em)`,
              filter: `blur(${(1 - p) * 12}px)`,
              color: l.color,
            }}
          >
            {l.ch}
          </span>
        );
      })}
    </div>
  );
};
