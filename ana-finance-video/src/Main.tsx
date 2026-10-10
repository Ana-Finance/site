import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, interpolate, Series, staticFile } from 'remotion';
import { AUDIO, COLORS, SCENES, TOTAL_DURATION } from './config';
import { Benefits } from './scenes/Benefits';
import { Cta } from './scenes/Cta';
import { Demo } from './scenes/Demo';
import { Hook } from './scenes/Hook';
import { Problem } from './scenes/Problem';
import { Reveal } from './scenes/Reveal';

/** Vidéo complète : musique de fond + les 6 scènes enchaînées. */
export const Main: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
    {AUDIO.musicEnabled ? (
      <Audio
        name="♪ Musique"
        src={staticFile(AUDIO.music)}
        volume={(f) =>
          AUDIO.musicVolume *
          interpolate(
            f,
            [0, 6, TOTAL_DURATION - AUDIO.musicFadeOutFrames, TOTAL_DURATION],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          )
        }
      />
    ) : null}
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
