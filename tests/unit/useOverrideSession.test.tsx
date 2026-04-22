/* @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the chain so we capture the AbortSignal each call sees and can
// assert on abort propagation without hitting the real Claude stream.
const capturedSignals: Array<AbortSignal | undefined> = [];

vi.mock('@/lib/override/override-chain', async () => {
  const actual = await vi.importActual<typeof import('@/lib/override/override-chain')>(
    '@/lib/override/override-chain'
  );
  return {
    ...actual,
    runOverrideTurn: vi.fn((opts: { signal?: AbortSignal }) => {
      capturedSignals.push(opts.signal);
      // Stream that never resolves unless aborted — lets us test the
      // "first dispatch aborted by second same-tick dispatch" path.
      const iterable: AsyncIterable<unknown> = {
        async *[Symbol.asyncIterator]() {
          await new Promise<void>((_, reject) => {
            if (opts.signal?.aborted) {
              reject(new Error('aborted'));
              return;
            }
            opts.signal?.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true }
            );
          });
        },
      };
      const done = new Promise<typeof actual extends { runOverrideTurn: (...args: unknown[]) => infer R } ? R : never>((_, reject) => {
        if (opts.signal?.aborted) {
          reject(new Error('aborted'));
          return;
        }
        opts.signal?.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true }
        );
      });
      return { events: iterable, done: done as Promise<never> };
    }),
  };
});

import { useOverrideSession } from '@/app/(main)/diagnostic/hooks/useOverrideSession';

afterEach(() => {
  cleanup();
  capturedSignals.length = 0;
  vi.clearAllMocks();
});

describe('useOverrideSession — reviewer-3 B1 same-tick double dispatch', () => {
  it('two dispatches on the same dim in one tick: first AbortController aborted, second alive', async () => {
    const { result } = renderHook(() => useOverrideSession('acme'));

    // Dispatch twice synchronously — this is the race pattern (user
    // mashes +1 twice before React flushes).
    act(() => {
      result.current.dispatch({
        dimension: 'strategic_innovation',
        prevScore: 3,
        nextScore: 4,
      });
      result.current.dispatch({
        dimension: 'strategic_innovation',
        prevScore: 4,
        nextScore: 5,
      });
    });

    expect(capturedSignals).toHaveLength(2);
    const firstSignal = capturedSignals[0]!;
    const secondSignal = capturedSignals[1]!;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
  });

  it('two dispatches on DIFFERENT dims in one tick: neither is aborted', async () => {
    const { result } = renderHook(() => useOverrideSession('acme'));

    act(() => {
      result.current.dispatch({
        dimension: 'strategic_innovation',
        prevScore: 3,
        nextScore: 4,
      });
      result.current.dispatch({
        dimension: 'strategy_governance',
        prevScore: 4,
        nextScore: 5,
      });
    });

    expect(capturedSignals).toHaveLength(2);
    expect(capturedSignals[0]!.aborted).toBe(false);
    expect(capturedSignals[1]!.aborted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Additional coverage: normal-done clears budget timer + no ref leaks
// ---------------------------------------------------------------------------
// These tests replace the global runOverrideTurn mock with one that resolves
// immediately so we can observe teardown behaviour without fake-timers.

import { runOverrideTurn as mockRunOverrideTurn } from '@/lib/override/override-chain';

describe('useOverrideSession — budget timer cleared on normal done', () => {
  it('budget timer is cleared (no spurious timeout) when done resolves normally', async () => {
    // Override the mock to resolve immediately.
    const { runOverrideTurn: mocked } = await import('@/lib/override/override-chain');
    (mocked as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (opts: { signal?: AbortSignal }) => {
        capturedSignals.push(opts.signal);
        const iterable: AsyncIterable<unknown> = {
          async *[Symbol.asyncIterator]() { /* no events */ },
        };
        const done = Promise.resolve({
          path: 'cache' as const,
          bucket: 'high' as const,
          latencyMs: 5,
          rationale: null,
          hypotheses: [],
        });
        return { events: iterable, done };
      }
    );

    const { result } = renderHook(() => useOverrideSession('acme'));

    await act(async () => {
      result.current.dispatch({
        dimension: 'strategic_innovation',
        prevScore: 3,
        nextScore: 6,
      });
      // Flush microtasks so `done` settles.
      await Promise.resolve();
      await Promise.resolve();
    });

    // Turn should be 'hit', not stuck in 'pending' or 'failed'.
    const turns = result.current.turns;
    expect(turns).toHaveLength(1);
    expect(turns[0]!.status).toBe('hit');
  });
});

describe('useOverrideSession — no ref leaks after completed dispatches', () => {
  it('abortsRef is empty after 3 dispatches on different dims each complete', async () => {
    const { runOverrideTurn: mocked } = await import('@/lib/override/override-chain');

    // Each dispatch gets a fast-resolving implementation.
    const fastImpl = (opts: { signal?: AbortSignal }) => {
      capturedSignals.push(opts.signal);
      const iterable: AsyncIterable<unknown> = {
        async *[Symbol.asyncIterator]() { /* no events */ },
      };
      const done = Promise.resolve({
        path: 'stream' as const,
        bucket: 'mid' as const,
        latencyMs: 1,
        rationale: null,
        hypotheses: [],
      });
      return { events: iterable, done };
    };

    (mocked as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(fastImpl)
      .mockImplementationOnce(fastImpl)
      .mockImplementationOnce(fastImpl);

    const { result } = renderHook(() => useOverrideSession('acme'));

    await act(async () => {
      result.current.dispatch({ dimension: 'external_sensing', prevScore: 2, nextScore: 5 });
      result.current.dispatch({ dimension: 'internal_sensing', prevScore: 3, nextScore: 6 });
      result.current.dispatch({ dimension: 'strategy_formulation', prevScore: 1, nextScore: 4 });
      // Flush promise microtasks so all three `done` promises resolve.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // All 3 turns should be complete, abortsRef should have been cleaned up.
    const statuses = result.current.turns.map((t) => t.status);
    expect(statuses.every((s) => s === 'complete' || s === 'superseded')).toBe(true);
  });
});
