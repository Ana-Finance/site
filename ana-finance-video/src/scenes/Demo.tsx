import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND_GRADIENT, COLORS, SCENES, sceneStart, TEXTS } from '../config';
import { AnimatedWords } from '../components/AnimatedWords';
import { LogoIcon } from '../components/Brand';
import { Icon } from '../components/Icon';
import { Scene } from '../components/Scene';
import { Sfx } from '../components/Sfx';
import { alpha, CLAMP, formatFr, gradientText } from '../components/utils';

// Chronologie de la démo (images locales à la scène).
const T = {
  userIn: 8,
  typeStart: 18,
  typeEnd: 80,
  sent: 86,
  agentIn: 98,
  stepStart: 150,
  stepEvery: 38,
  stepDuration: 28,
  done: 298,
  agents: 330,
};

const PHASE_COLORS: Record<string, string> = {
  Analyse: '#2563EB',
  Action: COLORS.violet,
  Validation: COLORS.success,
};

const Caption: React.FC<{ step: string; text: string; duration: number; last?: boolean }> = ({
  step,
  text,
  duration,
  last = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pill = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const out = last ? 0 : interpolate(frame, [duration - 8, duration], [0, 1], CLAMP);

  return (
    <AbsoluteFill
      style={{
        top: 62,
        height: 100,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        opacity: 1 - out,
        transform: `translateY(${out * -14}px)`,
      }}
    >
      <div
        style={{
          padding: '8px 18px',
          borderRadius: 999,
          background: BRAND_GRADIENT,
          color: 'white',
          fontSize: 26,
          fontWeight: 700,
          transform: `scale(${pill})`,
          boxShadow: `0 8px 24px ${alpha(COLORS.violet, 0.35)}`,
        }}
      >
        {step}
      </div>
      <AnimatedWords
        text={text}
        delay={3}
        stagger={3}
        style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.035em' }}
      />
    </AbsoluteFill>
  );
};

/** Indicateur d'étape : en cours (arc qui tourne) → validée (coche verte). */
const StepState: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const done = spring({ frame: frame - end, fps, config: { damping: 11, stiffness: 180 } });
  const glow = interpolate(frame, [end, end + 6, end + 26], [0, 1, 0], CLAMP);

  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, border: `3px solid ${alpha(COLORS.text, 0.08)}` }} />
      {frame < end ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            border: '3px solid transparent',
            borderTopColor: COLORS.violet,
            borderRightColor: COLORS.pink,
            transform: `rotate(${(frame - start) * 20}deg)`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 22,
          background: COLORS.success,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${done})`,
          boxShadow: `0 0 ${glow * 30}px ${glow * 8}px ${alpha(COLORS.success, 0.45)}`,
        }}
      >
        <Icon name="check" size={24} color="white" strokeWidth={3.4} />
      </div>
    </div>
  );
};

const bubble: React.CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  boxShadow: COLORS.shadow,
};

/** Phases 1 et 2 : la demande puis l'exécution de l'agent, en bulles. */
const Conversation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = TEXTS.demo;

  const user = spring({ frame: frame - T.userIn, fps, config: { damping: 15, stiffness: 140 } });
  const chars = Math.floor(interpolate(frame, [T.typeStart, T.typeEnd], [0, d.prompt.length], CLAMP));
  const caretOn = frame < T.sent && Math.floor(frame / 8) % 2 === 0;
  const sent = spring({ frame: frame - T.sent, fps, config: { damping: 200 } });

  const agent = spring({ frame: frame - T.agentIn, fps, config: { damping: 15, stiffness: 140 } });
  const thinking = frame >= T.agentIn && frame < T.stepStart;
  const allDone = frame >= T.done;
  const done = spring({ frame: frame - T.done, fps, config: { damping: 12, stiffness: 150 } });

  return (
    <div
      style={{
        position: 'absolute',
        left: 300,
        top: 235,
        width: 1320,
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      {/* Bulle utilisateur */}
      <div
        style={{
          alignSelf: 'flex-end',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
          opacity: Math.min(1, user * 1.5),
          transform: `translateY(${(1 - user) * 40}px) scale(${0.9 + user * 0.1})`,
          transformOrigin: '100% 100%',
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            padding: '26px 34px',
            borderRadius: '34px 34px 10px 34px',
            background: BRAND_GRADIENT,
            color: 'white',
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: '-0.015em',
            lineHeight: 1.3,
            boxShadow: `0 20px 50px ${alpha(COLORS.violet, 0.28)}`,
            minHeight: 44,
          }}
        >
          {d.prompt.slice(0, chars)}
          <span
            style={{
              display: 'inline-block',
              width: 3,
              height: 36,
              marginLeft: 3,
              verticalAlign: 'text-bottom',
              background: 'white',
              opacity: caretOn ? 1 : 0,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 20,
            fontWeight: 500,
            color: COLORS.textSubtle,
            opacity: sent,
          }}
        >
          {d.userLabel}
          <Icon name="checks" size={20} color={COLORS.violet} />
        </div>
      </div>

      {/* Bulles de l'agent */}
      <div
        style={{
          display: 'flex',
          gap: 22,
          opacity: Math.min(1, agent * 1.5),
          transform: `translateY(${(1 - agent) * 40}px)`,
        }}
      >
        <div style={{ transform: `scale(${agent})` }}>
          <LogoIcon size={68} shineAt={T.agentIn + 6} glow={0.6} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 68, fontSize: 24 }}>
            <span style={{ fontWeight: 700 }}>{d.agentLabel}</span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 999,
                background: allDone ? COLORS.successSoft : COLORS.violetSoft,
                color: allDone ? COLORS.success : COLORS.violet,
              }}
            >
              {allDone ? 'terminé' : 'en cours'}
            </span>
          </div>

          {thinking ? (
            <div
              style={{
                ...bubble,
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '22px 30px',
                borderRadius: '10px 30px 30px 30px',
                fontSize: 28,
                color: COLORS.textMuted,
              }}
            >
              <div style={{ display: 'flex', gap: 7 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 6,
                      background: COLORS.violet,
                      opacity: 0.35 + 0.65 * Math.max(0, Math.sin((frame - i * 4) / 4)),
                      transform: `translateY(${-Math.max(0, Math.sin((frame - i * 4) / 4)) * 6}px)`,
                    }}
                  />
                ))}
              </div>
              {d.thinking}
            </div>
          ) : null}

          {d.steps.map((step, i) => {
            const start = T.stepStart + i * T.stepEvery;
            const end = start + T.stepDuration;
            if (frame < start) return null;
            const pop = spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 160 } });
            const isDone = frame >= end;
            return (
              <div
                key={step.label}
                style={{
                  ...bubble,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '18px 30px 18px 20px',
                  borderRadius: i === 0 ? '10px 30px 30px 30px' : 30,
                  opacity: Math.min(1, pop * 1.6),
                  transform: `translateX(${(1 - pop) * -30}px) scale(${0.92 + pop * 0.08})`,
                  transformOrigin: '0% 50%',
                  borderColor: isDone ? alpha(COLORS.success, 0.25) : COLORS.border,
                }}
              >
                <StepState start={start} end={end} />
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '6px 12px',
                    borderRadius: 8,
                    color: PHASE_COLORS[step.phase] ?? COLORS.violet,
                    background: alpha(PHASE_COLORS[step.phase] ?? COLORS.violet, 0.1),
                  }}
                >
                  {step.phase}
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>{step.label}</div>
              </div>
            );
          })}

          {allDone ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '18px 30px',
                borderRadius: 30,
                background: COLORS.success,
                color: 'white',
                fontSize: 28,
                fontWeight: 700,
                boxShadow: `0 16px 40px ${alpha(COLORS.success, 0.3)}`,
                opacity: Math.min(1, done * 1.5),
                transform: `scale(${0.8 + done * 0.2})`,
                transformOrigin: '0% 50%',
              }}
            >
              <Icon name="circleCheck" size={30} color="white" strokeWidth={2.5} />
              {d.done}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

type Agent = (typeof TEXTS.demo.agents)[number];

const AGENT_W = 520;
const AGENT_GAP = 36;

/** Phase 3 : une bulle par métier, ses tâches automatisées et un indicateur qui monte. */
const AgentBubble: React.FC<{ agent: Agent; index: number }> = ({ agent, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const color = COLORS.persona[agent.persona] ?? COLORS.violet;
  const pop = spring({ frame: frame - index * 8, fps, config: { damping: 14, stiffness: 130 } });
  const count = spring({ frame: frame - 76 - index * 4, fps, config: { damping: 200 }, durationInFrames: 60 });
  const float = Math.sin((frame + index * 23) / 24) * 7;
  const live = 0.5 + 0.5 * Math.sin(frame / 5 + index);

  return (
    <div
      style={{
        ...bubble,
        position: 'absolute',
        left: (1920 - (3 * AGENT_W + 2 * AGENT_GAP)) / 2 + index * (AGENT_W + AGENT_GAP),
        top: 236,
        width: AGENT_W,
        padding: 36,
        borderRadius: 44,
        borderTop: `4px solid ${color}`,
        display: 'flex',
        flexDirection: 'column',
        opacity: Math.min(1, pop * 1.6),
        transform: `translateY(${float + (1 - pop) * 70}px) scale(${0.85 + pop * 0.15})`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 10px 24px ${alpha(color, 0.35)}`,
            flexShrink: 0,
          }}
        >
          <Icon name={agent.icon} size={28} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            {agent.name}
          </div>
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 17,
              fontWeight: 600,
              color: COLORS.success,
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                background: COLORS.success,
                boxShadow: `0 0 ${4 + live * 8}px ${COLORS.success}`,
              }}
            />
            en production
          </div>
        </div>
      </div>

      <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {agent.tasks.map((task, j) => {
          const appear = 14 + j * 18 + index * 4;
          const row = spring({ frame: frame - appear, fps, config: { damping: 200 } });
          return (
            <div
              key={task}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                height: 66,
                padding: '0 18px',
                borderRadius: 20,
                background: alpha(color, 0.06),
                opacity: row,
                transform: `translateX(${(1 - row) * -20}px)`,
              }}
            >
              <StepState start={appear} end={appear + 12} />
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>{task}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 26, paddingTop: 22, borderTop: `1px solid ${COLORS.border}` }}>
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            letterSpacing: '-0.045em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            ...gradientText,
          }}
        >
          {formatFr(agent.from + (agent.value - agent.from) * count, agent.decimals)}
          {agent.suffix}
        </div>
        <div style={{ marginTop: 8, fontSize: 22, fontWeight: 500, color: COLORS.textMuted }}>
          {agent.metricLabel}
        </div>
      </div>
    </div>
  );
};

/** 4 · Démo (15-32 s) : bulles qui illustrent le travail de l'agent. */
export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.demo;
  const c = TEXTS.demo.captions;
  const a = TEXTS.demo.agents;

  const convOut = spring({ frame: frame - T.agents, fps, config: { damping: 200 }, durationInFrames: 16 });

  return (
    <Scene duration={duration} offset={sceneStart('demo')}>
      <Sequence name="Légende 1" durationInFrames={140} layout="none">
        <Caption step={c[0].step} text={c[0].text} duration={140} />
      </Sequence>
      <Sequence name="Légende 2" from={140} durationInFrames={T.agents - 140} layout="none">
        <Caption step={c[1].step} text={c[1].text} duration={T.agents - 140} />
      </Sequence>
      <Sequence name="Légende 3" from={T.agents} layout="none">
        <Caption step={c[2].step} text={c[2].text} duration={duration - T.agents} last />
      </Sequence>

      {frame < T.agents + 18 ? (
        <AbsoluteFill
          style={{
            opacity: 1 - convOut,
            transform: `translateY(${convOut * -60}px) scale(${1 - convOut * 0.08})`,
            filter: `blur(${convOut * 12}px)`,
          }}
        >
          <Conversation />
        </AbsoluteFill>
      ) : null}

      <Sequence name="Agents par métier" from={T.agents + 8} layout="none">
        <AgentBubble agent={a[0]} index={0} />
        <AgentBubble agent={a[1]} index={1} />
        <AgentBubble agent={a[2]} index={2} />
      </Sequence>

      {/* Sons */}
      <Sfx src="pop.wav" from={0} volume={0.5} name="♪ Légende 1" />
      <Sfx src="pop.wav" from={T.userIn} volume={0.8} name="♪ Bulle demande" />
      <Sfx src="typing.wav" from={T.typeStart} volume={0.8} name="♪ Frappe" />
      <Sfx src="send.wav" from={T.sent} volume={0.8} name="♪ Envoi" />
      <Sfx src="pop-high.wav" from={T.agentIn} volume={0.7} name="♪ Bulle agent" />
      <Sfx src="pop.wav" from={140} volume={0.5} name="♪ Légende 2" />
      <Sfx src="pop.wav" from={T.stepStart} volume={0.6} name="♪ Étape 1" />
      <Sfx src="check-1.wav" from={T.stepStart + T.stepDuration} volume={0.9} name="♪ Coche 1" />
      <Sfx src="pop.wav" from={T.stepStart + T.stepEvery} volume={0.6} name="♪ Étape 2" />
      <Sfx src="check-2.wav" from={T.stepStart + T.stepEvery + T.stepDuration} volume={0.9} name="♪ Coche 2" />
      <Sfx src="pop.wav" from={T.stepStart + 2 * T.stepEvery} volume={0.6} name="♪ Étape 3" />
      <Sfx src="check-3.wav" from={T.stepStart + 2 * T.stepEvery + T.stepDuration} volume={0.9} name="♪ Coche 3" />
      <Sfx src="pop.wav" from={T.stepStart + 3 * T.stepEvery} volume={0.6} name="♪ Étape 4" />
      <Sfx src="check-4.wav" from={T.stepStart + 3 * T.stepEvery + T.stepDuration} volume={0.9} name="♪ Coche 4" />
      <Sfx src="success.wav" from={T.done} volume={0.7} name="♪ Terminé" />
      <Sfx src="whoosh.wav" from={T.agents - 2} volume={0.7} name="♪ Transition" />
      <Sfx src="pop.wav" from={T.agents} volume={0.5} name="♪ Légende 3" />
      <Sfx src="pop-high.wav" from={T.agents + 8} volume={0.6} name="♪ Agent Audit" />
      <Sfx src="pop-high.wav" from={T.agents + 16} volume={0.6} name="♪ Agent Comptable" />
      <Sfx src="pop-high.wav" from={T.agents + 24} volume={0.6} name="♪ Agent Contrôle" />
      <Sfx src="check-1.wav" from={T.agents + 8 + 26} volume={0.8} name="♪ Tâches ligne 1" />
      <Sfx src="check-2.wav" from={T.agents + 8 + 44} volume={0.8} name="♪ Tâches ligne 2" />
      <Sfx src="check-3.wav" from={T.agents + 8 + 62} volume={0.8} name="♪ Tâches ligne 3" />
      <Sfx src="counter.wav" from={T.agents + 8 + 76} volume={0.6} name="♪ Compteurs" />
      <Sfx src="whoosh.wav" from={duration - 16} volume={0.6} name="♪ Sortie" />
    </Scene>
  );
};
