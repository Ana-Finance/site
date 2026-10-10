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
import { Icon } from '../components/Icon';
import { Scene } from '../components/Scene';
import { Sfx } from '../components/Sfx';
import { alpha, CLAMP, formatFr, gradientText } from '../components/utils';

const SWITCH = 112; // image où les cartes laissent place au chiffre fort

const BenefitCard: React.FC<{
  index: number;
  icon: string;
  title: string;
  subtitle: string;
  stat: string;
}> = ({ index, icon, title, subtitle, stat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 10 - index * 7, fps, config: { damping: 15, stiffness: 120 } });
  const out = spring({ frame: frame - SWITCH - index * 4, fps, config: { damping: 200 }, durationInFrames: 18 });
  const sweep = interpolate(frame, [36 + index * 12, 70 + index * 12], [-100, 200], CLAMP);

  return (
    <div
      style={{
        position: 'relative',
        width: 540,
        height: 440,
        borderRadius: 32,
        padding: 42,
        overflow: 'hidden',
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        boxShadow: COLORS.shadow,
        display: 'flex',
        flexDirection: 'column',
        opacity: Math.min(1, p * 1.5) * (1 - out),
        transform: `perspective(1600px) translateY(${(1 - p) * 140 - out * 60}px) rotateX(${(1 - p) * 28}deg) scale(${1 - out * 0.08})`,
        filter: `blur(${out * 10}px)`,
      }}
    >
      {/* Reflet qui balaie la carte */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 220,
          left: `${sweep}%`,
          background: 'linear-gradient(100deg, transparent, rgba(255,131,251,0.16), transparent)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 44,
          right: 44,
          top: 0,
          height: 2,
          background: BRAND_GRADIENT,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: 22,
          background: BRAND_GRADIENT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 14px 30px ${alpha(COLORS.violet, 0.3)}`,
        }}
      >
        <Icon name={icon} size={42} color="white" />
      </div>
      <div style={{ marginTop: 40, fontSize: 39, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ marginTop: 14, fontSize: 26, color: COLORS.textMuted, lineHeight: 1.35 }}>
        {subtitle}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          alignSelf: 'flex-start',
          padding: '10px 20px',
          borderRadius: 999,
          border: `1px solid ${alpha(COLORS.violet, 0.2)}`,
          background: COLORS.violetSoft,
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        <span style={gradientText}>{stat}</span>
      </div>
    </div>
  );
};

/** 5 · Bénéfices (32-40 s) : 3 cartes animées puis le chiffre fort. */
export const Benefits: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.benefits;
  const b = TEXTS.benefits;

  const titleOut = interpolate(frame, [SWITCH - 4, SWITCH + 10], [0, 1], CLAMP);
  const big = spring({ frame: frame - SWITCH - 10, fps, config: { damping: 14, stiffness: 110 } });
  const count = spring({ frame: frame - SWITCH - 10, fps, config: { damping: 200 }, durationInFrames: 50 });
  const bar = spring({ frame: frame - SWITCH - 40, fps, config: { damping: 200 }, durationInFrames: 45 });

  return (
    <Scene duration={duration} offset={sceneStart('benefits')}>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 190 }}>
        <div style={{ opacity: 1 - titleOut, transform: `translateY(${titleOut * -30}px)` }}>
          <AnimatedWords
            text={b.title}
            stagger={3}
            style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.04em' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 36, marginTop: 80 }}>
          {b.cards.map((card, i) => (
            <BenefitCard key={card.title} index={i} {...card} />
          ))}
        </div>
      </AbsoluteFill>

      {frame >= SWITCH ? (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <div
            style={{
              position: 'absolute',
              width: 1100,
              height: 700,
              borderRadius: '50%',
              background: `radial-gradient(ellipse, ${alpha(COLORS.pink, 0.3)}, transparent 65%)`,
              opacity: Math.min(1, big),
            }}
          />
          <div
            style={{
              fontSize: 320,
              fontWeight: 800,
              letterSpacing: '-0.06em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              transform: `scale(${0.6 + big * 0.4})`,
              opacity: Math.min(1, big * 1.4),
              filter: `drop-shadow(0 20px 50px ${alpha(COLORS.violet, 0.3)})`,
              ...gradientText,
            }}
          >
            {formatFr(Math.round(b.bigNumber * count))}
            {b.bigSuffix}
          </div>
          <AnimatedWords
            text={b.bigText}
            delay={SWITCH + 22}
            stagger={3}
            style={{ marginTop: 20, fontSize: 58, fontWeight: 600, letterSpacing: '-0.035em' }}
          />
          <div
            style={{
              marginTop: 56,
              width: 1000,
              height: 16,
              borderRadius: 8,
              background: alpha(COLORS.text, 0.08),
              overflow: 'hidden',
              opacity: interpolate(frame, [SWITCH + 34, SWITCH + 42], [0, 1], CLAMP),
            }}
          >
            <div
              style={{
                width: `${bar * b.bigNumber}%`,
                height: '100%',
                borderRadius: 8,
                background: BRAND_GRADIENT,
                boxShadow: `0 0 18px ${alpha(COLORS.violet, 0.5)}`,
              }}
            />
          </div>
        </AbsoluteFill>
      ) : null}
      {/* Sons */}
      <Sfx src="whoosh-soft.wav" from={0} volume={0.6} />
      <Sfx src="pop.wav" from={12} volume={0.7} />
      <Sfx src="pop.wav" from={19} volume={0.7} />
      <Sfx src="pop.wav" from={26} volume={0.7} />
      <Sfx src="shine.wav" from={40} volume={0.45} />
      <Sfx src="whoosh.wav" from={SWITCH - 4} volume={0.8} />
      <Sfx src="impact.wav" from={SWITCH + 10} volume={0.55} />
      <Sfx src="counter.wav" from={SWITCH + 12} volume={0.6} />
      <Sfx src="shine.wav" from={SWITCH + 40} volume={0.5} />
      <Sfx src="whoosh.wav" from={duration - 16} volume={0.6} />
    </Scene>
  );
};
