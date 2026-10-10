import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND_GRADIENT, SCENES, sceneStart, TEXTS } from '../config';
import { AnimatedWords } from '../components/AnimatedWords';
import { Cursor } from '../components/Cursor';
import { Scene } from '../components/Scene';
import { CLAMP } from '../components/utils';
import { AppWindow } from './demo/AppWindow';
import { Dashboard } from './demo/Dashboard';
import { BUTTON_POS, INPUT_POS, T } from './demo/layout';
import { TaskPanel } from './demo/TaskPanel';

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
          fontSize: 26,
          fontWeight: 700,
          transform: `scale(${pill})`,
          boxShadow: `0 0 30px rgba(165, 10, 255, 0.5)`,
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

/** Curseur animé dans le repère de la fenêtre. */
const DemoCursor: React.FC = () => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.45, 0, 0.2, 1);

  const toInput = interpolate(frame, [T.cursorIn, T.inputClick - 4], [0, 1], { ...CLAMP, easing: ease });
  const toButton = interpolate(frame, [T.toButton, T.buttonClick - 2], [0, 1], { ...CLAMP, easing: ease });
  const away = interpolate(frame, [T.buttonClick + 10, T.buttonClick + 28], [0, 1], { ...CLAMP, easing: ease });

  const startX = 1060;
  const startY = 720;
  const x =
    startX + (INPUT_POS.x - startX) * toInput + (BUTTON_POS.x - INPUT_POS.x) * toButton + 60 * away;
  const y =
    startY + (INPUT_POS.y - startY) * toInput + (BUTTON_POS.y - INPUT_POS.y) * toButton + 120 * away;

  const pressed =
    interpolate(frame, [T.inputClick, T.inputClick + 3, T.inputClick + 8], [0, 1, 0], CLAMP) +
    interpolate(frame, [T.buttonClick, T.buttonClick + 3, T.buttonClick + 8], [0, 1, 0], CLAMP);
  const opacity =
    interpolate(frame, [T.cursorIn, T.cursorIn + 8], [0, 1], CLAMP) *
    interpolate(frame, [T.buttonClick + 14, T.buttonClick + 28], [1, 0], CLAMP);

  return <Cursor x={x} y={y} pressed={pressed} opacity={opacity} />;
};

/** 4 · Démo (15-32 s) : maquette animée de l'interface. */
export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.demo;
  const c = TEXTS.demo.captions;

  const switchOut = spring({ frame: frame - T.dashboard, fps, config: { damping: 200 }, durationInFrames: 16 });

  return (
    <Scene duration={duration} offset={sceneStart('demo')}>
      <Sequence name="Légende 1" durationInFrames={T.captionSwitch1} layout="none">
        <Caption step={c[0].step} text={c[0].text} duration={T.captionSwitch1} />
      </Sequence>
      <Sequence
        name="Légende 2"
        from={T.captionSwitch1}
        durationInFrames={T.captionSwitch2 - T.captionSwitch1}
        layout="none"
      >
        <Caption step={c[1].step} text={c[1].text} duration={T.captionSwitch2 - T.captionSwitch1} />
      </Sequence>
      <Sequence name="Légende 3" from={T.captionSwitch2} layout="none">
        <Caption step={c[2].step} text={c[2].text} duration={duration - T.captionSwitch2} last />
      </Sequence>

      <AppWindow overlay={<DemoCursor />}>
        {frame < T.dashboard + 20 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 1 - switchOut,
              transform: `translateY(${switchOut * -50}px)`,
            }}
          >
            <TaskPanel />
          </div>
        ) : null}
        {frame >= T.dashboard ? <Dashboard start={T.dashboard + 6} /> : null}
      </AppWindow>

    </Scene>
  );
};
