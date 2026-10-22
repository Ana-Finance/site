import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ASSETS, BRAND_GRADIENT, COLORS, SCENES, sceneStart, TEXTS } from '../config';
import { AnimatedWords } from '../components/AnimatedWords';
import { Cursor } from '../components/Cursor';
import { Icon } from '../components/Icon';
import { Scene } from '../components/Scene';
import { Sfx } from '../components/Sfx';
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
        <Img
          src={staticFile(ASSETS.logoFull)}
          style={{
            height: 150,
            transform: `scale(${0.75 + icon * 0.25}) translateY(${(1 - icon) * 30}px)`,
            opacity: Math.min(1, icon * 1.6),
            filter: `blur(${(1 - Math.min(1, icon)) * 12}px)`,
          }}
        />

        <AnimatedWords
          text={t.headline}
          delay={16}
          stagger={4}
          style={{
            marginTop: 60,
            maxWidth: 1250,
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
              color: 'white',
              boxShadow: `0 ${16 + pulse * 10}px ${36 + pulse * 30}px ${alpha(COLORS.violet, 0.35 + pulse * 0.15)}, inset 0 1px 0 rgba(255,255,255,0.35)`,
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
            color: COLORS.textMuted,
            opacity: url,
            transform: `translateY(${(1 - url) * 20}px)`,
          }}
        >
          {t.url}
        </div>
      </AbsoluteFill>
      {/* Sons */}
      <Sfx src="shine.wav" from={0} volume={0.7} />
      <Sfx src="pop.wav" from={2} volume={0.6} />
      <Sfx src="whoosh-soft.wav" from={16} volume={0.6} />
      <Sfx src="pop-high.wav" from={42} volume={0.7} />
      <Sfx src="pop.wav" from={56} volume={0.4} />
      <Sfx src="click.wav" from={CLICK} volume={1} />
      <Sfx src="success.wav" from={CLICK + 2} volume={0.7} />
    </Scene>
  );
};
