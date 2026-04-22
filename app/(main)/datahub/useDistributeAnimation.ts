'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Phase 4.4 §6 step 6 — "Distributing…" for 1600 ms, then "Connected · 4 sources".
// Caller reads `state` (feeds the CSS strip's data-state attribute) and
// `statusLabel` (drives the strip status text).

export type DistributeState = 'dim' | 'active';
export type DistributeStatus = 'idle' | 'distributing' | 'connected';

const CONNECT_DELAY_MS = 1600;

export type DistributeAnimation = {
  state: DistributeState;
  status: DistributeStatus;
  statusLabel: string;
  push: () => void;
};

function labelFor(status: DistributeStatus): string {
  if (status === 'distributing') return 'Distributing…';
  if (status === 'connected') return 'Connected · 4 sources';
  return 'Idle';
}

export function useDistributeAnimation(): DistributeAnimation {
  const [state, setState] = useState<DistributeState>('dim');
  const [status, setStatus] = useState<DistributeStatus>('idle');
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (rafRef.current !== null) {
      if (
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const push = useCallback(() => {
    clearPending();
    // Flip to dim/idle first so the CSS keyframe sequence re-runs on repeat
    // presses — next paint flips to active + distributing.
    setState('dim');
    setStatus('distributing');

    const schedule =
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
        ? (cb: FrameRequestCallback) => window.requestAnimationFrame(cb)
        : (cb: FrameRequestCallback) =>
            setTimeout(() => cb(0), 16) as unknown as number;

    rafRef.current = schedule(() => {
      rafRef.current = null;
      setState('active');
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setStatus('connected');
      }, CONNECT_DELAY_MS);
    }) as number;
  }, [clearPending]);

  useEffect(() => {
    return () => {
      clearPending();
    };
  }, [clearPending]);

  return { state, status, statusLabel: labelFor(status), push };
}
