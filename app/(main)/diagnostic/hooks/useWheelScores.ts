'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StrategyDimensionId, WheelScores } from '@/lib/override/dims';
import { DEFAULT_WHEEL_SCORES } from '@/lib/override/dims';
import { get, set, subscribe, type Unlisten, type WheelScore } from '@/lib/store';

// Bridge between `lib/store.ts wheel_scores` and the DiagnosticPage React
// state. SSR-safe: initial value is the frozen DEFAULT_WHEEL_SCORES so
// hydration doesn't flip. `useEffect` loads the actual persisted value
// and subscribes for cross-window updates.

type ScoreMap = Record<StrategyDimensionId, WheelScore>;

function clampToWheelScore(n: number): WheelScore {
  const r = Math.max(1, Math.min(7, Math.round(n)));
  return r as WheelScore;
}

function toFullMap(stored: WheelScores | Record<string, number> | undefined): ScoreMap {
  const base: ScoreMap = { ...DEFAULT_WHEEL_SCORES } as ScoreMap;
  if (!stored) return base;
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value === 'number') {
      (base as Record<string, WheelScore>)[key] = clampToWheelScore(value);
    }
  }
  return base;
}

export function useWheelScores() {
  const [scores, setScores] = useState<ScoreMap>({ ...DEFAULT_WHEEL_SCORES } as ScoreMap);
  // Ref mirrors state so async callbacks can compute the next store
  // payload without a stale closure.
  const scoresRef = useRef<ScoreMap>({ ...DEFAULT_WHEEL_SCORES } as ScoreMap);

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: Unlisten | null = null;

    (async () => {
      try {
        const stored = await get('wheel_scores');
        if (cancelled) return;
        if (!stored || Object.keys(stored).length === 0) {
          await set('wheel_scores', { ...DEFAULT_WHEEL_SCORES });
          const seeded = { ...DEFAULT_WHEEL_SCORES } as ScoreMap;
          scoresRef.current = seeded;
          setScores(seeded);
        } else {
          const next = toFullMap(stored);
          scoresRef.current = next;
          setScores(next);
        }

        unlisten = await subscribe('wheel_scores', (value) => {
          const next = toFullMap(value);
          scoresRef.current = next;
          setScores(next);
        });
      } catch {
        // Non-Tauri dev: fall back to in-memory defaults.
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const setScore = useCallback(async (dim: StrategyDimensionId, score: number) => {
    const clamped = clampToWheelScore(score);
    const next: ScoreMap = { ...scoresRef.current, [dim]: clamped };
    scoresRef.current = next;
    setScores(next);
    try {
      await set('wheel_scores', next);
    } catch {
      // Non-Tauri dev: no-op; React state already reflects the change.
    }
  }, []);

  return { scores, setScore };
}
