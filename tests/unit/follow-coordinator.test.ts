import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _createCoordinator } from '@/lib/shell/follow-coordinator';
import type { CoordinatorDeps, ShellMode } from '@/lib/shell/types';

// Fake clock / timer harness used by the coordinator. We drive timers
// manually rather than with vi.useFakeTimers so the test double matches
// the coordinator's injected timer contract exactly (setTimer returns an
// opaque handle; clearTimer must handle null/undefined gracefully).

type ScheduledTimer = {
  id: number;
  fireAt: number;
  cb: () => void;
};

function makeHarness(overrides?: Partial<CoordinatorDeps>) {
  let nowMs = 1_000;
  let nextId = 1;
  const timers = new Map<number, ScheduledTimer>();
  const emitted: ShellMode[] = [];
  const repositionCalls: number[] = [];
  let expected: { x: number; y: number } | null = { x: 100, y: 50 };
  let actual: { x: number; y: number } | null = { x: 100, y: 50 };

  function advance(ms: number): void {
    nowMs += ms;
    const due = [...timers.values()]
      .filter((t) => t.fireAt <= nowMs)
      .sort((a, b) => a.fireAt - b.fireAt);
    for (const t of due) {
      timers.delete(t.id);
      t.cb();
    }
  }

  const deps: CoordinatorDeps = {
    emitMode: (m) => {
      emitted.push(m);
    },
    reposition: async () => {
      repositionCalls.push(nowMs);
    },
    readExpected: async () => expected,
    readActual: async () => actual,
    now: () => nowMs,
    setTimer: (cb, ms) => {
      const id = nextId++;
      timers.set(id, { id, fireAt: nowMs + ms, cb });
      return id;
    },
    clearTimer: (h) => {
      if (h === null || h === undefined) return;
      timers.delete(h as number);
    },
    opts: {
      repositionDebounceMs: 16,
      driftThresholdPx: 30,
      driftWindowMs: 200,
    },
    ...(overrides ?? {}),
  };

  return {
    deps,
    emitted,
    repositionCalls,
    advance,
    setExpected: (p: { x: number; y: number } | null) => {
      expected = p;
    },
    setActual: (p: { x: number; y: number } | null) => {
      actual = p;
    },
    pendingTimers: () => timers.size,
  };
}

async function flush(): Promise<void> {
  // Three microtask drains cover the chained awaits inside doReposition /
  // inspectDrift (readExpected → reposition → setMode → readActual).
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('follow-coordinator state machine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // [T1]
  it('initial state is follow with rev 0', () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    const s = c.getState();
    expect(s.mode).toBe('follow');
    expect(s.rev).toBe(0);
    expect(s.lastExpectedPosition).toBeNull();
  });

  // [T2]
  it('onMainMove in follow debounces and calls reposition once', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    c.__onMove();
    expect(h.repositionCalls.length).toBe(0); // debounced, not yet fired
    h.advance(16);
    await flush();
    expect(h.repositionCalls.length).toBe(1);
    expect(c.getState().lastExpectedPosition).toEqual({ x: 100, y: 50 });
  });

  // [T3]
  it('onMainMove in detached mode is a no-op (no reposition)', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    c.__onMove();
    h.advance(16);
    await flush();
    // User dragged 50px left during the drift window
    h.setActual({ x: 50, y: 50 });
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('detached');
    const priorCount = h.repositionCalls.length;
    // New main move must not reposition in detached mode
    c.__onMove();
    h.advance(16);
    await flush();
    expect(h.repositionCalls.length).toBe(priorCount);
  });

  // [T4]
  it('drift below threshold stays in follow', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    c.__onMove();
    h.advance(16);
    await flush();
    // 20px < 30px threshold
    h.setActual({ x: 120, y: 50 });
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('follow');
  });

  // [T5]
  it('drift ≥ threshold flips to detached, emits mode change, bumps rev', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    c.__onMove();
    h.advance(16);
    await flush();
    h.setActual({ x: 40, y: 50 }); // 60px delta
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('detached');
    expect(c.getState().rev).toBe(1);
    expect(h.emitted).toEqual(['detached']);
  });

  // [T6]
  it('reattach from detached calls reposition, flips follow, emits', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    c.__onMove();
    h.advance(16);
    await flush();
    h.setActual({ x: 10, y: 50 });
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('detached');
    const priorReposition = h.repositionCalls.length;
    await c.reattach();
    expect(c.getState().mode).toBe('follow');
    expect(h.repositionCalls.length).toBe(priorReposition + 1);
    expect(h.emitted).toEqual(['detached', 'follow']);
  });

  // [T7]
  it('reattach while already in follow is a no-op', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    await c.reattach();
    expect(h.repositionCalls.length).toBe(0);
    expect(h.emitted).toEqual([]);
    expect(c.getState().rev).toBe(0);
  });

  // [T8]
  it('meeting:start forces follow + reposition when detached', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    // Drive into detached
    c.__onMove();
    h.advance(16);
    await flush();
    h.setActual({ x: 0, y: 0 });
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('detached');
    const priorCount = h.repositionCalls.length;
    await c.__onMeetingStart();
    // reposition fires synchronously inside meeting:start handler (no debounce)
    expect(c.getState().mode).toBe('follow');
    expect(h.repositionCalls.length).toBe(priorCount + 1);
    expect(h.emitted).toContain('follow');
  });

  // [T8b] N1 — plan §4.2: meeting:start must always re-emit
  // SHELL_MODE_CHANGED so a recall window that just opened re-syncs,
  // even if the coordinator was already in `follow`.
  it('meeting:start while already follow still emits SHELL_MODE_CHANGED', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    expect(c.getState().mode).toBe('follow');
    expect(h.emitted).toEqual([]); // nothing emitted yet
    const priorReposition = h.repositionCalls.length;
    await c.__onMeetingStart();
    expect(c.getState().mode).toBe('follow');
    // Re-emit happens even though mode did not change.
    expect(h.emitted).toEqual(['follow']);
    // And reposition still fires so the window snaps to main-right.
    expect(h.repositionCalls.length).toBe(priorReposition + 1);
  });

  // [T9]
  it('events after dispose are no-ops', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    await c.dispose();
    c.__onMove();
    h.advance(16);
    await flush();
    expect(h.repositionCalls.length).toBe(0);
  });

  // [T10]
  it('dispose is idempotent', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    await c.dispose();
    await c.dispose();
    // No exceptions, no stray timers
    expect(h.pendingTimers()).toBe(0);
  });

  // [T11]
  it('burst of 50 moves inside the debounce window collapses to one reposition', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    for (let i = 0; i < 50; i++) {
      c.__onMove();
      h.advance(1); // 1ms between events — well inside 16ms
    }
    // Now let the debounce fire
    h.advance(16);
    await flush();
    expect(h.repositionCalls.length).toBe(1);
  });

  // [T12]
  it('drift inspection runs once then clears lastExpectedPosition', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    c.__onMove();
    h.advance(16);
    await flush();
    expect(c.getState().lastExpectedPosition).not.toBeNull();
    h.advance(200);
    await flush();
    expect(c.getState().lastExpectedPosition).toBeNull();
  });

  // [T13]
  it('subscribe replays current state synchronously, unsubscribe stops further callbacks', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    const states: ShellMode[] = [];
    const unsub = c.subscribe((s) => states.push(s.mode));
    expect(states).toEqual(['follow']); // replay on subscribe
    // Drive to detached
    c.__onMove();
    h.advance(16);
    await flush();
    h.setActual({ x: 0, y: 0 });
    h.advance(200);
    await flush();
    expect(states[states.length - 1]).toBe('detached');
    unsub();
    await c.reattach();
    // After unsubscribe, no new pushes to this subscriber
    expect(states[states.length - 1]).toBe('detached');
  });

  // [T15] Rapid alternating move+resize within 16ms — throttle debounces correctly
  it('rapid alternating move+resize within 16ms window debounces to one reposition', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    // Alternate move/resize 10 times within a 15ms span
    for (let i = 0; i < 5; i++) {
      c.__onMove();
      h.advance(1);
      c.__onResize();
      h.advance(1);
    }
    // Fire the debounce
    h.advance(16);
    await flush();
    expect(h.repositionCalls.length).toBe(1);
  });

  // [T16] reattach() called twice in quick succession — second is no-op once 'follow'
  it('reattach() called twice in quick succession — second call is a no-op', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    // Drive into detached
    c.__onMove();
    h.advance(16);
    await flush();
    h.setActual({ x: 0, y: 0 });
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('detached');
    // First reattach transitions to follow
    await c.reattach();
    const repoAfterFirst = h.repositionCalls.length;
    const emittedAfterFirst = h.emitted.length;
    // Second reattach while already in follow is a no-op
    await c.reattach();
    expect(h.repositionCalls.length).toBe(repoAfterFirst);
    expect(h.emitted.length).toBe(emittedAfterFirst);
    expect(c.getState().mode).toBe('follow');
  });

  // [T17] onMeetingStart while detached — transitions to follow + emits + repositions
  it('onMeetingStart while detached transitions to follow, emits SHELL_MODE_CHANGED, fires reposition', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    // Drive into detached
    c.__onMove();
    h.advance(16);
    await flush();
    h.setActual({ x: 0, y: 0 });
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('detached');
    const priorRepo = h.repositionCalls.length;
    const priorEmitted = h.emitted.length;
    await c.__onMeetingStart();
    expect(c.getState().mode).toBe('follow');
    expect(h.repositionCalls.length).toBe(priorRepo + 1);
    expect(h.emitted.length).toBeGreaterThan(priorEmitted);
    expect(h.emitted[h.emitted.length - 1]).toBe('follow');
  });

  // [T14] B2 — reattach schedules a drift-inspection timer so a user
  // still mid-drag is caught without needing the next main move.
  it('reattach schedules drift timer — detects drift if user still dragging', async () => {
    const h = makeHarness();
    const c = _createCoordinator(h.deps);
    // Drive to detached via drift
    c.__onMove();
    h.advance(16);
    await flush();
    h.setActual({ x: 0, y: 0 });
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('detached');
    // User clicks reattach; coordinator flips to follow and calls
    // doReposition (which schedules a drift timer).
    await c.reattach();
    expect(c.getState().mode).toBe('follow');
    expect(c.getState().lastExpectedPosition).not.toBeNull();
    // But the user is still hand-dragging — recall moves 80px after the
    // reposition lands. Drift window elapses; coordinator re-detaches.
    h.setActual({ x: 20, y: 50 });
    h.advance(200);
    await flush();
    expect(c.getState().mode).toBe('detached');
    // Proves the emit sequence: detached → follow → detached
    expect(h.emitted.slice(-3)).toEqual(['detached', 'follow', 'detached']);
  });
});
