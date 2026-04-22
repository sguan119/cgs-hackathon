// Global-shortcut wiring for cmd-K / Ctrl-K "summon recall".
//
// Phase 2A change (plan §5.8): instead of calling `recall.setFocus()`
// unconditionally (which would pull focus off any textarea inside the
// recall webview), we fire a DOM CustomEvent `recall:cmd-k` that the
// panel's lifecycle hook listens for. The hook decides whether to show
// the window or just focus the query textarea. This lets the user use
// cmd-K to jump BACK into the textarea without losing the next keystroke
// to the OS shortcut handler.

import { register, unregister, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { getRecallWindow, repositionToMainRight } from './window';

const ACCELERATOR = 'CommandOrControl+K';
const SUMMON_EVENT = 'recall:cmd-k';

let registered = false;

async function onSummon(): Promise<void> {
  try {
    const recall = await getRecallWindow();
    if (!recall) return;
    const wasVisible = await recall.isVisible();
    if (!wasVisible) {
      await recall.show();
      await repositionToMainRight();
    }
    // Broadcast the intent so the recall webview can decide whether to
    // focus chrome or forward to the textarea. The recall page listens
    // via window.addEventListener('recall:cmd-k', …).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SUMMON_EVENT));
    }
    if (!wasVisible) {
      await recall.setFocus();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[shortcut] summon failed', err);
  }
}

export async function registerRecallShortcut(): Promise<void> {
  if (registered) return;
  if (typeof window === 'undefined') return;
  const handler = (event: { state: string }): void => {
    if (event.state === 'Pressed') void onSummon();
  };
  try {
    await register(ACCELERATOR, handler);
    registered = true;
  } catch (err) {
    // Phase 2D R7: a hard crash on a previous run can leak the OS
    // binding, which Tauri's plugin rejects as "already registered".
    // Recover by clearing all bindings owned by this app, then retry
    // once. A second failure is permanent for this session — we log
    // and move on rather than spin.
    try {
      await unregisterAll();
      await register(ACCELERATOR, handler);
      registered = true;
    } catch (retryErr) {
      // eslint-disable-next-line no-console
      console.warn('[shortcut] register failed', err, 'retry failed', retryErr);
    }
  }
}

export async function unregisterRecallShortcut(): Promise<void> {
  if (!registered) return;
  try {
    await unregister(ACCELERATOR);
  } catch {
    await unregisterAll();
  } finally {
    registered = false;
  }
}
