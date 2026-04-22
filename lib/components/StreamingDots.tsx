'use client';

import type { CSSProperties } from 'react';

type Props = {
  count?: number;
  style?: CSSProperties;
};

export function StreamingDots({ count = 3, style }: Props) {
  return (
    <span className="streaming-dots" style={style} aria-label="loading">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  );
}
