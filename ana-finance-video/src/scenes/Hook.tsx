import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND_GRADIENT, COLORS, SCENES, sceneStart, TEXTS } from '../config';
import { AnimatedWords } from '../components/AnimatedWords';
import { Scene } from '../components/Scene';
import { Sfx } from '../components/Sfx';
import { CLAMP, alpha } from '../components/utils';

/** 1 · Accroche (0-4 s) : une question choc. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.hook;

  const pill = spring({ frame, fps, config: { damping: 200 } });
  const push = interpolate(frame, [0, duration], [1, 1.06]);
  const bar = spring({ frame: frame - 38, fps, config: { damping: 200, mass: 1.2 } });
  const dotPulse = 0.5 + 0.5 * Math.sin(frame / 4);

  return (
    <Scene duration={duration} offset={sceneStart('hook')}>
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 56,
          transform: `scale(${push})`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 28px',
            borderRadius: 999,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            boxShadow: COLORS.shadow,
            fontSize: 26,
            fontWeight: 500,
            color: COLORS.textMuted,
            opacity: pill,
            transform: `translateY(${(1 - pill) * 20}px)`,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: COLORS.pink,
              boxShadow: `0 0 ${8 + dotPulse * 10}px ${COLORS.pink}`,
            }}
          />
          {TEXTS.hook.eyebrow}
        </div>

        <AnimatedWords
          text={TEXTS.hook.question}
          highlight={TEXTS.hook.highlight}
          delay={6}
          stagger={4}
          style={{
            maxWidth: 1700,
            fontSize: 106,
            fontWeight: 700,
            letterSpacing: '-0.045em',
            lineHeight: 1.04,
            textAlign: 'center',
          }}
        />

        <div
          style={{
            width: 560,
            height: 4,
            borderRadius: 2,
            background: alpha(COLORS.text, 0.08),
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${interpolate(bar, [0, 1], [0, 100], CLAMP)}%`,
              height: '100%',
              background: BRAND_GRADIENT,
              boxShadow: `0 0 16px ${alpha(COLORS.violet, 0.5)}`,
            }}
          />
        </div>
      </AbsoluteFill>
      {/* Sons */}
      <Sfx src="pop-high.wav" from={0} volume={0.6} />
      <Sfx src="whoosh-soft.wav" from={4} volume={0.7} />
      <Sfx src="shine.wav" from={38} volume={0.5} />
      <Sfx src="whoosh.wav" from={duration - 16} volume={0.6} />
    </Scene>
  );
};
