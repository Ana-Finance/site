import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND_GRADIENT, COLORS, TEXTS } from '../../config';
import { Icon } from '../../components/Icon';
import { formatFr } from '../../components/utils';

const card: React.CSSProperties = {
  position: 'absolute',
  borderRadius: 20,
  background: COLORS.uiSurface,
  border: `1px solid ${COLORS.uiBorder}`,
  boxShadow: '0 10px 30px rgba(20, 20, 40, 0.06)',
};

/** Phase 2 : tableau de bord, indicateurs qui montent. `start` = image locale d'apparition. */
export const Dashboard: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame() - start;
  const { fps } = useVideoConfig();
  const d = TEXTS.demo;

  const enter = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 200 } });

  const head = enter(0);
  const band = enter(6);
  const chart = enter(14);
  const feed = enter(20);
  const livePulse = 0.5 + 0.5 * Math.sin(frame / 5);
  const max = Math.max(...d.chartValues);
  const plotH = 230;

  return (
    <>
      <div style={{ position: 'absolute', left: 40, top: 92, opacity: head, transform: `translateY(${(1 - head) * 16}px)` }}>
        <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em' }}>{d.dashTitle}</div>
        <div style={{ fontSize: 18, color: COLORS.uiMuted, marginTop: 6 }}>{d.dashSubtitle}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 40,
          top: 104,
          height: 40,
          padding: '0 16px',
          borderRadius: 999,
          background: 'rgba(34, 197, 94, 0.12)',
          color: '#15803D',
          fontSize: 16,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: head,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: COLORS.uiSuccess,
            boxShadow: `0 0 ${4 + livePulse * 10}px ${COLORS.uiSuccess}`,
          }}
        />
        En direct
      </div>

      {/* Bandeau KPI */}
      <div
        style={{
          ...card,
          left: 40,
          top: 196,
          width: 1280,
          height: 156,
          background: COLORS.uiKpiBand,
          display: 'flex',
          opacity: band,
          transform: `translateY(${(1 - band) * 24}px)`,
        }}
      >
        {d.kpis.map((kpi, i) => {
          const p = spring({
            frame: frame - 10 - i * 6,
            fps,
            config: { damping: 200 },
            durationInFrames: 70,
          });
          return (
            <div
              key={kpi.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: i === 0 ? 'none' : '1px solid rgba(76, 29, 149, 0.15)',
                margin: '26px 0',
              }}
            >
              <div
                style={{
                  fontSize: 54,
                  fontWeight: 700,
                  color: COLORS.uiKpi,
                  letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatFr(kpi.value * p, kpi.decimals)}
                {kpi.suffix}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.uiText }}>{kpi.label}</div>
              <div style={{ fontSize: 14, color: COLORS.uiMuted, marginTop: 4 }}>{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Graphique */}
      <div
        style={{
          ...card,
          left: 40,
          top: 374,
          width: 820,
          height: 380,
          opacity: chart,
          transform: `translateY(${(1 - chart) * 30}px)`,
        }}
      >
        <div style={{ position: 'absolute', left: 28, top: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="chart" size={20} color={COLORS.uiPrimary} />
          <div style={{ fontSize: 19, fontWeight: 700 }}>{d.chartTitle}</div>
        </div>
        {[0, 1, 2, 3].map((g) => (
          <div
            key={g}
            style={{
              position: 'absolute',
              left: 28,
              right: 28,
              top: 80 + (g * plotH) / 3,
              borderTop: `1px dashed ${COLORS.uiBorder}`,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: 40,
            right: 40,
            top: 80,
            height: plotH,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 18,
          }}
        >
          {d.chartValues.map((v, i) => {
            const p = spring({
              frame: frame - 18 - i * 3,
              fps,
              config: { damping: 15, stiffness: 120 },
            });
            const isLast = i === d.chartValues.length - 1;
            return (
              <div key={i} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: (v / max) * plotH * 0.92 * p,
                    borderRadius: '8px 8px 3px 3px',
                    background: isLast ? BRAND_GRADIENT : 'linear-gradient(180deg, #C4A5FF, #E9DDFF)',
                    boxShadow: isLast ? '0 10px 24px rgba(165, 10, 255, 0.35)' : 'none',
                  }}
                />
                {isLast ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: (v / max) * plotH * 0.92 * p + 12,
                      transform: `translateX(-50%) scale(${Math.min(1, Math.max(0, p))})`,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: COLORS.uiText,
                      color: 'white',
                      fontSize: 16,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatFr(v * Math.min(1, p))} h
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 40,
            right: 40,
            top: 80 + plotH + 14,
            display: 'flex',
            gap: 18,
            fontSize: 14,
            color: COLORS.uiMuted,
          }}
        >
          {d.chartMonths.map((m, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* Activité */}
      <div
        style={{
          ...card,
          left: 880,
          top: 374,
          width: 440,
          height: 380,
          opacity: feed,
          transform: `translateY(${(1 - feed) * 30}px)`,
        }}
      >
        <div style={{ position: 'absolute', left: 24, top: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="sparkles" size={20} color={COLORS.uiPrimary} />
          <div style={{ fontSize: 19, fontWeight: 700 }}>{d.activityTitle}</div>
        </div>
        {d.activities.map((a, i) => {
          const p = spring({ frame: frame - 26 - i * 7, fps, config: { damping: 200 } });
          return (
            <div
              key={a.text}
              style={{
                position: 'absolute',
                left: 24,
                right: 24,
                top: 80 + i * 72,
                height: 60,
                borderRadius: 14,
                background: COLORS.uiBg,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0 16px',
                opacity: p,
                transform: `translateX(${(1 - p) * 30}px)`,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="check" size={17} color="#16A34A" strokeWidth={3} />
              </div>
              <div style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{a.text}</div>
              <div style={{ fontSize: 13, color: COLORS.uiMuted }}>{a.time}</div>
            </div>
          );
        })}
      </div>
    </>
  );
};
