import React from 'react';

/** Pointeur type macOS. `pressed` réduit légèrement le curseur (clic). */
export const Cursor: React.FC<{
  x: number;
  y: number;
  opacity?: number;
  pressed?: number;
  size?: number;
}> = ({ x, y, opacity = 1, pressed = 0, size = 44 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{
      position: 'absolute',
      left: x - size * 0.22,
      top: y - size * 0.12,
      opacity,
      transform: `scale(${1 - pressed * 0.18})`,
      transformOrigin: '22% 12%',
      filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))',
      zIndex: 50,
    }}
  >
    <path
      d="M5.3 2.8v17.6l4.7-4.5 3 6.9 2.8-1.2-3-6.8h6.6z"
      fill="#111"
      stroke="#fff"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </svg>
);
