'use client';

import { useEffect, useRef, useState } from 'react';
import type { StrategyDimension } from '@/lib/override/dims';

export type ScoreEditorProps = {
  dim: StrategyDimension;
  currentScore: number | undefined;
  onCommit: (_score: number) => void;
  onCancel: () => void;
};

// Inline popover numeric editor. Accepts 1-7 integer; clamps outside
// range; Enter commits, Esc cancels, click-outside cancels (handled by
// DiagnosticPage owning the editingDim state).

export function ScoreEditor({ dim, currentScore, onCommit, onCancel }: ScoreEditorProps) {
  const [raw, setRaw] = useState<string>(
    typeof currentScore === 'number' ? String(currentScore) : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      onCancel();
      return;
    }
    const clamped = Math.max(1, Math.min(7, n));
    onCommit(clamped);
  };

  return (
    <div className="score-editor" role="dialog" aria-label={`Edit ${dim.short} score`}>
      <label className="score-editor-label" htmlFor={`score-${dim.id}`}>
        {dim.short}
      </label>
      <input
        ref={inputRef}
        id={`score-${dim.id}`}
        type="number"
        inputMode="numeric"
        min={1}
        max={7}
        step={1}
        value={raw}
        className="score-editor-input"
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="score-editor-hint">1–7 · Enter commits · Esc cancels</div>
    </div>
  );
}
