'use client';

import type { CSSProperties } from 'react';
import { useDistributeAnimation } from './useDistributeAnimation';

type Downstream = { id: string; label: string };

const DOWNSTREAM: readonly Downstream[] = [
  { id: 'dashboard', label: '§5 Dashboard' },
  { id: 'collective', label: '§1 Collective Brain' },
  { id: 'diagnostic', label: '§2 Diagnostic' },
  { id: 'recall', label: '§3 Meeting Recall' },
];

export function DistributeStrip() {
  const { state, status, statusLabel, push } = useDistributeAnimation();

  return (
    <div
      className="distribute-strip"
      data-state={state}
      data-status={status}
      data-testid="distribute-strip"
    >
      <button
        type="button"
        className="btn primary distribute-push"
        onClick={push}
        data-testid="distribute-push"
      >
        Push
      </button>
      <div className="distribute-lights">
        {DOWNSTREAM.map((d, idx) => (
          <div
            key={d.id}
            className="distribute-lights-cell"
            style={{ ['--idx' as string]: idx } as CSSProperties}
            data-testid={`distribute-light-${d.id}`}
          >
            <span className="distribute-light" />
            <span className="distribute-label">{d.label}</span>
          </div>
        ))}
      </div>
      <span
        className="distribute-status"
        data-testid="distribute-status"
      >
        {statusLabel}
      </span>
    </div>
  );
}
