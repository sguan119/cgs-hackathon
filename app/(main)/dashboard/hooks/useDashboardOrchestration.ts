'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RELOAD_TIMELINE,
  type DashboardPanelId,
} from '@/lib/dashboard/dashboard-timeline';

export type OrchestrationState = {
  visible: ReadonlySet<DashboardPanelId>;
  elapsedMs: number;
};

// Phase 4.1 §5 — drive the six-panel fade-in + top-right ms clock.
// Uses setTimeout for reveals and requestAnimationFrame for the clock so the
// timer stays GPU-synced; cleanup cancels everything on unmount.
export function useDashboardOrchestration(): OrchestrationState {
  const [visible, setVisible] = useState<ReadonlySet<DashboardPanelId>>(
    () => new Set<DashboardPanelId>()
  );
  const [elapsedMs, setElapsedMs] = useState(0);

  const timerHandles = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const startRef = useRef<number>(0);
  const rafHandle = useRef<number | null>(null);

  useEffect(() => {
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    startRef.current = now;
    setVisible(new Set<DashboardPanelId>());
    setElapsedMs(0);

    for (const slot of RELOAD_TIMELINE) {
      const h = setTimeout(() => {
        setVisible((prev) => {
          if (prev.has(slot.panel)) return prev;
          const next = new Set(prev);
          next.add(slot.panel);
          return next;
        });
      }, slot.delay);
      timerHandles.current.add(h);
    }

    const hasRaf =
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function';

    let tickHandle: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      const t =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      setElapsedMs(t - startRef.current);
      if (hasRaf) {
        rafHandle.current = window.requestAnimationFrame(tick);
      } else {
        // Fallback path for exotic jsdom runners that lack rAF — a 16 ms
        // setTimeout keeps tests deterministic.
        tickHandle = setTimeout(tick, 16);
      }
    };

    if (hasRaf) {
      rafHandle.current = window.requestAnimationFrame(tick);
    } else {
      tickHandle = setTimeout(tick, 16);
    }

    return () => {
      for (const h of timerHandles.current) clearTimeout(h);
      timerHandles.current.clear();
      if (rafHandle.current !== null) {
        if (typeof window !== 'undefined') {
          window.cancelAnimationFrame(rafHandle.current);
        }
        rafHandle.current = null;
      }
      if (tickHandle !== null) {
        clearTimeout(tickHandle);
        tickHandle = null;
      }
    };
  }, []);

  return { visible, elapsedMs };
}

export function formatElapsedMs(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalMs = Math.floor(clamped);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const mmm = millis.toString().padStart(3, '0');
  return `${mm}:${ss}.${mmm}`;
}
