import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { COLORS, SCENES } from './config';
import { Benefits } from './scenes/Benefits';
import { Cta } from './scenes/Cta';
import { Demo } from './scenes/Demo';
import { Hook } from './scenes/Hook';
import { Problem } from './scenes/Problem';
import { Reveal } from './scenes/Reveal';

/** Vidéo complète : les 6 scènes enchaînées. */
export const Main: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
    <Series>
      <Series.Sequence name="1 · Accroche" durationInFrames={SCENES.hook}>
        <Hook />
      </Series.Sequence>
      <Series.Sequence name="2 · Problème" durationInFrames={SCENES.problem}>
        <Problem />
      </Series.Sequence>
      <Series.Sequence name="3 · Révélation" durationInFrames={SCENES.reveal}>
        <Reveal />
      </Series.Sequence>
      <Series.Sequence name="4 · Démo" durationInFrames={SCENES.demo}>
        <Demo />
      </Series.Sequence>
      <Series.Sequence name="5 · Bénéfices" durationInFrames={SCENES.benefits}>
        <Benefits />
      </Series.Sequence>
      <Series.Sequence name="6 · Appel à l'action" durationInFrames={SCENES.cta}>
        <Cta />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
