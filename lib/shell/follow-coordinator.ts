// Phase 2D follow-coordinator — owns the follow/detach state machine.
//
// One active instance per main-window boot. Subscribes to Rust-emitted
// main-window Moved/Resized events (already 16ms-throttled on the Rust
// side), debounces locally on the trailing edge, and repositions recall
// via `repositionToMainRight()`. After each programmatic reposition it
// schedules a drift-inspection timer; if recall has moved > driftThreshold
// during the inspection window, the user is assumed to be hand-dragging
// and the coordinator flips to `detached`.
//
// Known edge case (documented in plan §5.2): a user drag during an idle
// period (no main movement) isn't caught until the next main move fires.
// This is acceptable because users typically drag recall when they want a
// different anchor — the next main move smoothly corrects to follow, or
// drift is caught then and we flip detached.
//
// The internal `_createCoordinator` factory accepts injected dependencies
// so unit tests can drive the state machine with fake timers + fake
// reposition/expected/actual readers. Production `startFollowCoordinator`
// wires the real Tauri deps.

import { EVENTS, emit, listen } from '@/lib/events';
import {
  expectedRecallPosition,
  getRecallOuterPosition,
  getRecallWindow,
  repositionToMainRight,
} from '@/lib/window';
import type {
  CoordinatorDeps,
  FollowCoordinatorHandle,
  FollowCoordinatorState,
  ShellMode,
  StartOptions,
} from './types';

const DEFAULTS: Required<StartOptions> = {
  repositionDebounceMs: 16,
  driftThresholdPx: 30,
  driftWindowMs: 200,
};

/**
 * Internal-only extension to FollowCoordinatorHandle exposing the
 * event-driven entry points to `startFollowCoordinator`. Not part of
 * the public surface — hidden behind a dedicated type so consumers
 * can't rely on them.
 */
export type InternalCoordinatorHandle = FollowCoordinatorHandle & {
  __onMove: () => void;
  __onResize: () => void;
  __onMeetingStart: () => Promise<void>;
};

/**
 * @internal Test-only factory with injectable deps. Kept exported for
 * unit tests; production callers should use `startFollowCoordinator`.
 */
export function _createCoordinator(deps: CoordinatorDeps): InternalCoordinatorHandle {
  const state: FollowCoordinatorState = {
    mode: 'follow',
    rev: 0,
    lastProgrammaticRepositionAt: null,
    lastExpectedPosition: null,
  };

  const subs = new Set<(_s: FollowCoordinatorState) => void>();
  let debounceHandle: unknown = null;
  let driftHandle: unknown = null;
  let disposed = false;

  function notify(): void {
    for (const cb of subs) {
      try {
        cb(state);
      } catch {
        // subscriber errors must not break the coordinator
      }
    }
  }

  function setMode(next: ShellMode): void {
    if (state.mode === next) return;
    state.mode = next;
    state.rev += 1;
    deps.emitMode(next);
    notify();
  }

  async function doReposition(): Promise<void> {
    if (disposed) return;
    const expected = await deps.readExpected();
    if (!expected) return;
    await deps.reposition();
    state.lastProgrammaticRepositionAt = deps.now();
    state.lastExpectedPosition = expected;

    // Schedule drift inspection — a fresh timer per reposition cycle.
    // If one is already pending, cancel it so we inspect once per quiet
    // period rather than stacking.
    if (driftHandle !== null) {
      deps.clearTimer(driftHandle);
      driftHandle = null;
    }
    driftHandle = deps.setTimer(() => {
      driftHandle = null;
      void inspectDrift();
    }, deps.opts.driftWindowMs);
  }

  async function inspectDrift(): Promise<void> {
    if (disposed) return;
    if (state.mode !== 'follow') return;
    const expected = state.lastExpectedPosition;
    if (!expected) return;
    const actual = await deps.readActual();
    // Clear the snapshot regardless — a stale expected across idle time
    // would false-positive on the next inspection.
    state.lastExpectedPosition = null;
    if (!actual) return;
    const dx = Math.abs(actual.x - expected.x);
    const dy = Math.abs(actual.y - expected.y);
    if (dx > deps.opts.driftThresholdPx || dy > deps.opts.driftThresholdPx) {
      setMode('detached');
    }
  }

  function scheduleReposition(): void {
    if (disposed) return;
    if (state.mode !== 'follow') return;
    if (debounceHandle !== null) {
      deps.clearTimer(debounceHandle);
      debounceHandle = null;
    }
    debounceHandle = deps.setTimer(() => {
      debounceHandle = null;
      void doReposition();
    }, deps.opts.repositionDebounceMs);
  }

  async function reattach(): Promise<void> {
    if (disposed) return;
    if (state.mode === 'follow') return;
    // Flip mode first so doReposition() is allowed to run (it guards on
    // follow). Route through doReposition() rather than a bare reposition
    // so the drift-inspection timer is scheduled — catches the case where
    // the user clicks reattach mid-drag (B2).
    setMode('follow');
    // Re-check disposed in case dispose() ran between the two awaits —
    // doReposition also guards, but belt-and-braces keeps the intent
    // explicit alongside onMeetingStart / inspectDrift.
    if (disposed) return;
    await doReposition();
  }

  async function onMeetingStart(): Promise<void> {
    if (disposed) return;
    // meeting:start = clean slate. Per plan §4.2 we always re-assert
    // follow + emit SHELL_MODE_CHANGED so the recall window re-syncs
    // (covers the case where recall just opened and missed the initial
    // SHELL_MODE_CHANGED broadcast). setMode() is a no-op when already
    // follow, so we bypass it here and emit + notify unconditionally.
    state.mode = 'follow';
    state.rev += 1;
    deps.emitMode('follow');
    notify();
    await doReposition();
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    if (debounceHandle !== null) {
      deps.clearTimer(debounceHandle);
      debounceHandle = null;
    }
    if (driftHandle !== null) {
      deps.clearTimer(driftHandle);
      driftHandle = null;
    }
    subs.clear();
  }

  return {
    getState(): FollowCoordinatorState {
      return { ...state };
    },
    subscribe(cb) {
      subs.add(cb);
      // replay current state synchronously so late subscribers hydrate
      try {
        cb({ ...state });
      } catch {
        // ignore
      }
      return () => {
        subs.delete(cb);
      };
    },
    reattach,
    dispose,
    // Internal entry points used by the production wiring in
    // `startFollowCoordinator`. Typed on InternalCoordinatorHandle so
    // tests + wiring have a stable contract without widening the public
    // FollowCoordinatorHandle surface.
    __onMove: scheduleReposition,
    __onResize: scheduleReposition,
    __onMeetingStart: onMeetingStart,
  };
}

/**
 * Start the production coordinator. Wires the Rust-emitted shell events
 * (`SHELL_MAIN_MOVED`, `SHELL_MAIN_RESIZED`) + `MEETING_START` + the
 * cross-window `SHELL_REATTACH_REQUESTED` bridge. Returns a handle
 * whose `dispose()` unwires every listener and clears pending timers.
 */
export async function startFollowCoordinator(
  opts?: StartOptions
): Promise<FollowCoordinatorHandle> {
  const fullOpts: Required<StartOptions> = { ...DEFAULTS, ...(opts ?? {}) };

  const coordinator = _createCoordinator({
    emitMode: (mode) => {
      void emit(EVENTS.SHELL_MODE_CHANGED, { mode });
    },
    reposition: async () => {
      // Skip reposition when the recall window is hidden (meeting ended
      // or closed by the user) — saves a setPosition call and a
      // potentially visible flash if it re-shows.
      try {
        const recall = await getRecallWindow();
        if (!recall) return;
        const visible = await recall.isVisible();
        if (!visible) return;
      } catch {
        // fall through — if the visibility probe fails, still try the
        // reposition (cheap and harmless if the window is gone)
      }
      await repositionToMainRight();
    },
    readExpected: () => expectedRecallPosition(),
    readActual: () => getRecallOuterPosition(),
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    setTimer: (cb, ms) => setTimeout(cb, ms),
    clearTimer: (h) => {
      if (h !== null && h !== undefined) clearTimeout(h as ReturnType<typeof setTimeout>);
    },
    opts: fullOpts,
  });

  // Bridge Rust → JS events into the state machine.
  const unlistenMove = await listen(EVENTS.SHELL_MAIN_MOVED, () => {
    coordinator.__onMove();
  });
  const unlistenResize = await listen(EVENTS.SHELL_MAIN_RESIZED, () => {
    coordinator.__onResize();
  });
  const unlistenMeetingStart = await listen(EVENTS.MEETING_START, () => {
    void coordinator.__onMeetingStart();
  });
  // Cross-window reattach request from the recall panel's ReattachButton.
  // Owned here (not in boot-effects) so the coordinator encapsulates all
  // of its event wiring — dispose() tears this down with the rest.
  const unlistenReattachReq = await listen(EVENTS.SHELL_REATTACH_REQUESTED, () => {
    void coordinator.reattach();
  });

  // Emit initial mode once so late subscribers (e.g. recall window) hydrate.
  void emit(EVENTS.SHELL_MODE_CHANGED, { mode: 'follow' });

  const baseDispose = coordinator.dispose;
  let outerDisposed = false;
  coordinator.dispose = async () => {
    // Guard against double-dispose: Tauri unlisten is safe to call twice
    // but the contract isn't documented — belt-and-braces.
    if (outerDisposed) return;
    outerDisposed = true;
    for (const fn of [unlistenMove, unlistenResize, unlistenMeetingStart, unlistenReattachReq]) {
      try {
        fn();
      } catch {
        // ignore — teardown must continue
      }
    }
    await baseDispose();
  };

  return coordinator;
}
