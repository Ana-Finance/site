import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ASSETS, COLORS, TEXTS } from '../../config';
import { Icon } from '../../components/Icon';
import { CLAMP } from '../../components/utils';
import { MAIN, SIDEBAR, T, TITLE_BAR, WIN } from './layout';

const NAV_ICONS = ['dashboard', 'line', 'card', 'circleCheck', 'sparkles'];
const NAV_TOP = 196;
const NAV_STEP = 56;

const TrafficLights: React.FC = () => (
  <div style={{ display: 'flex', gap: 9, position: 'absolute', left: 20, top: 16 }}>
    {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
      <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
    ))}
  </div>
);

const Sidebar: React.FC<{ activeIndex: number; highlightTop: number }> = ({
  activeIndex,
  highlightTop,
}) => {
  const d = TEXTS.demo;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: TITLE_BAR,
        width: SIDEBAR,
        bottom: 0,
        background: COLORS.uiSurface,
        borderRight: `1px solid ${COLORS.uiBorder}`,
      }}
    >
      <div style={{ position: 'absolute', left: 24, top: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Img src={staticFile(ASSETS.logoIcon)} style={{ width: 38, height: 38, borderRadius: 9 }} />
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>
          <span style={{ color: COLORS.uiText }}>Ana </span>
          <span style={{ color: COLORS.uiPrimary, fontWeight: 600 }}>finance</span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: 88,
          height: 70,
          borderRadius: 14,
          background: COLORS.uiBg,
          border: `1px solid ${COLORS.uiBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 14px',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: COLORS.uiPrimary,
            color: 'white',
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {d.org.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.uiText, whiteSpace: 'nowrap' }}>{d.org.name}</div>
          <div style={{ fontSize: 13, color: COLORS.uiMuted }}>{d.org.sub}</div>
        </div>
        <Icon name="chevrons" size={16} color={COLORS.uiMuted} />
      </div>

      {/* Surbrillance animée de l'élément actif */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: highlightTop,
          height: 50,
          borderRadius: 12,
          background: `linear-gradient(100deg, ${COLORS.uiPrimary}, ${COLORS.violet})`,
          boxShadow: `0 8px 20px rgba(154, 18, 245, 0.35)`,
        }}
      />
      {d.nav.map((label, i) => (
        <div
          key={label}
          style={{
            position: 'absolute',
            left: 28,
            top: NAV_TOP + i * NAV_STEP,
            height: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 18,
            fontWeight: i === activeIndex ? 600 : 500,
            color: i === activeIndex ? 'white' : COLORS.uiText,
          }}
        >
          <Icon name={NAV_ICONS[i]} size={21} color={i === activeIndex ? 'white' : COLORS.uiText} />
          {label}
        </div>
      ))}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 84,
          borderTop: `1px solid ${COLORS.uiBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 20px',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: '#6D28D9',
            color: 'white',
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {d.user.initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.uiText }}>{d.user.name}</div>
          <div style={{ fontSize: 13, color: COLORS.uiMuted }}>{d.user.role}</div>
        </div>
        <Icon name="settings" size={20} color={COLORS.uiMuted} />
      </div>
    </div>
  );
};

const Header: React.FC<{ page: string }> = ({ page }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: 66,
      borderBottom: `1px solid ${COLORS.uiBorder}`,
      background: 'rgba(255,255,255,0.6)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 40px',
      gap: 14,
      fontSize: 18,
    }}
  >
    <span style={{ color: COLORS.uiMuted }}>{TEXTS.demo.org.name}</span>
    <span style={{ color: COLORS.uiMuted }}>›</span>
    <span style={{ color: COLORS.uiText, fontWeight: 600 }}>{page}</span>
    <div style={{ flex: 1 }} />
    <div
      style={{
        width: 260,
        height: 40,
        borderRadius: 12,
        border: `1px solid ${COLORS.uiBorder}`,
        background: COLORS.uiSurface,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        color: COLORS.uiMuted,
        fontSize: 16,
      }}
    >
      <Icon name="search" size={17} color={COLORS.uiMuted} />
      Rechercher
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 12, border: `1px solid ${COLORS.uiBorder}`, borderRadius: 6, padding: '2px 6px' }}>⌘K</span>
    </div>
    <div
      style={{
        height: 40,
        borderRadius: 999,
        border: `1px solid ${COLORS.uiBorder}`,
        background: COLORS.uiSurface,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        color: COLORS.uiText,
        fontSize: 16,
        fontWeight: 600,
      }}
    >
      <Icon name="sparkles" size={17} color={COLORS.uiPrimary} />
      11 760 <span style={{ color: COLORS.uiMuted, fontWeight: 500 }}>crédits</span>
    </div>
    <Icon name="moon" size={21} color={COLORS.uiText} />
    <Icon name="bell" size={21} color={COLORS.uiText} />
  </div>
);

/**
 * Fenêtre type macOS contenant l'application Ana Finance.
 * `children` est rendu dans la zone principale (repère MAIN).
 */
export const AppWindow: React.FC<{ children: React.ReactNode; overlay?: React.ReactNode }> = ({
  children,
  overlay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.9 } });

  const navSwitch = spring({ frame: frame - T.dashboard, fps, config: { damping: 18, stiffness: 160 } });
  const highlightTop = interpolate(navSwitch, [0, 1], [196 + 4 * 56, 196], {
    extrapolateLeft: 'clamp',
  });
  const activeIndex = frame >= T.dashboard + 4 ? 0 : 4;
  const page = frame >= T.dashboard + 4 ? TEXTS.demo.dashTitle : TEXTS.demo.pageTitle;

  return (
    <div
      style={{
        position: 'absolute',
        left: WIN.left,
        top: WIN.top,
        width: WIN.w,
        height: WIN.h,
        perspective: 2400,
      }}
    >
      {/* Halo derrière la fenêtre */}
      <div
        style={{
          position: 'absolute',
          inset: -60,
          borderRadius: 80,
          background: `radial-gradient(ellipse at 50% 60%, rgba(165,10,255,0.45), transparent 70%)`,
          filter: 'blur(40px)',
          opacity: interpolate(enter, [0, 1], [0, 1], CLAMP),
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 22,
          overflow: 'hidden',
          background: COLORS.uiBg,
          color: COLORS.uiText,
          boxShadow:
            '0 60px 140px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.14)',
          opacity: Math.min(1, enter * 1.5),
          transform: `translateY(${(1 - enter) * 140}px) scale(${0.92 + enter * 0.08}) rotateX(${(1 - enter) * 16}deg)`,
          transformOrigin: '50% 100%',
        }}
      >
        {/* Barre de titre */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: TITLE_BAR,
            background: COLORS.uiTitleBar,
            borderBottom: `1px solid ${COLORS.uiBorder}`,
          }}
        >
          <TrafficLights />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 8,
              transform: 'translateX(-50%)',
              height: 30,
              width: 420,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              color: COLORS.uiMuted,
            }}
          >
            <Icon name="lock" size={13} color={COLORS.uiMuted} />
            {TEXTS.demo.windowUrl}
          </div>
        </div>

        <Sidebar activeIndex={activeIndex} highlightTop={highlightTop} />

        <div
          style={{
            position: 'absolute',
            left: MAIN.x,
            top: MAIN.y,
            width: MAIN.w,
            height: MAIN.h,
            overflow: 'hidden',
          }}
        >
          <Header page={page} />
          {children}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: Math.min(1, enter * 1.5),
          transform: `translateY(${(1 - enter) * 140}px) scale(${0.92 + enter * 0.08})`,
          transformOrigin: '50% 100%',
        }}
      >
        {overlay}
      </div>
    </div>
  );
};
