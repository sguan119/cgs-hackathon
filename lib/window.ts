// Window orchestration helpers for the two-window shell.
//
// `repositionToMainRight()` pins the recall window 8px to the right of the
// main window's outer bounds with an 80px vertical breathing room (macOS
// traffic lights; harmless on Windows). Positioning uses physical pixels —
// `outerSize()` already returns physical on high-DPI displays so no scaling
// math is required here. Phase 2D adds `expectedRecallPosition()` for the
// follow-coordinator's drift detector and `getRecallOuterPosition()` to
// observe user-initiated drags.

import { getCurrentWindow, Window, PhysicalPosition } from '@tauri-apps/api/window';

const MAIN = 'main';
const RECALL = 'recall';
const GAP_X = 8;
const GAP_Y = 80;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export async function getMainWindow(): Promise<Window | null> {
  if (!isBrowser()) return null;
  try {
    return await Window.getByLabel(MAIN);
  } catch {
    return null;
  }
}

export async function getRecallWindow(): Promise<Window | null> {
  if (!isBrowser()) return null;
  try {
    return await Window.getByLabel(RECALL);
  } catch {
    return null;
  }
}

/**
 * Compute where the recall window *should* be placed when in follow mode,
 * based on the main window's current outer position + size. Returns null
 * when the main window isn't available. Pure read — no side effects.
 */
export async function expectedRecallPosition(): Promise<{ x: number; y: number } | null> {
  const mainWin = await getMainWindow();
  if (!mainWin) return null;
  try {
    const pos = await mainWin.outerPosition();
    const size = await mainWin.outerSize();
    return { x: pos.x + size.width + GAP_X, y: pos.y + GAP_Y };
  } catch {
    return null;
  }
}

/**
 * Read the recall window's current outer position (physical). Returns null
 * outside Tauri or when the window is missing.
 */
export async function getRecallOuterPosition(): Promise<{ x: number; y: number } | null> {
  const recallWin = await getRecallWindow();
  if (!recallWin) return null;
  try {
    const pos = await recallWin.outerPosition();
    return { x: pos.x, y: pos.y };
  } catch {
    return null;
  }
}

export async function repositionToMainRight(): Promise<void> {
  const recallWin = await getRecallWindow();
  if (!recallWin) return;
  const expected = await expectedRecallPosition();
  if (!expected) return;
  await recallWin.setPosition(new PhysicalPosition(expected.x, expected.y));
}

export async function getCurrentWindowLabel(): Promise<string | null> {
  if (!isBrowser()) return null;
  try {
    return getCurrentWindow().label;
  } catch {
    return null;
  }
}
