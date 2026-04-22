'use client';

import { useEffect, useState } from 'react';
import { EVENTS, emit, listen } from '@/lib/events';
import type { ShellMode } from '@/lib/shell/types';

// The follow-coordinator owns the truth for shell mode and lives in the
// `main` window. The recall window listens for SHELL_MODE_CHANGED to stay
// in sync, and fires SHELL_REATTACH_REQUESTED cross-window to invoke the
// coordinator's reattach() — no new Tauri command or capability needed.

type UseShellMode = {
  mode: ShellMode;
  reattach: () => Promise<void>;
};

export function useShellMode(): UseShellMode {
  // Initial 'follow' matches coordinator boot; coordinator re-emits
  // SHELL_MODE_CHANGED on reattach() / meeting:start / detach, so
  // subscribers that arrive mid-session converge on the next transition.
  // Recall panel typically opens via meeting:start which forces 'follow'
  // reset.
  const [mode, setMode] = useState<ShellMode>('follow');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const fn = await listen(EVENTS.SHELL_MODE_CHANGED, (payload) => {
          if (cancelled) return;
          setMode(payload?.mode ?? 'follow');
        });
        if (cancelled) {
          fn();
          return;
        }
        unlisten = fn;
      } catch {
        // Non-Tauri / listen failed — stay on the initial 'follow' value.
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  async function reattach(): Promise<void> {
    try {
      await emit(EVENTS.SHELL_REATTACH_REQUESTED, {});
    } catch {
      // Non-Tauri: silently ignore. The button is only visible in
      // detached mode, which itself is only reachable inside Tauri.
    }
  }

  return { mode, reattach };
}
