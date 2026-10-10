import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND_GRADIENT, COLORS, TEXTS } from '../../config';
import { Icon } from '../../components/Icon';
import { CLAMP } from '../../components/utils';
import { T } from './layout';

const CHIP_DOTS = [BRAND_GRADIENT, COLORS.uiSuccess, COLORS.uiPrimary, COLORS.uiWarning, COLORS.uiInfo];

const card: React.CSSProperties = {
  position: 'absolute',
  left: 40,
  width: 1280,
  borderRadius: 20,
  background: COLORS.uiSurface,
  border: `1px solid ${COLORS.uiBorder}`,
  boxShadow: '0 10px 30px rgba(20, 20, 40, 0.06)',
};

/** Indicateur d'étape : en attente → en cours (arc qui tourne) → validée (coche verte). */
const StepState: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const done = spring({ frame: frame - end, fps, config: { damping: 11, stiffness: 180 } });
  const active = frame >= start && frame < end;
  const glow = interpolate(frame, [end, end + 6, end + 24], [0, 1, 0], CLAMP);

  return (
    <div style={{ position: 'relative', width: 32, height: 32 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          border: `2px solid ${COLORS.uiBorder}`,
        }}
      />
      {active ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16,
            border: '3px solid transparent',
            borderTopColor: COLORS.uiPrimary,
            borderRightColor: COLORS.uiPrimary,
            transform: `rotate(${(frame - start) * 22}deg)`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          background: COLORS.uiSuccess,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${done})`,
          boxShadow: `0 0 ${glow * 26}px ${glow * 6}px rgba(34, 197, 94, 0.55)`,
        }}
      >
        <Icon name="check" size={19} color="white" strokeWidth={3.2} />
      </div>
    </div>
  );
};

/** Phase 1 : saisie de la demande + exécution de l'agent. */
export const TaskPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = TEXTS.demo;

  const head = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const composer = spring({ frame: frame - 12, fps, config: { damping: 200 } });

  const chars = Math.floor(
    interpolate(frame, [T.typeStart, T.typeEnd], [0, d.prompt.length], CLAMP),
  );
  const typed = d.prompt.slice(0, chars);
  const focused = frame >= T.inputClick;
  const caretOn = focused && frame < T.buttonClick && Math.floor(frame / 8) % 2 === 0;
  const ready = interpolate(frame, [T.typeEnd - 6, T.typeEnd], [0, 1], CLAMP);
  const press = interpolate(frame, [T.buttonClick, T.buttonClick + 3, T.buttonClick + 9], [0, 1, 0], CLAMP);
  const ripple = interpolate(frame, [T.buttonClick, T.buttonClick + 22], [0, 1], CLAMP);

  const panel = spring({ frame: frame - T.panelIn, fps, config: { damping: 200 } });
  const stepsDone = d.steps.filter((_, i) => frame >= T.stepStart + i * T.stepEvery + T.stepDuration).length;
  const progress = interpolate(
    frame,
    [T.stepStart, T.stepStart + (d.steps.length - 1) * T.stepEvery + T.stepDuration],
    [0, 1],
    CLAMP,
  );
  const allDone = stepsDone === d.steps.length;
  const toast = spring({ frame: frame - T.toast, fps, config: { damping: 16, stiffness: 140 } });

  return (
    <>
      <div style={{ position: 'absolute', left: 40, top: 92, opacity: head, transform: `translateY(${(1 - head) * 16}px)` }}>
        <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em' }}>{d.pageTitle}</div>
        <div style={{ fontSize: 18, color: COLORS.uiMuted, marginTop: 6 }}>{d.pageSubtitle}</div>
      </div>

      {/* Composeur de tâche */}
      <div
        style={{
          ...card,
          top: 196,
          height: 204,
          opacity: composer,
          transform: `translateY(${(1 - composer) * 24}px)`,
        }}
      >
        <div style={{ position: 'absolute', left: 24, top: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7C3AED, #3B82F6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="sparkles" size={19} color="white" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{d.composerTitle}</div>
        </div>

        <div style={{ position: 'absolute', left: 24, top: 72, display: 'flex', gap: 10 }}>
          {d.chips.map((chip, i) => (
            <div
              key={chip}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 15,
                fontWeight: 600,
                background: i === 0 ? COLORS.uiText : COLORS.uiBg,
                color: i === 0 ? 'white' : COLORS.uiText,
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 5, background: CHIP_DOTS[i] }} />
              {chip}
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 124,
            width: 1232,
            height: 58,
            borderRadius: 14,
            border: `1.5px solid ${focused ? COLORS.uiPrimary : COLORS.uiBorder}`,
            boxShadow: focused ? '0 0 0 4px rgba(154, 18, 245, 0.12)' : 'none',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            fontSize: 20,
            color: typed ? COLORS.uiText : COLORS.uiMuted,
          }}
        >
          {typed || '« Catégorise les transactions de juin »'}
          <div
            style={{
              width: 2,
              height: 26,
              marginLeft: 2,
              background: COLORS.uiPrimary,
              opacity: caretOn ? 1 : 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 8,
              top: 8,
              width: 132,
              height: 42,
              borderRadius: 10,
              background: '#C7D2FE',
              color: 'white',
              fontSize: 18,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transform: `scale(${1 - press * 0.07})`,
              boxShadow: ready > 0.5 ? '0 8px 20px rgba(165, 10, 255, 0.35)' : 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 10,
                background: BRAND_GRADIENT,
                opacity: ready,
              }}
            />
            <Icon name="play" size={15} color="white" style={{ position: 'relative' }} />
            <span style={{ position: 'relative' }}>{d.button}</span>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 10,
                border: `2px solid ${COLORS.violet}`,
                transform: `scale(${1 + ripple * 0.5})`,
                opacity: ripple > 0 ? 1 - ripple : 0,
              }}
            />
          </div>
        </div>
      </div>

      {/* Exécution de l'agent */}
      <div
        style={{
          ...card,
          top: 424,
          height: 330,
          opacity: panel,
          transform: `translateY(${(1 - panel) * 40}px) scale(${0.97 + panel * 0.03})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            top: 20,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: allDone ? COLORS.uiSuccess : COLORS.uiPrimary,
              boxShadow: `0 0 10px ${allDone ? COLORS.uiSuccess : COLORS.uiPrimary}`,
            }}
          />
          <div style={{ fontSize: 19, fontWeight: 700 }}>{allDone ? d.runDone : d.runTitle}</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 16, color: COLORS.uiMuted, fontVariantNumeric: 'tabular-nums' }}>
            {stepsDone}/{d.steps.length}
          </div>
          <div style={{ width: 240, height: 8, borderRadius: 4, background: COLORS.uiBg, overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress * 100}%`,
                height: '100%',
                borderRadius: 4,
                background: allDone ? COLORS.uiSuccess : BRAND_GRADIENT,
              }}
            />
          </div>
        </div>

        {d.steps.map((step, i) => {
          const start = T.stepStart + i * T.stepEvery;
          const end = start + T.stepDuration;
          const rowIn = spring({ frame: frame - (start - 10), fps, config: { damping: 200 } });
          const isDone = frame >= end;
          return (
            <div
              key={step.label}
              style={{
                position: 'absolute',
                left: 24,
                right: 24,
                top: 76 + i * 60,
                height: 60,
                borderTop: `1px solid ${COLORS.uiBorder}`,
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                opacity: 0.35 + rowIn * 0.65,
                transform: `translateX(${(1 - rowIn) * 16}px)`,
              }}
            >
              <StepState start={start} end={end} />
              <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.uiText }}>{step.label}</div>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: isDone ? 'rgba(34, 197, 94, 0.12)' : COLORS.uiBg,
                  color: isDone ? '#15803D' : COLORS.uiMuted,
                }}
              >
                {step.detail}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notification de fin */}
      <div
        style={{
          position: 'absolute',
          right: 40,
          top: 86,
          height: 60,
          padding: '0 22px',
          borderRadius: 16,
          background: COLORS.uiText,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 18,
          fontWeight: 600,
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          opacity: Math.min(1, toast * 1.5),
          transform: `translateX(${(1 - toast) * 120}px)`,
        }}
      >
        <Icon name="circleCheck" size={24} color={COLORS.uiSuccess} />
        {d.toast}
      </div>
    </>
  );
};
