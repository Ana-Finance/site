import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND_GRADIENT, COLORS, SCENES, sceneStart, TEXTS } from '../config';
import { AnimatedWords } from '../components/AnimatedWords';
import { LogoIcon, Wordmark } from '../components/Brand';
import { Cursor } from '../components/Cursor';
import { Icon } from '../components/Icon';
import { Scene } from '../components/Scene';
import { alpha, CLAMP } from '../components/utils';

const CLICK = 92;

/** 6 · Appel à l'action (40-45 s) : logo, phrase finale, URL. */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.cta;
  const t = TEXTS.cta;

  const icon = spring({ frame, fps, config: { damping: 12, stiffness: 130 } });
  const button = spring({ frame: frame - 40, fps, config: { damping: 13, stiffness: 140 } });
  const url = spring({ frame: frame - 54, fps, config: { damping: 200 } });
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  const press = interpolate(frame, [CLICK, CLICK + 3, CLICK + 10], [0, 1, 0], CLAMP);
  const ripple = interpolate(frame, [CLICK, CLICK + 30], [0, 1], CLAMP);
  const arrow = interpolate(frame, [CLICK, CLICK + 6, CLICK + 16], [0, 10, 0], CLAMP);

  // Le curseur arrive sur le bouton puis clique.
  const move = interpolate(frame, [62, CLICK - 2], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.45, 0, 0.2, 1),
  });
  const cursorOpacity =
    interpolate(frame, [62, 70], [0, 1], CLAMP) * interpolate(frame, [CLICK + 24, CLICK + 36], [1, 0], CLAMP);

  return (
    <Scene duration={duration} offset={sceneStart('cta')} exit={0}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, transform: `scale(${0.8 + icon * 0.2})`, opacity: Math.min(1, icon * 1.6) }}>
          <LogoIcon size={110} shineAt={14} glow={0.8} />
          <Wordmark fontSize={84} delay={6} stagger={1} />
        </div>

        <AnimatedWords
          text={t.headline}
          delay={16}
          stagger={4}
          style={{
            marginTop: 70,
            maxWidth: 1500,
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '-0.045em',
            lineHeight: 1.05,
            textAlign: 'center',
          }}
        />

        <div
          style={{
            position: 'relative',
            marginTop: 66,
            transform: `scale(${button * (1 - press * 0.06)})`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              border: `3px solid ${COLORS.pink}`,
              transform: `scale(${1 + ripple * 0.35})`,
              opacity: ripple > 0 ? 1 - ripple : 0,
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '28px 56px',
              borderRadius: 999,
              background: BRAND_GRADIENT,
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              boxShadow: `0 0 ${40 + pulse * 40}px ${alpha(COLORS.violet, 0.7)}, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
          >
            {t.button}
            <Icon name="arrow" size={38} color="white" strokeWidth={2.5} style={{ transform: `translateX(${arrow}px)` }} />
          </div>
          <Cursor
            x={430 + (1 - move) * 260}
            y={70 + (1 - move) * 180}
            pressed={press}
            opacity={cursorOpacity}
            size={52}
          />
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: COLORS.mutedOnDark,
            opacity: url,
            transform: `translateY(${(1 - url) * 20}px)`,
          }}
        >
          {t.url}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
