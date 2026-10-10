import React from 'react';
import { Audio } from '@remotion/media';
import { staticFile } from 'remotion';
import { AUDIO } from '../config';

/** Effet sonore placé à l'image `from` de la scène (fichier dans public/audio). */
export const Sfx: React.FC<{
  src: string;
  from: number;
  volume?: number;
  name?: string;
}> = ({ src, from, volume = 1, name }) => {
  if (!AUDIO.sfxEnabled) return null;
  return (
    <Audio
      name={name ?? `♪ ${src}`}
      src={staticFile(`audio/${src}`)}
      from={from}
      volume={volume * AUDIO.sfxVolume}
    />
  );
};
