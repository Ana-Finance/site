import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, SCENES, sceneStart, TEXTS } from '../config';
import { AnimatedWords } from '../components/AnimatedWords';
import { LogoIcon, Wordmark } from '../components/Brand';
import { Scene } from '../components/Scene';
import { Sfx } from '../components/Sfx';
import { alpha, CLAMP } from '../components/utils';

/** 3 · Révélation (10-15 s) : logo + nom + promesse. */
export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.reveal;

  const burst = interpolate(frame, [0, 34], [0, 1], CLAMP);
  const icon = spring({ frame: frame - 3, fps, config: { damping: 11, stiffness: 120 } });
  const lift = spring({ frame: frame - 26, fps, config: { damping: 200 } });
  const float = Math.sin(frame / 18) * 6;

  const ring = (delay: number) => {
    const p = interpolate(frame, [delay, delay + 45], [0, 1], CLAMP);
    return {
      position: 'absolute' as const,
      width: 260,
      height: 260,
      borderRadius: '50%',
      border: `2px solid ${alpha(COLORS.violet, 0.35)}`,
      transform: `scale(${1 + p * 2.6})`,
      opacity: (1 - p) * 0.8,
    };
  };

  return (
    <Scene duration={duration} offset={sceneStart('reveal')}>
      {/* Flash lumineux */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(COLORS.pink, 0.45)} 0%, ${alpha(COLORS.violet, 0.2)} 35%, transparent 70%)`,
            transform: `scale(${0.2 + burst * 2.2})`,
            opacity: 1 - burst,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          transform: `translateY(${(1 - lift) * 150}px)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 54,
          }}
        >
          <div style={ring(8)} />
          <div style={ring(20)} />
          <div
            style={{
              transform: `translateY(${float}px) scale(${icon}) rotate(${(1 - icon) * -25}deg)`,
              opacity: Math.min(1, icon * 2),
            }}
          >
            <LogoIcon size={240} shineAt={34} />
          </div>
        </div>

        <Wordmark fontSize={156} delay={30} stagger={2} />

        <AnimatedWords
          text={TEXTS.reveal.promise}
          delay={58}
          stagger={3}
          style={{
            marginTop: 30,
            fontSize: 50,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: COLORS.textMuted,
          }}
        />
      </AbsoluteFill>
      {/* Sons */}
      <Sfx src="impact.wav" from={0} volume={0.5} />
      <Sfx src="whoosh-soft.wav" from={28} volume={0.6} />
      <Sfx src="shine.wav" from={32} volume={0.8} />
      <Sfx src="pop.wav" from={58} volume={0.5} />
      <Sfx src="whoosh.wav" from={duration - 16} volume={0.6} />
    </Scene>
  );
};
