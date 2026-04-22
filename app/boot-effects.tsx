'use client';

import { useEffect } from 'react';
import { EVENTS, listen } from '@/lib/events';
import {
  setActiveClientId,
  startBootHeartbeat,
  startKeepAliveHeartbeat,
  stopKeepAliveHeartbeat,
  warmAcmeContextOnce,
} from '@/lib/llm/heartbeat';
import { disposeAll, registerDisposable } from '@/lib/shell/cleanup';
import { startFollowCoordinator } from '@/lib/shell/follow-coordinator';
import { registerRecallShortcut, unregisterRecallShortcut } from '@/lib/shortcuts';
import { get, subscribe } from '@/lib/store';
import { getCurrentWindowLabel } from '@/lib/window';

// Side-effect host for app boot. Only fires inside the `main` Tauri
// window; the `recall` window should not duplicate heartbeats or own the
// global shortcut. Guarded by window label.
//
// Phase 2D: centralizes teardown through `disposeAll` so Rust-signalled
// quit (SHELL_APP_QUIT) and React unmount share one code path.

export function BootEffects() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isTauri =
      typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
    // N1: non-Tauri (e.g. plain `next dev`) gets a no-op cleanup; nothing
    // was started so nothing should be torn down.
    if (!isTauri) return () => {};

    let cancelled = false;

    const boot = async () => {
      const label = await getCurrentWindowLabel();
      if (cancelled) return;
      if (label !== 'main') return;

      const initialClient = await get('current_client');
      if (cancelled) return;
      setActiveClientId(initialClient);
      if (initialClient === 'acme') {
        void warmAcmeContextOnce();
      }

      const unsub = await subscribe('current_client', (next) => {
        setActiveClientId(next);
        if (next === 'acme') {
          void warmAcmeContextOnce();
        }
      });
      if (cancelled) {
        // Cleanup ran between awaits — unwind the just-acquired
        // subscription and stop before any side-effect registration.
        unsub();
        return;
      }
      registerDisposable(() => {
        unsub();
      });

      void startBootHeartbeat();
      startKeepAliveHeartbeat();
      registerDisposable(() => {
        stopKeepAliveHeartbeat();
      });

      void registerRecallShortcut();
      registerDisposable(() => unregisterRecallShortcut());

      // Phase 2D: start follow-coordinator. It owns its own event
      // wiring (main move/resize, meeting:start, and the cross-window
      // reattach-request bridge) — boot-effects just starts it and
      // registers the dispose hook.
      try {
        const coordinator = await startFollowCoordinator();
        if (cancelled) {
          void coordinator.dispose();
        } else {
          registerDisposable(() => coordinator.dispose());
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[boot-effects] follow-coordinator start failed', err);
      }

      // Rust quit → JS cleanup. Best-effort within the 100ms budget
      // (plan §4.5). If this listen fails, unmount cleanup still runs.
      try {
        const unlistenQuit = await listen(EVENTS.SHELL_APP_QUIT, () => {
          void disposeAll('app_quit');
        });
        registerDisposable(() => {
          unlistenQuit();
        });
      } catch {
        // non-Tauri or listen failed — unmount path still covers teardown
      }
    };

    void boot().catch((err) => {
      if (!cancelled) {
        // eslint-disable-next-line no-console
        console.warn('[boot-effects] failed', err);
      }
    });

    return () => {
      cancelled = true;
      void disposeAll('unmount');
    };
  }, []);

  return null;
}
