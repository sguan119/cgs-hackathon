'use client';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { EVENTS, listen } from '@/lib/events';
import { repositionToMainRight } from '@/lib/window';

export type LifecycleState = {
  isVisible: boolean;
  userDismissed: boolean;
  focusTick: number; // bumped whenever a cmd-K-while-visible fires
};

// Keep the simpler rule from plan §5.8: meeting:start always resets
// userDismissed + shows; user × sets dismissed + hides; cmd-K always shows
// + resets.

export function useRecallLifecycle() {
  const [state, setState] = useState<LifecycleState>({
    isVisible: false,
    userDismissed: false,
    focusTick: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    (async () => {
      try {
        const startFn = await listen(EVENTS.MEETING_START, async () => {
          if (cancelled) return;
          try {
            const win = getCurrentWindow();
            await win.show();
            await repositionToMainRight();
            if (!cancelled) setState((s) => ({ ...s, isVisible: true, userDismissed: false }));
          } catch (err) {
            console.error('[recall-panel lifecycle]', err);
          }
        });
        unlisteners.push(startFn);

        const endFn = await listen(EVENTS.MEETING_END, async () => {
          if (cancelled) return;
          try {
            const win = getCurrentWindow();
            await win.hide();
            if (!cancelled) setState((s) => ({ ...s, isVisible: false }));
          } catch (err) {
            console.error('[recall-panel lifecycle]', err);
          }
        });
        unlisteners.push(endFn);
      } catch {
        // Not in Tauri context — lifecycle is a no-op.
      }

      // Custom cmd-K routing: when visible, focus the textarea. When
      // hidden, show + focus chrome. Reviewer B2: the show/reposition
      // branch must check Tauri's real window state, not stale React
      // state — meeting:end can hide the window before the React render
      // syncs, leaving `state.isVisible === true` while the window is
      // actually hidden. React state is updated afterward to match.
      function onCmdK(): void {
        (async () => {
          let actuallyVisible = true;
          try {
            const win = getCurrentWindow();
            actuallyVisible = await win.isVisible();
            if (!actuallyVisible) {
              await win.show();
              await repositionToMainRight();
            }
          } catch {
            // No-op outside Tauri — assume visible so we still bump focus.
          }
          setState((s) => ({
            ...s,
            isVisible: true,
            userDismissed: actuallyVisible ? s.userDismissed : false,
            focusTick: s.focusTick + 1,
          }));
          // Signal QueryInput to grab focus.
          window.postMessage('focus-query-input', '*');
        })();
      }
      window.addEventListener('recall:cmd-k', onCmdK);
      unlisteners.push(() => window.removeEventListener('recall:cmd-k', onCmdK));
    })();

    return () => {
      cancelled = true;
      for (const fn of unlisteners) fn();
    };
  }, []);

  async function close(): Promise<void> {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch {
      // Non-Tauri: just flip the flag.
    }
    setState((s) => ({ ...s, isVisible: false, userDismissed: true }));
  }

  return { state, close };
}
