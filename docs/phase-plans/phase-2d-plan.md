# Phase 2D Implementation Plan — Tauri Shell Finalization

## 1. Overview

Phase 2D is the fourth "real" implementation from tech-design §1.1 — **infrastructure polish**, not a demo surface. Phases 1 + 2A already stood up the two-window shell (`main` + `recall`), the `meeting:start` / `meeting:end` lifecycle, `repositionToMainRight()`, cmd-K summoning, and the always-on-top frameless recall panel. What is still missing is the **live coupling** that makes the panel feel like a native floating companion: when the VP drags the main window across the monitor mid-demo the recall panel must track it in real time; when the VP deliberately tears the recall panel off to the side it must stop tracking (instead of fighting the user) and expose a visible "Reattach" affordance; when the VP hits minimize on the main chrome the recall panel must survive (it is the Fellow's workspace, not a child of the main workbench); and when the app quits for any reason the global shortcut + event listeners must release cleanly so a restart never inherits a dangling OS binding. Phase 2D makes those four contracts rock-solid without touching any demo surface. No regressions to the 410 existing tests, no new npm deps, no Playwright coverage (Tauri shell is outside the Playwright target per Phase 1 §7 and Phase 2A §7) — just Rust-side window event wiring, a TypeScript follow-coordinator state machine, a small React hook + reattach button, and a centralized cleanup path.

---

## 2. Directory deltas

```
src-tauri/
  src/
    lib.rs                                # MODIFIED: add on_window_event handler for main (move/resize emit) + app quit hook
    main.rs                               # unchanged
  capabilities/
    main.json                             # unchanged (no new permissions needed; emit goes through existing event scope)
    recall.json                           # unchanged (listen goes through existing event scope)
lib/
  window.ts                               # MODIFIED: expose `expectedRecallPosition()` + `getRecallOuterPosition()` for drift detection
  events.ts                               # MODIFIED: add SHELL_MAIN_MOVED / SHELL_MAIN_RESIZED / SHELL_APP_QUIT event names + payload types
  shell/
    follow-coordinator.ts                 # NEW: owns follow/detached state machine; debounces move/resize; detects drag drift
    follow-coordinator.test.ts            # NEW: unit tests — debounce, drift threshold, state transitions, idempotent dispose
    cleanup.ts                            # NEW: centralized teardown (shortcut unregister, event unlisten, coordinator dispose)
    cleanup.test.ts                       # NEW: unit tests — idempotency, exception safety
    types.ts                              # NEW: ShellMode + coordinator event types
app/
  (floating)/
    recall-panel/
      RecallChrome.tsx                    # MODIFIED: render <ReattachButton/> when shell.mode === 'detached'
      ReattachButton.tsx                  # NEW: small button; calls coordinator.reattach()
      hooks/
        useShellMode.ts                   # NEW: subscribes to coordinator; exposes { mode, reattach }
  boot-effects.tsx                        # MODIFIED: on main window — start follow-coordinator; register cleanup on unmount
docs/
  phase-plans/
    phase-2d-plan.md                      # NEW: this file
```

No new npm deps. No new Tauri capability permissions (all required scopes — `core:event:default`, `core:window:allow-outer-position`, `core:window:allow-outer-size`, `core:window:allow-set-position`, `global-shortcut:allow-unregister-all` — already present from Phase 1 §3.6).

---

## 3. Data shapes

### 3.1 `ShellMode` — follow/detach state

```ts
// lib/shell/types.ts

/**
 * Positioning contract between main and recall windows.
 * - 'follow'   : recall tracks main on move/resize via repositionToMainRight()
 * - 'detached' : user has manually dragged recall; coordinator stops repositioning
 *                until the user clicks "Reattach" or a fresh meeting:start fires.
 */
export type ShellMode = 'follow' | 'detached';

export type MainMovePayload = {
  x: number;          // outer physical x
  y: number;          // outer physical y
};

export type MainResizePayload = {
  width: number;      // outer physical width
  height: number;     // outer physical height
};

export type FollowCoordinatorState = {
  mode: ShellMode;
  /** monotonically increasing; bumped on every mode transition (for React re-renders) */
  rev: number;
  /** timestamp (ms) of the last programmatic reposition — used by drift detector */
  lastProgrammaticRepositionAt: number | null;
  /** expected recall outer position after the last reposition (for drift comparison) */
  lastExpectedPosition: { x: number; y: number } | null;
};

export type FollowCoordinatorHandle = {
  getState(): FollowCoordinatorState;
  subscribe(cb: (_s: FollowCoordinatorState) => void): () => void;
  reattach(): Promise<void>;
  dispose(): Promise<void>;
};
```

### 3.2 `SessionStore` — NO new key

Deliberate non-decision. `ShellMode` is **not** persisted to `lib/store.ts`.

- Rationale: the follow/detach state is ephemeral UI state bound to a single Tauri session. Persisting it would introduce a footgun on restart (user's detached layout from last demo carries over into a fresh cold-boot where window bounds no longer exist). `SessionStore` is for cross-window demo state (meeting phase, wheel scores, client id); shell geometry is not.
- Consequence: the follow-coordinator is an **in-process singleton** in the `main` window. The `recall` window reads its mode via a Tauri event (see §3.3), not via `lib/store.ts` `subscribe`. This keeps the store schema unchanged and keeps Phase 1 exit-gate type-level tests passing untouched.

### 3.3 New event names

Add to `lib/events.ts` — single source of truth extension:

```ts
export const EVENTS = {
  // ...existing...
  SHELL_MAIN_MOVED: 'shell:main_moved',           // payload: MainMovePayload
  SHELL_MAIN_RESIZED: 'shell:main_resized',       // payload: MainResizePayload
  SHELL_MODE_CHANGED: 'shell:mode_changed',       // payload: { mode: ShellMode }
  SHELL_APP_QUIT: 'shell:app_quit',               // payload: {} — Rust → JS before exit
} as const;
```

- `SHELL_MAIN_MOVED` / `SHELL_MAIN_RESIZED`: emitted from Rust `on_window_event` for `label === "main"`. Debounced **on the Rust side** at 16ms (60Hz) by dropping intermediate deltas via a `std::time::Instant` guard — a single last-write-wins emit per tick. See §4.6.
- `SHELL_MODE_CHANGED`: emitted from the coordinator (main window JS) whenever mode flips. The recall window listens and drives `useShellMode` → conditional render of `<ReattachButton/>`.
- `SHELL_APP_QUIT`: emitted from Rust `on_window_event` `CloseRequested` on the main window (and `WindowEvent::Destroyed` as backup) just before the app starts its teardown. JS-side cleanup subscribes and runs `disposeAll()` synchronously (capped timeout, see §4.5 correctness).

---

## 4. Module design

### 4.1 `lib/window.ts` — extensions

Add two exports without touching existing ones:

```ts
/**
 * Compute where the recall window *should* be placed when in follow mode,
 * based on the main window's current outer position + size. Returns null
 * when either window isn't available. Pure read — no side effects.
 */
export async function expectedRecallPosition(): Promise<{ x: number; y: number } | null>;

/**
 * Read the recall window's current outer position (physical). Returns null
 * outside Tauri or when the window is missing.
 */
export async function getRecallOuterPosition(): Promise<{ x: number; y: number } | null>;
```

- `expectedRecallPosition()` factors out the math currently inlined in `repositionToMainRight()` so the drift detector can reuse it. `repositionToMainRight()` is refactored to call `expectedRecallPosition()` + `setPosition(...)`; no behavior change.
- `getRecallOuterPosition()` wraps `recallWin.outerPosition()` with the same browser/Tauri guards as `getRecallWindow()`.
- Constants `GAP_X = 8` / `GAP_Y = 80` stay where they are. The header comment's Phase 2D TODO ("revisit if manual-drag reattach lands") gets resolved by this phase — update the comment to note the current drift-based detector.

### 4.2 `lib/shell/follow-coordinator.ts` — new

Owns the follow/detach state machine. One active instance per main-window boot. Public API:

```ts
export type StartOptions = {
  /** Optional debounce window for batching move/resize reposition calls. Default: 16ms. */
  repositionDebounceMs?: number;
  /** Drift threshold (physical px) beyond which a recall-position delta is read as "user drag". Default: 30. */
  driftThresholdPx?: number;
  /** Drift inspection window (ms) after the last programmatic reposition. Default: 200. */
  driftWindowMs?: number;
};

export async function startFollowCoordinator(opts?: StartOptions): Promise<FollowCoordinatorHandle>;
```

#### Internal state machine

```
                 ┌───────────────────────────────────────────┐
                 │              follow (initial)             │
                 └───────┬────────────────────┬──────────────┘
                         │                    │
      main moved/resized │                    │ drift detected
      → reposition()     │                    │ (after programmatic
      → stay in follow   │                    │  reposition, recall
                         │                    │  moved > 30px)
                         ▼                    ▼
                ┌─────────────────┐   ┌──────────────────────┐
                │ reposition loop │   │      detached        │
                └─────────────────┘   └──────┬───────────────┘
                                             │
                                   reattach()│
                                   or meeting:start
                                             ▼
                                        back to follow
```

#### Behaviour details

1. **Mount (in main window, after BootEffects boot path):**
   - Call `listen(EVENTS.SHELL_MAIN_MOVED, onMainMove)`.
   - Call `listen(EVENTS.SHELL_MAIN_RESIZED, onMainResize)`.
   - Call `listen(EVENTS.MEETING_START, onMeetingStart)` — force `mode = 'follow'` and trigger a fresh reposition (so a new meeting reattaches automatically, matching §5.3's "Reattach" UX expectation that a new meeting = clean slate).
   - Emit initial `SHELL_MODE_CHANGED { mode: 'follow' }` so the recall window's `useShellMode` hook hydrates correctly even if it subscribed before the coordinator started (replayed by `subscribe()` return of current state).

2. **`onMainMove` / `onMainResize` (debounced 16ms via `requestAnimationFrame`-style trailing timer):**
   - If `mode === 'detached'`: no-op (drop event).
   - Else: read `expected = expectedRecallPosition()`. If non-null:
     - Call `repositionToMainRight()`.
     - Store `lastProgrammaticRepositionAt = performance.now()` + `lastExpectedPosition = expected`.
     - Schedule a `setTimeout(driftWindowMs, inspectDrift)`. Multiple back-to-back moves collapse via the same debouncer — we only inspect once per quiet period.

3. **`inspectDrift` (after `driftWindowMs`):**
   - Read `actual = getRecallOuterPosition()`. Compare to `lastExpectedPosition`.
   - If `|dx| > driftThresholdPx || |dy| > driftThresholdPx` → user dragged during our inspection window. Flip to `detached`. Emit `SHELL_MODE_CHANGED { mode: 'detached' }`. Bump `rev`.
   - Else: recall is where we put it; stay in `follow`.
   - Clear `lastExpectedPosition` until the next reposition cycle sets it again (prevents false positives from stale snapshots when the user idles).

4. **`reattach()` (public):**
   - No-op if `mode === 'follow'`.
   - Call `repositionToMainRight()` once.
   - Flip `mode = 'follow'`, bump `rev`, emit `SHELL_MODE_CHANGED { mode: 'follow' }`.

5. **`dispose()` (public; idempotent):**
   - Run all stored unlisten functions; clear pending timers; mark disposed. A second call is a no-op.

#### File dependency

- `lib/window.ts` (refactored `expectedRecallPosition` + `repositionToMainRight` + `getRecallOuterPosition`)
- `lib/events.ts` (new event constants + typed emit/listen)
- No React, no Tauri UI dependency beyond the window helpers — keeps the module unit-testable with dependency injection.

#### Testability

The module exports an **internal factory** used by tests:

```ts
// @internal
export function _createCoordinator(deps: {
  emitMode: (mode: ShellMode) => void;
  reposition: () => Promise<void>;
  readExpected: () => Promise<{ x: number; y: number } | null>;
  readActual: () => Promise<{ x: number; y: number } | null>;
  now: () => number;
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (h: unknown) => void;
  opts: Required<StartOptions>;
}): FollowCoordinatorHandle;
```

Production `startFollowCoordinator` wires the real Tauri deps. Unit tests inject fakes.

### 4.3 `app/(floating)/recall-panel/RecallChrome.tsx` — modification

Add a conditional `<ReattachButton/>` slot next to the existing close button:

```tsx
// RecallChrome.tsx (sketch of the diff)
import { useShellMode } from './hooks/useShellMode';
import { ReattachButton } from './ReattachButton';

export function RecallChrome({ clientLabel, onClose }: Props) {
  const timer = useLiveTimer();
  const { mode, reattach } = useShellMode();
  return (
    <header className="recall-chrome">
      <div className="recall-chrome-top">
        <span className="recall-live">…</span>
        <span className="recall-timer">{timer}</span>
        {clientLabel ? <span className="recall-client">· {clientLabel}</span> : null}
        {mode === 'detached' ? <ReattachButton onReattach={reattach} /> : null}
        <button type="button" className="recall-close" onClick={onClose} aria-label="Close recall panel">×</button>
      </div>
      <ContextStrip />
    </header>
  );
}
```

- `<ReattachButton/>` is a tiny presentational component — `<button className="recall-reattach" onClick={onReattach}>↩ Reattach</button>`. Uses existing `--gold`/`--navy` tokens; no new CSS custom properties. One new rule in `app/globals.css` under the `/* §2A recall panel */` banner (to match Phase 2A's CSS-grouping convention).
- The button is **only rendered when detached**; Phase 2A chrome stays visually unchanged in the default follow state.

### 4.4 `app/(floating)/recall-panel/hooks/useShellMode.ts` — new

```ts
'use client';

import { useEffect, useState } from 'react';
import { EVENTS, listen } from '@/lib/events';
import type { ShellMode } from '@/lib/shell/types';

type UseShellMode = {
  mode: ShellMode;
  reattach: () => Promise<void>;  // cross-window invocation — see below
};

export function useShellMode(): UseShellMode { … }
```

**Cross-window reattach call**: the coordinator lives in `main`, not `recall`. The recall window's "Reattach" click has to reach the coordinator. Implementation:

- Reuse the existing event bus rather than adding a Tauri command. Emit a lightweight `shell:reattach_requested` event from recall; the coordinator in main listens and calls its own `reattach()`.
- Add to `lib/events.ts`:
  ```ts
  SHELL_REATTACH_REQUESTED: 'shell:reattach_requested',  // payload: {}
  ```
- Keeps the Rust side unchanged — no new `tauri::command` bindings, no new capability permissions (events are already granted in both capabilities).

The hook:
1. Initial state `mode: 'follow'` (matches coordinator's boot value).
2. `useEffect` registers `listen(EVENTS.SHELL_MODE_CHANGED, (p) => setState(p.mode))`. Cleans up on unmount.
3. `reattach()` returns `emit(EVENTS.SHELL_REATTACH_REQUESTED, {})`.

SSR guard: the hook is a client-only component (`'use client'` at the top of `RecallChrome.tsx` already). No special guard beyond `typeof window` checks inside `listen`/`emit` (already handled by Phase 1 `lib/events.ts`).

### 4.5 `lib/shell/cleanup.ts` — new

Centralized teardown. Single entry point callable from:
- `BootEffects` `useEffect` cleanup (dev-time HMR + unmount safety)
- `SHELL_APP_QUIT` event handler (Rust → JS on app exit)

```ts
type Disposable = () => Promise<void> | void;

let disposables: Disposable[] = [];
let cleanedUp = false;

export function registerDisposable(fn: Disposable): void { … }

export async function disposeAll(reason: 'unmount' | 'app_quit'): Promise<void> {
  if (cleanedUp) return;  // idempotent
  cleanedUp = true;
  const list = disposables;
  disposables = [];
  for (const fn of list) {
    try {
      await fn();
    } catch (err) {
      // swallow — teardown must finish even if one disposer throws
      console.warn('[shell/cleanup] disposer failed', err);
    }
  }
}

export function resetCleanupForTest(): void { … }   // test-only
```

Reason for an async sequential loop (not `Promise.all`): some disposers (`unregisterRecallShortcut`, `coordinator.dispose`) depend on being flushed in a known order. Sequential-with-catch is simpler and within the tight quit budget.

**Quit budget**: Rust emits `SHELL_APP_QUIT` then waits **100ms** (not blocking — documented in §4.6) before letting the close proceed. JS cleanup must complete within that window. Empirically safe: unregistering one global shortcut + unlistening ~5 event handlers + calling `coordinator.dispose()` runs in <5ms on a warm webview. Document this in `cleanup.ts` header.

### 4.6 `src-tauri/src/lib.rs` — modification

Wire two things on the Rust side:

1. **Main window move/resize → emit events** (debounced at 16ms to avoid flooding the JS bridge):
   ```rust
   // Sketch — actual crate-level types abbreviated.
   use std::sync::Mutex;
   use std::time::{Duration, Instant};

   struct MainMoveThrottle {
       last_emit: Mutex<Instant>,
   }

   // In builder setup:
   .on_window_event(|window, event| {
       if window.label() != "main" { return; }
       match event {
           tauri::WindowEvent::Moved(pos) => {
               // Throttle 16ms trailing-edge via shared state.
               // On throttle hit: schedule a last-write-wins emit via async task.
               emit_if_due(window, "shell:main_moved", json!({ "x": pos.x, "y": pos.y }));
           }
           tauri::WindowEvent::Resized(size) => {
               emit_if_due(window, "shell:main_resized", json!({ "width": size.width, "height": size.height }));
           }
           tauri::WindowEvent::CloseRequested { api, .. } => {
               // Emit the quit signal; give JS a ~100ms grace to run disposeAll.
               // Do NOT block the Tauri main thread on JS — spawn a short
               // timer then proceed. 100ms is demo-host empirical budget
               // (documented in cleanup.ts).
               window.emit("shell:app_quit", ()).ok();
               // Don't call api.prevent_close(); let Tauri continue tearing
               // down after the best-effort emit. Rust-side plugin disposal
               // happens automatically at process exit.
           }
           _ => {}
       }
   })
   ```
2. **Decision**: place this in `lib.rs` (extends the existing `run()` builder), not in `main.rs` (which stays a thin entry).

Debounce implementation choice: use a `Mutex<Instant>` as a last-emit guard. On each `Moved`/`Resized`, compute `now - last_emit`. If ≥16ms, emit + update. Else skip (we rely on the next event — OS move/resize streams are high-frequency so dropped frames are backfilled within ~16ms). This is the simplest implementation that avoids spawning background tasks; trailing-edge behaviour is acceptable because the final "mouse-up" frame always clears the window and emits. If the user drags and immediately stops, worst-case we're one frame stale — the JS debouncer in the coordinator absorbs that anyway.

**No new Tauri capabilities** — emitting events requires only `core:event:default` which both capabilities already have.

### 4.7 `app/boot-effects.tsx` — modification

Add after the existing `startKeepAliveHeartbeat()` / `registerRecallShortcut()` calls:

```ts
// Only on main window (label guard already in place).
const coordinator = await startFollowCoordinator();
registerDisposable(() => coordinator.dispose());
registerDisposable(() => unregisterRecallShortcut());
registerDisposable(() => {
  stopKeepAliveHeartbeat();
  return Promise.resolve();
});
if (unsubClient) {
  registerDisposable(() => {
    unsubClient?.();
    return Promise.resolve();
  });
}

// Wire Rust quit → JS cleanup.
const unlistenQuit = await listen(EVENTS.SHELL_APP_QUIT, () => {
  void disposeAll('app_quit');
});
// And on the reverse flow — the recall's reattach event feeds the coordinator.
const unlistenReattachReq = await listen(EVENTS.SHELL_REATTACH_REQUESTED, () => {
  void coordinator.reattach();
});
registerDisposable(unlistenQuit);
registerDisposable(unlistenReattachReq);
```

The existing `return () => { … }` cleanup keeps its current shape but is refactored to call `disposeAll('unmount')` instead of inlining individual unsubs — single source of truth for teardown. The existing inline cleanup lines still execute (through `registerDisposable` entries) so behaviour is byte-equivalent for the already-green Phase 1 exit gate cases.

---

## 5. Per-item plans

### 5.1 Main move/resize → recall auto-reposition

- **Files**:
  - `src-tauri/src/lib.rs` (new `on_window_event` handler — emit events, 16ms throttle)
  - `lib/events.ts` (new event names + typed payloads)
  - `lib/shell/follow-coordinator.ts` (subscribe + reposition on debounce trailing edge)
  - `lib/window.ts` (`expectedRecallPosition()` helper + refactor `repositionToMainRight`)
  - `app/boot-effects.tsx` (start coordinator on main)
- **Dependencies**: Phase 1 `repositionToMainRight` (reuse, not duplicate), Phase 1 `lib/events.ts`. Nothing in Phase 2A/2B/2C affected.
- **Correctness callouts**:
  - **Move flood mitigation**: Rust throttle at 16ms + JS coordinator debounce at 16ms. Double coverage is intentional — Rust saves IPC bytes, JS saves reposition calls. Both use trailing-edge timing so the *final* position always wins.
  - **No reposition when in meeting-end hidden state**: coordinator should skip reposition when recall window is not visible. Check via `getRecallWindow().isVisible()` inside the reposition path; cheap call.
  - **Coordinate space**: `PhysicalPosition` / `PhysicalSize` throughout. No mixing with logical pixels (architecture §2 + Phase 1 item 4 gotchas).
  - **DPI scaling across monitors**: `outer_position()` returns physical pixels in the originating monitor's coord space; `setPosition` accepts physical pixels globally. Tauri's underlying windowing crate (tao) normalizes this. **Not** our problem to compute scale factors — `repositionToMainRight()` already works monitor-to-monitor, verified empirically in Phase 1.
  - **Main window not yet labeled**: the `on_window_event` callback runs for any window — guard with `window.label() == "main"` strictly, otherwise recall's own `Moved` (when we reposition it) would re-enter this path.
- **Acceptance**:
  - [ ] Drag main window 100px right at normal speed → recall window tracks within one frame (subjective: visibly glued).
  - [ ] Resize main window from a corner → recall right-edge gap stays 8px.
  - [ ] Drag main window rapidly across the full screen (spam moves) → no dropped frames after 500ms of quiet (trailing edge wins).
  - [ ] Dragging main across a DPI boundary (if available on the dev machine) — recall stays next to it, no visual jump.
  - [ ] With `mode === 'detached'`, moving main does NOT reposition recall.

### 5.2 User manual drag → detach + Reattach button

- **Files**:
  - `lib/shell/follow-coordinator.ts` (drift detector)
  - `lib/window.ts` (`getRecallOuterPosition`)
  - `app/(floating)/recall-panel/RecallChrome.tsx` (mount ReattachButton)
  - `app/(floating)/recall-panel/ReattachButton.tsx` (new)
  - `app/(floating)/recall-panel/hooks/useShellMode.ts` (new)
  - `app/globals.css` (one new rule: `.recall-reattach`)
- **Dependencies**: 5.1 (reposition pipeline must exist so drift can be measured against a known anchor).
- **Correctness callouts**:
  - **Drift threshold: 30px, drift window: 200ms** (matches task-brief constraint). Threshold picked to absorb: (a) OS-level snapping, (b) 1-pixel-off-by-integer-cast rounding when recall is placed near a monitor edge, (c) sub-pixel mismatches when `main.outer_position + width` lands on a half-pixel. 30px is well above any of these and well below what a deliberate human drag produces (humans drag 100+ px minimum).
  - **Drift window rationale**: 200ms captures the time between our `setPosition` finishing and the OS dispatching a user's mouse-drag that started *just after* our programmatic move. A 50ms window would miss slow users; a 500ms window would false-positive on the user legitimately adjusting main after a move.
  - **User drag vs programmatic move ambiguity**: we cannot directly observe "the user dragged recall." The indirect signal is "200ms after we repositioned recall to position P, recall is now at position P' with |P-P'| > 30px". This is the sole disambiguator. It is correct because:
    - Programmatic reposition completes synchronously in a single `setPosition` call; Tauri does not re-move a window after `setPosition`.
    - We only inspect drift once per reposition cycle (not continuously), so a user drag *before* the next main move is still caught on the next cycle (we reposition, user drags back, drift detected on the following cycle).
    - If the user drags **between** main moves (when coordinator is idle, no pending inspection): not caught until the next main move triggers a reposition + inspection. **Acceptable** — the state machine will correctly flip to detached then. If the VP drags during a completely idle moment with no main movement, the coordinator stays in follow until the next main move, and then silently corrects back to main-right. This is a known edge case; in practice the VP only drags when the panel is in the wrong place, which means they will move main anyway. Document this in the module header.
  - **Reattach from off-screen**: if the user dragged recall to a monitor that has since been unplugged (unlikely demo-day scenario but possible if they plug/unplug a dongle), `repositionToMainRight()` will bring it back in front of main. Tauri's `setPosition` with an off-screen coord does not crash — it clamps to the current monitor. Acceptance covers this case with a manual reset.
- **Acceptance**:
  - [ ] Drag recall panel 40px to the left → coordinator flips to `detached` within 200ms → `<ReattachButton/>` appears in chrome.
  - [ ] Drag recall 20px → coordinator stays `follow` (sub-threshold).
  - [ ] In `detached`, move main window → recall does NOT move.
  - [ ] Click Reattach → recall snaps to main-right+8 + mode flips to `follow` + button disappears.
  - [ ] Trigger `meeting:start` while detached → coordinator forces `follow` + reposition fires + button disappears (fresh demo = clean slate).

### 5.3 Main minimize → recall stays visible

- **Files**:
  - `src-tauri/src/lib.rs` (no emission for minimize — see below)
  - `lib/shell/follow-coordinator.ts` (no special handling — see below)
- **Dependencies**: none (negative requirement — ensure nothing accidentally hides recall when main minimizes).
- **Correctness callouts**:
  - **Defensive by omission**: we do NOT listen for main's `WindowEvent::Minimized` or `Focused(false)`. The recall window's `alwaysOnTop: true` + `skipTaskbar: true` (Phase 1 tauri.conf.json) keeps it rendered on top of the desktop while main is in the taskbar. No action required on minimize.
  - **Windows 11 semantics**: clicking main's minimize button puts main in the taskbar. Recall stays visible because it's not a child window (`parent: null` implicit in Phase 1 conf) and `alwaysOnTop` keeps it above non-same-app desktop windows. Verified in Phase 1 smoke tests.
  - **macOS semantics (future Mac mirror)**: cmd-M minimizes to the Dock. Same result — recall stays visible. macOS Spaces: if main is on Space A and the user switches to Space B, recall follows the user (because it has no parent and is always-on-top in the "floating" level). No action required.
  - **Gotcha to avoid**: a naive implementation might be tempted to add `window.on('minimize', () => recallWindow.hide())` for aesthetic reasons. **Do not.** Recall is the Fellow's workspace; minimizing the main chrome is an intentional "get the workbench out of the way to see Zoom" gesture. Hiding recall would kill the demo.
  - **Test artifact**: if the existing Phase 1 smoke shows any main-minimize → recall-hide coupling, treat that as a regression to fix. Read `useRecallLifecycle.ts` carefully (already only listens to `meeting:start` / `meeting:end` / `recall:cmd-k`, which don't fire on minimize — so the current state is already correct. Phase 2D just formalizes it.)
- **Acceptance**:
  - [ ] With recall visible, click main's minimize button → recall remains visible, anchored at its last position.
  - [ ] Restore main (click in taskbar) → recall is still where it was; no flicker, no hide/show cycle.
  - [ ] With recall visible + mode=follow, minimize main then restore — recall does NOT re-run a reposition unless main actually moved. (Minimize restores to the same position → no `Moved` event → no reposition. Expected.)

### 5.4 cmd-Q / Alt-F4 / quit cleanup

- **Files**:
  - `src-tauri/src/lib.rs` (emit `SHELL_APP_QUIT` on `CloseRequested` + main window `Destroyed`)
  - `lib/shell/cleanup.ts` (new)
  - `app/boot-effects.tsx` (register disposables; listen for quit event)
- **Dependencies**: 5.1 (coordinator is one of the disposables), Phase 1 `lib/shortcuts.ts` (`unregisterRecallShortcut`), Phase 1 `lib/llm/heartbeat.ts` (`stopKeepAliveHeartbeat`).
- **Correctness callouts**:
  - **Windows vs macOS quit semantics**:
    - **Windows**: Alt-F4 on main OR clicking the `×` chrome fires `CloseRequested`. Default Tauri behaviour: closing the last window exits the process. Since recall is `skipTaskbar: true`, the app counts main as the last window for this purpose → CloseRequested on main ≡ app quit. Emit `SHELL_APP_QUIT`, don't `prevent_close`, let Tauri exit naturally.
    - **macOS**: cmd-Q fires `ExitRequested` at the app level, and individual windows receive `CloseRequested`. Tauri's default "cmd-Q quits the process" is on. Emit from `CloseRequested` on main; macOS-specific `ExitRequested` handler is not needed for Phase 2D (out of scope — primary demo host is Windows per architecture §1 and tauri.conf.json bundle targets).
  - **Why best-effort emit (not blocking)**: blocking the main thread in the quit handler risks a "not responding" popup if the JS webview is busy. 100ms best-effort is what graceful shutdown tools (Chromium, VSCode) do. If cleanup doesn't finish, the OS will reclaim the shortcut anyway within ~seconds.
  - **Shortcut leak recovery**: if `unregister` fails (dead handle), fall back to `unregisterAll()` (already the current behaviour in `lib/shortcuts.ts` Phase 2A). Document that a hard crash (process killed with SIGKILL, power loss) leaks the OS shortcut until reboot — mitigation is a `shortcuts.ts` re-entrant registration: a fresh boot always `unregisterAll` first, then `register` (additive nit — include in this phase if trivial).
  - **Idempotency**: `disposeAll` guards against double invocation via the `cleanedUp` flag. The unmount path (HMR, React strict mode) and the quit path can both fire; whichever wins, the other is a no-op.
  - **Exception safety**: each disposer is wrapped in try/catch inside `disposeAll`. A failing disposer does not block the others.
- **Acceptance**:
  - [ ] Close main via `×` → `SHELL_APP_QUIT` emitted → JS cleanup log line observed → process exits within <500ms.
  - [ ] After quit, restart app, verify cmd-K works (shortcut was released cleanly).
  - [ ] Unit test: `disposeAll('app_quit')` calls each registered disposable exactly once.
  - [ ] Unit test: `disposeAll` called twice → second call is a no-op (no duplicate unregister logs).
  - [ ] Unit test: a disposer that throws → subsequent disposers still run.
  - [ ] Alt-F4 on Windows 11 exhibits identical behaviour to clicking `×`.

---

## 6. Risk callouts

### R1 — Move event flood (50Hz+)

- **Failure mode**: unthrottled `on_window_event` Moved emits → JS bridge saturates → main thread stutters → recall positioning jitters visibly.
- **Mitigation**: dual throttle at 16ms. Rust side: `Mutex<Instant>` last-emit guard. JS side: `setTimeout` trailing-edge debounce in coordinator. Drop frames are acceptable because the final settled position always emits (mouse-up releases no more moves).
- **Test**: unit test the JS debouncer with a 50-event burst → expect 1 reposition call.
- **Residual risk**: on a 144Hz display, mouse moves can be ~144 events/sec. 16ms still = ~60Hz emit rate on our side, well within IPC capacity.

### R2 — DPI scaling across monitors

- **Failure mode**: recall reposition lands in the wrong monitor's coord space, appearing off-screen or on the wrong display.
- **Mitigation**: use `outer_position()` + `outer_size()` + `setPosition(PhysicalPosition)` exclusively — Tauri's tao backend handles DPI translation globally. Phase 1 already verified single-monitor correctness; multi-monitor was not directly tested.
- **Test**: manual smoke on a dual-monitor setup if available pre-demo day. Not blocking — demo host is single monitor per setup notes in architecture §1.
- **Fallback**: if a multi-monitor setup exhibits misplacement on demo day, the user detaches + drags recall into position; coordinator stays `detached` for the duration. Demo continues.

### R3 — User drag vs programmatic move ambiguity

- **Failure mode**: a user drag happens exactly inside our 200ms drift-inspection window but completes after `setPosition` has already flushed. Or: a user drag happens during an idle period with no main movement, so the coordinator never inspects until the next main move (at which point we reposition over the user's drag — feels like the app fighting the user).
- **Mitigation**:
  1. Inspection fires on a timer, not synchronously, so drags completing within the window are still caught on the trailing check.
  2. The drift threshold of 30px is large enough that accidental mouse-down-then-up (no meaningful drag) does not false-positive.
  3. Idle-drag-before-main-move: acknowledged gap documented in §5.2. Acceptable because in practice users drag recall only when they want a different anchor — the next main move "feels" like expected behaviour if the user dragged to a nearby spot.
- **Test**: unit test the coordinator with scripted sequences: (a) user drag inside window → detach; (b) user drag outside window → stay follow; (c) sub-threshold drag → stay follow.
- **Residual risk**: low. If it materializes, workaround is the Reattach button.

### R4 — Minimize under Windows 11 vs macOS Spaces

- **Failure mode (Windows 11)**: main minimize animation flickers recall if any code path accidentally bound main and recall as parent/child or same-group windows.
- **Mitigation**: verify `tauri.conf.json` does not set a `parent` relation (confirmed — it doesn't). The two windows are independent top-level windows; minimize on one does not affect the other. **Action for Phase 2D**: no code change, but add an explicit comment in `lib.rs` above the `on_window_event` noting "DO NOT listen for `Minimized` — would regress the always-visible-Fellow-workspace invariant."
- **Failure mode (macOS Spaces)**: switching to a different Space hides main; recall's "floating" window level should keep it visible on the current Space.
- **Mitigation**: Tauri 2 default window level for `alwaysOnTop: true` on macOS maps to `NSFloatingWindowLevel`. Mac verification is future work (demo host is Windows).
- **Test**: manual — Windows 11 minimize → recall stays. If macOS ever ships, repeat on Mac.

### R5 — "Reattach" UX when recall is off-screen

- **Failure mode**: user dragged recall to a now-disconnected external monitor; Reattach button is invisible; user thinks the app is broken.
- **Mitigation**:
  1. Drift detection keeps working regardless of recall's visual location — the button *is* rendered in the detached state, just not visible to the user. A keyboard shortcut would help; out of scope for Phase 2D.
  2. Fallback: `meeting:start` forces a clean-slate reattach (§5.2 acceptance). The user can trigger this by navigating main to `/meeting` and back — practical demo-day recovery.
  3. Document in demo-day runbook (not code) that Ctrl+K → close → main `/meeting` toggle resets recall position.
- **Test**: manual — Reattach works from any starting position including far off-screen (Tauri clamps).
- **Residual risk**: medium-low. The failure mode requires an external-monitor unplug mid-demo, which is itself an unrelated failure.

### R6 — Store schema stability

- **Failure mode**: adding a `shell_mode` key to `SessionStore` would break Phase 1 type-level tests (closed schema).
- **Mitigation**: §3.2 explicitly documents the decision to NOT add a store key. In-process singleton + event broadcast covers the need without touching `lib/store.ts`.
- **Test**: Phase 1 exit gate's "TypeScript rejects illegal store write" test must still pass unchanged. Re-run as part of §7 smoke.

### R7 — Rust-to-JS timing on quit

- **Failure mode**: Tauri exits before `disposeAll` finishes → global shortcut not unregistered → Ctrl+K eaten by the ghost binding until reboot.
- **Mitigation**:
  1. `SHELL_APP_QUIT` is emitted before Tauri tears down. JS cleanup runs synchronously in a best-effort 100ms window.
  2. On next boot, `lib/shortcuts.ts` `registerRecallShortcut` wraps `register` — if the OS already has a stale binding, Tauri's global-shortcut plugin rejects with "already registered". Follow-up: on registration failure, call `unregisterAll` then retry once. **Include this retry in Phase 2D** as a hardening nit alongside the cleanup work (small diff).
  3. Hard crash (SIGKILL) is unrecoverable by code; manual reboot resets.
- **Test**: restart test (boot → quit → boot) validates no leaked shortcut.

---

## 7. Order of implementation (DAG)

1. **Types + event names** — `lib/shell/types.ts` + `lib/events.ts` additions. Zero side effects; unblocks everything.
2. **`lib/window.ts` refactor** — extract `expectedRecallPosition()` + add `getRecallOuterPosition()`. `repositionToMainRight()` now calls the extracted helper; behaviour identical. **Run Phase 1 + Phase 2A + 2B + 2C test suites — expect 410 green** (no behavior change).
3. **`lib/shell/follow-coordinator.ts`** — pure TS module with injected deps (`_createCoordinator`). Implement state machine + debounce + drift detection.
4. **`follow-coordinator.test.ts`** — unit tests with fake timers + fake reposition/expected/actual readers. Gate: 100% covers the state transitions.
5. **Rust `on_window_event` handler** — `src-tauri/src/lib.rs` move/resize/close emissions with 16ms throttle. Smoke: `cargo tauri dev` → drag main → observe events on JS `window.__TAURI__` DevTools console.
6. **`useShellMode` hook + `ReattachButton` + `RecallChrome` modification** — render the detach affordance. CSS rule in `globals.css`.
7. **`lib/shell/cleanup.ts`** — `registerDisposable` / `disposeAll` + idempotency flag.
8. **`cleanup.test.ts`** — unit tests (idempotency, exception safety, ordering).
9. **`boot-effects.tsx` integration** — start coordinator, register disposables, listen for quit + reattach-request. Refactor the existing inline cleanup to call `disposeAll('unmount')`.
10. **Shortcut registration hardening (R7 nit)** — `lib/shortcuts.ts`: on `register` rejection, call `unregisterAll` + retry once.
11. **Full smoke** — run all existing test suites (Phase 0/1/2A/2B/2C) → 410 green + any new Phase 2D unit tests (estimated +12–15 tests).
12. **Manual Tauri smoke** — §8 exit gate checklist.

Rationale: types/events first (cheap, unblocks), pure TS next (unit-testable without Tauri), Rust last (needs running `cargo tauri dev`), UI last-but-one (wires the hook into chrome), cleanup + boot-effects glue ties everything together.

---

## 8. Test strategy

### Unit tests (Vitest — same runner Phase 2A/2B/2C ship)

- `lib/shell/follow-coordinator.test.ts`:
  - `[T1]` initial state is `follow` with `rev: 0`.
  - `[T2]` `onMainMove` when follow → calls `reposition()` once (debounced) and records `lastExpectedPosition`.
  - `[T3]` `onMainMove` when detached → no `reposition` call.
  - `[T4]` Drift < threshold → stays follow.
  - `[T5]` Drift ≥ threshold → flips to detached, emits mode change, bumps `rev`.
  - `[T6]` `reattach()` from detached → calls reposition, flips follow, emits mode change.
  - `[T7]` `reattach()` from follow → no-op, no emit.
  - `[T8]` `meeting:start` → forces follow + reposition even if currently detached.
  - `[T9]` `dispose()` → subsequent events no-op.
  - `[T10]` `dispose()` idempotent (second call clears no additional handlers).
  - `[T11]` Move event burst of 50 within 100ms → exactly one reposition call on trailing edge.
  - `[T12]` Drift inspection timer: 200ms → inspects once, then clears `lastExpectedPosition`.
- `lib/shell/cleanup.test.ts`:
  - `[C1]` `disposeAll` runs every registered disposable exactly once.
  - `[C2]` Second `disposeAll` call → no-op.
  - `[C3]` A disposer that throws → subsequent disposers still run; no uncaught promise.
  - `[C4]` `registerDisposable` after `disposeAll` has started → new disposable is not collected (race: caught by the flag check inside `registerDisposable`). Documented behaviour.
- `lib/window.ts` existing tests: regression — `expectedRecallPosition()` produces the exact same `(x, y)` as the old inlined math. One test case against a known main position.

### Smoke script

- `scripts/smoke-phase-2d.js`: greps the new files (`lib/shell/follow-coordinator.ts`, `lib/shell/cleanup.ts`, `app/(floating)/recall-panel/ReattachButton.tsx`, `app/(floating)/recall-panel/hooks/useShellMode.ts`, `src-tauri/src/lib.rs` for `on_window_event`). Emits one-line OK per hit. Pattern mirrors Phase 2A/2B smoke scripts. Exit 0 on all hits, exit 1 on any miss.
- Extend the existing Phase 0 `test-phase-0.js` sweep to run the smoke scripts for all phases if not already — not a Phase 2D deliverable per se, but include if the convention is already there.

### Manual Tauri smoke

Fixed sequence, ~5 minutes:
1. `cargo tauri dev` → main + recall both render (recall hidden, matches Phase 1 baseline).
2. Navigate main to `/meeting/` → recall shows + positions at main-right+8. `follow` mode active.
3. Drag main 200px right → recall tracks in real time, no visible stutter.
4. Resize main from bottom-right → recall right-edge stays 8px away.
5. Drag recall 50px to the left → `<ReattachButton/>` appears. Move main → recall does NOT move.
6. Click Reattach → recall snaps back, button disappears.
7. Drag recall again → detach → navigate main to `/dashboard/` → `meeting:end` hides recall.
8. Navigate back to `/meeting/` → recall re-shows in follow mode (fresh `meeting:start` resets mode).
9. With recall visible, minimize main → recall stays visible at its position. Restore main → recall unchanged.
10. Ctrl+K from outside the app → recall re-summoned. Close via `×` → hidden.
11. Alt-F4 main → app exits cleanly. Restart → Ctrl+K works (shortcut released).
12. All console output inspected: no `[shell/cleanup]` warnings, no unhandled rejections.

### E2E (Playwright)

**Explicitly deferred / not in scope for Phase 2D**. Rationale:
- Playwright drives a headless Chromium instance; our UI runs inside Tauri's WebView2 (Windows) / WKWebView (macOS) with native OS-level window coordinates. Playwright cannot move/resize the Tauri main window, cannot observe recall's OS-level position, and cannot simulate cmd-Q or Alt-F4.
- Phase 1 §7 and Phase 2A §7 both explicitly exclude Playwright from shell-level coverage for the same reason.
- Future option: WebDriver-based testing via `tauri-driver` — not pursued in Phase 2D. If we ever add it, the follow-coordinator's unit tests already guard the state machine and are sufficient regression coverage until then.

---

## 9. Exit gate

Phase 2D ships when every box is green:

- [ ] **Build + lint + typecheck**: `pnpm build && pnpm lint && pnpm typecheck` → all green.
- [ ] **Existing tests**: Phase 0/1/2A/2B/2C test suites — 410 tests green. No regressions.
- [ ] **New unit tests**: `follow-coordinator.test.ts` + `cleanup.test.ts` + `window.ts` regression test — all green (estimated ~12–15 new tests).
- [ ] **Smoke script**: `scripts/smoke-phase-2d.js` exits 0.
- [ ] **Rust compile**: `cargo check` in `src-tauri/` → zero warnings introduced by the new `on_window_event` handler.
- [ ] **Manual Tauri smoke**: full §8 sequence passes on the demo host (Windows 11). Each numbered step observed by the implementer.
- [ ] **State invariants** (verified in manual smoke):
  - [ ] Move main → recall tracks within one frame.
  - [ ] Drag recall > 30px → detach + Reattach button appears within 200ms.
  - [ ] Drag recall < 30px → stays follow.
  - [ ] Click Reattach → snap back + button disappears.
  - [ ] Minimize main → recall stays visible.
  - [ ] `meeting:start` while detached → forced back to follow.
  - [ ] Quit app → cleanup runs within 100ms → restart works.
- [ ] **No new npm deps** (verify `pnpm-lock.yaml` diff: no additions).
- [ ] **No new Tauri capability permissions** (verify `capabilities/*.json` diff: no additions).
- [ ] **`SessionStore` schema unchanged** (verify `lib/store.ts` `SessionStore` type identical to Phase 2C).
- [ ] **Docs**: this plan, `docs/phase-plans/phase-2d-plan.md`, committed.

When all boxes are green: **Phase 2D ships → Phase 3 (fixture generation scripts) unblocked per impl-plan §Phase 3 prereqs**.
