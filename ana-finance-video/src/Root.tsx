import React from 'react';
import { Composition, Folder } from 'remotion';
import { SCENES, TOTAL_DURATION, VIDEO } from './config';
import { Main } from './Main';
import { Benefits } from './scenes/Benefits';
import { Cta } from './scenes/Cta';
import { Demo } from './scenes/Demo';
import { Hook } from './scenes/Hook';
import { Problem } from './scenes/Problem';
import { Reveal } from './scenes/Reveal';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="AnaFinance"
      component={Main}
      durationInFrames={TOTAL_DURATION}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
    <Folder name="Scenes">
      <Composition id="S1-Accroche" component={Hook} durationInFrames={SCENES.hook} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="S2-Probleme" component={Problem} durationInFrames={SCENES.problem} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="S3-Revelation" component={Reveal} durationInFrames={SCENES.reveal} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="S4-Demo" component={Demo} durationInFrames={SCENES.demo} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="S5-Benefices" component={Benefits} durationInFrames={SCENES.benefits} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="S6-CTA" component={Cta} durationInFrames={SCENES.cta} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
    </Folder>
  </>
);
