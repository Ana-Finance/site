import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, SCENES, sceneStart, TEXTS } from '../config';
import { AnimatedWords } from '../components/AnimatedWords';
import { Icon } from '../components/Icon';
import { Scene } from '../components/Scene';
import { Sfx } from '../components/Sfx';
import { alpha, CLAMP, formatFr } from '../components/utils';

const CARD_W = 1000;

const TaskCard: React.FC<{
  index: number;
  tag: string;
  label: string;
  meta: string;
  count: number;
  icon: string;
}> = ({ index, tag, label, meta, count, icon }) => {
  const tagColor = COLORS.persona[tag] ?? COLORS.violet;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = 14 + index * 14;

  const drop = spring({
    frame: frame - start,
    fps,
    config: { damping: 13, stiffness: 140, mass: 0.9 },
  });
  const counter = interpolate(frame, [start + 6, 150], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  // Feuilles « empilées » qui apparaissent derrière la carte.
  const pile1 = spring({ frame: frame - 70 - index * 6, fps, config: { damping: 15 } });
  const pile2 = spring({ frame: frame - 92 - index * 6, fps, config: { damping: 15 } });
  const badgePulse = 0.5 + 0.5 * Math.sin((frame - index * 7) / 3.5);

  const sheet = (p: number, depth: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    borderRadius: 26,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
    boxShadow: '0 10px 30px rgba(88, 28, 135, 0.06)',
    opacity: p * (0.75 - depth * 0.25),
    transform: `translateY(${p * depth * 14}px) scale(${1 - depth * 0.035}) rotate(${(index % 2 === 0 ? 1 : -1) * depth * p * 0.8}deg)`,
  });

  return (
    <div
      style={{
        position: 'relative',
        width: CARD_W,
        height: 112,
        opacity: Math.min(1, drop * 1.6),
        transform: `translateY(${(1 - drop) * -320}px) rotate(${(1 - drop) * (index % 2 === 0 ? -6 : 6)}deg)`,
      }}
    >
      <div style={sheet(pile2, 2)} />
      <div style={sheet(pile1, 1)} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          padding: '0 36px',
          borderRadius: 26,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          boxShadow: COLORS.shadow,
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.violetSoft,
            border: `1px solid ${alpha(COLORS.violet, 0.2)}`,
          }}
        >
          <Icon name={icon} size={34} color={COLORS.violet} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '3px 10px',
                borderRadius: 6,
                color: tagColor,
                background: alpha(tagColor, 0.1),
              }}
            >
              {tag}
            </span>
            <span style={{ fontSize: 21, color: COLORS.textSubtle }}>{meta}</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 20px',
            borderRadius: 999,
            background: alpha(COLORS.danger, 0.08 + badgePulse * 0.06),
            border: `1px solid ${alpha(COLORS.danger, 0.3)}`,
            color: COLORS.danger,
            fontSize: 36,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Icon name="alert" size={26} color={COLORS.danger} />
          {formatFr(Math.round(count * counter))}
        </div>
      </div>
    </div>
  );
};

/** 2 · Problème (4-10 s) : trois tâches répétitives s'empilent et saturent. */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SCENES.problem;

  const load = interpolate(frame, [50, 150], [0.12, 1], {
    ...CLAMP,
    easing: Easing.inOut(Easing.cubic),
  });
  const meterColor = interpolateColors(load, [0, 0.6, 0.9], [COLORS.violet, COLORS.pink, COLORS.danger]);
  const shakeAmp = interpolate(frame, [140, 152, 172], [0, 9, 0], CLAMP);
  const shake = Math.sin(frame * 2.3) * shakeAmp;
  const meterIn = interpolate(frame, [40, 56], [0, 1], CLAMP);

  return (
    <Scene duration={duration} offset={sceneStart('problem')}>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          paddingTop: 120,
          transform: `translateX(${shake}px)`,
        }}
      >
        <AnimatedWords
          text={TEXTS.problem.title}
          delay={0}
          stagger={3}
          style={{ fontSize: 82, fontWeight: 700, letterSpacing: '-0.04em' }}
        />

        <div
          style={{
            marginTop: 54,
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {TEXTS.problem.tasks.map((t, i) => (
            <TaskCard key={t.label} index={i} {...t} />
          ))}
        </div>

        <div style={{ width: CARD_W, marginTop: 48, opacity: meterIn }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 26,
              fontWeight: 500,
              color: COLORS.textMuted,
              marginBottom: 14,
            }}
          >
            <span>{TEXTS.problem.meterLabel}</span>
            <span style={{ color: meterColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(load * 100)} %
            </span>
          </div>
          <div
            style={{
              height: 14,
              borderRadius: 7,
              background: alpha(COLORS.text, 0.08),
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${load * 100}%`,
                height: '100%',
                borderRadius: 7,
                background: `linear-gradient(90deg, ${COLORS.violet}, ${meterColor})`,
                boxShadow: `0 0 18px ${meterColor}`,
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
      {/* Sons */}
      <Sfx src="whoosh.wav" from={0} volume={0.7} />
      <Sfx src="drop.wav" from={18} volume={0.6} />
      <Sfx src="drop.wav" from={32} volume={0.55} />
      <Sfx src="drop.wav" from={46} volume={0.5} />
      <Sfx src="drop.wav" from={60} volume={0.45} />
      <Sfx src="counter.wav" from={22} volume={0.6} />
      <Sfx src="riser.wav" from={132} volume={0.9} />
      <Sfx src="alert.wav" from={138} volume={0.8} />
    </Scene>
  );
};
