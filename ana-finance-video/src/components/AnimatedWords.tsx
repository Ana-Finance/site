import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { frenchSpacing, gradientText } from './utils';

/** Texte qui apparaît mot par mot (spring + flou + montée). */
export const AnimatedWords: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  highlight?: string[];
  style?: React.CSSProperties;
}> = ({ text, delay = 0, stagger = 4, highlight = [], style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = frenchSpacing(text).split(' ');

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: '0.25em',
        ...style,
      }}
    >
      {words.map((word, i) => {
        const p = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 200, mass: 0.6 },
        });
        const isHighlighted = highlight.some(
          (h) => word.toLowerCase().indexOf(h.toLowerCase()) !== -1,
        );
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              paddingBottom: '0.08em',
              opacity: p,
              transform: `translateY(${(1 - p) * 0.45}em)`,
              filter: `blur(${(1 - p) * 10}px)`,
              ...(isHighlighted ? gradientText : {}),
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
