'use client';

import { useCallback } from 'react';
import type { StrategyDimension } from '@/lib/override/dims';

export type WheelSectorProps = {
  dim: StrategyDimension;
  score: number | undefined;
  editing: boolean;
  outerPath: string;
  fillPath: string;
  fillColor: string;
  abbrPos: { x: number; y: number };
  labelPos: { x: number; y: number };
  labelText: string;
  onActivate: () => void;
  onStep: (_delta: 1 | -1) => void;
};

// Single wheel wedge. Exposes a keyboard-reachable focus target by wrapping
// the svg paths in a `<g role="spinbutton">` with tabIndex={0}. ↑/↓ commit
// a one-step score change directly (fast-path per plan §6.9), Enter opens
// the inline editor (parent wires this via `onActivate`), Esc is a no-op.

export function WheelSector({
  dim,
  score,
  editing,
  outerPath,
  fillPath,
  fillColor,
  abbrPos,
  labelPos,
  labelText,
  onActivate,
  onStep,
}: WheelSectorProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onStep(1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onStep(-1);
      }
    },
    [onActivate, onStep]
  );

  const scoreText = typeof score === 'number' ? String(score) : '—';

  return (
    <g
      role="spinbutton"
      tabIndex={0}
      aria-label={`${dim.short} score`}
      aria-valuemin={1}
      aria-valuemax={7}
      aria-valuenow={typeof score === 'number' ? score : undefined}
      aria-valuetext={`${dim.short}: ${scoreText}`}
      className={`wheel-sector${editing ? ' is-editing' : ''}`}
      data-dim-id={dim.id}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      <path
        d={outerPath}
        fill="var(--bone)"
        stroke="var(--rule)"
        strokeWidth={0.5}
        className="wheel-sector-outer"
      />
      <path
        d={fillPath}
        fill={fillColor}
        opacity={editing ? 0.45 : 0.88}
        className="wheel-sector-fill"
      />
      {editing ? (
        <path
          d={outerPath}
          fill="none"
          stroke="var(--crimson)"
          strokeWidth={2}
          strokeDasharray="4 3"
          className="wheel-sector-editing-ring"
        />
      ) : null}
      <text
        x={abbrPos.x}
        y={abbrPos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--mono)"
        fontSize={10}
        fill="var(--paper)"
        fontWeight={500}
        letterSpacing="0.05em"
        pointerEvents="none"
      >
        {dim.abbr}
      </text>
      <text
        x={labelPos.x}
        y={labelPos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--sans)"
        fontSize={11}
        fill="var(--charcoal)"
        fontWeight={500}
        pointerEvents="none"
      >
        {labelText}
      </text>
    </g>
  );
}
