import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamOptions } from '@/lib/llm/types';
import {
  OVERRIDE_TURN_BUDGET_MS,
  runOverrideTurn,
  serializeCacheEntry,
} from '@/lib/override/override-chain';
import type {
  OverrideBucket,
  OverrideCacheEntry,
  StrategyDimensionId,
} from '@/lib/override/dims';
import type { OverrideStreamEvent } from '@/lib/override/override-parser';

function mkEntry(
  dim: StrategyDimensionId,
  bucket: 'low' | 'mid' | 'high'
): OverrideCacheEntry {
  return {
    dimension: dim,
    bucket,
    hypotheses: [
      {
        id: `${dim}-${bucket}-1`,
        kind: 'structural',
        label: `label ${dim}`,
        statement: `statement ${dim}`,
        confidence: 0.72,
        evidence: [{ source_id: 'src-1', quote: 'quote text' }],
        intervention_ids: ['int-a', 'int-b'],
      },
    ],
    rationale: `rationale ${dim}:${bucket}`,
    baked_at: '2026-04-01T00:00:00Z',
  };
}

// Build a lookupFn stub. Mirrors what `lookupOverride` does in production:
// O(1) keyed match on (dim, bucket), returns null on miss.
function makeLookup(entries: OverrideCacheEntry[]) {
  return async (
    dim: StrategyDimensionId,
    bucket: OverrideBucket
  ): Promise<OverrideCacheEntry | null> =>
    entries.find((e) => e.dimension === dim && e.bucket === bucket) ?? null;
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

// Immediate-resolve delay so paced cache-hit chunks don't wait real time.
const fastDelay = () => Promise.resolve();

const emptyUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

describe('runOverrideTurn — routing (O14, O15) + retries (O18)', () => {
  it('O14: cache-hit routes to cache path with complete hypothesis set', async () => {
    const entry = mkEntry('strategic_innovation', 'high');
    const stream = vi.fn();

    const { events, done } = runOverrideTurn({
      dimension: 'strategic_innovation',
      prevScore: 3,
      nextScore: 6,
      clientId: 'acme',
      deps: {
        lookupFn: makeLookup([entry]),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        now: () => 0,
      },
    });

    const evs = await collect(events);
    const result = await done;

    expect(stream).not.toHaveBeenCalled();
    expect(result.path).toBe('cache');
    expect(result.bucket).toBe('high');
    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0]?.id).toBe('strategic_innovation-high-1');
    expect(result.rationale).toBe('rationale strategic_innovation:high');
    expect(evs.some((e) => e.field === 'done' && e.isComplete)).toBe(true);
  });

  it('O15: cache-miss routes to stream path and calls streamCompletion once', async () => {
    const stream = vi.fn(async (args: StreamOptions) => {
      args.onDelta('<rationale>from model</rationale>');
      args.onDelta('<hypothesis_start>m-1</hypothesis_start>');
      args.onDelta(
        '<kind>structural</kind><label>L</label><statement>S</statement><confidence>0.5</confidence>'
      );
      args.onDelta('<hypothesis_end/><done/>');
      args.onComplete({ fullText: '', usage: emptyUsage });
      return { fullText: '', usage: emptyUsage };
    });

    const { events, done } = runOverrideTurn({
      dimension: 'strategy_governance',
      prevScore: 3,
      nextScore: 6,
      clientId: 'acme',
      deps: {
        lookupFn: makeLookup([]),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        now: () => 0,
      },
    });

    const evs = await collect(events);
    const result = await done;
    expect(stream).toHaveBeenCalledTimes(1);
    expect(result.path).toBe('stream');
    expect(result.bucket).toBe('high');
    expect(result.rationale).toBe('from model');
    expect(result.hypotheses[0]?.id).toBe('m-1');
    expect(evs.some((e) => e.field === 'done' && e.isComplete)).toBe(true);
  });

  it('stream prompt Seg 4 includes the "only recompute affected downstream" plan §6.6 pin', async () => {
    let captured = '';
    const stream = vi.fn(async (args: StreamOptions) => {
      captured = args.query ?? '';
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: emptyUsage });
      return { fullText: '', usage: emptyUsage };
    });

    const { done } = runOverrideTurn({
      dimension: 'strategy_formulation',
      prevScore: 3,
      nextScore: 4,
      clientId: 'acme',
      deps: {
        lookupFn: makeLookup([]),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        now: () => 0,
      },
    });
    await done;
    expect(captured).toContain('Only recompute affected downstream');
    expect(captured).toContain('strategy_formulation');
  });

  it('O18a (non-transient): stream error skips retry, fails fast', async () => {
    const stream = vi.fn(async (_args: StreamOptions) => {
      throw new Error('boom');
    });

    const { events, done } = runOverrideTurn({
      dimension: 'strategy_governance',
      prevScore: 3,
      nextScore: 6,
      clientId: 'acme',
      deps: {
        lookupFn: makeLookup([]),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        now: () => 0,
      },
    });

    const evsPromise = collect(events);
    await expect(done).rejects.toThrow(/boom/);
    const evs = await evsPromise;
    expect(evs).toHaveLength(0);
    // Non-transient: called exactly once (no retry).
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it('O18b (transient 503): retry ladder fires 3 attempts, exhausts, bubbles up', async () => {
    // 503-shaped error triggers `isTransientError === true`, so the
    // retry ladder runs the full 3 attempts. Fake timers bypass the
    // 2s/6s real-time sleeps.
    vi.useFakeTimers();
    try {
      const err: Error & { status?: number } = Object.assign(new Error('service unavailable'), {
        status: 503,
      });
      const stream = vi.fn(async (_args: StreamOptions) => {
        throw err;
      });
      const onAttempt = vi.fn();
      const onExhausted = vi.fn();

      const { events, done } = runOverrideTurn({
        dimension: 'strategy_governance',
        prevScore: 3,
        nextScore: 6,
        clientId: 'acme',
        onAttempt,
        onExhausted,
        deps: {
          lookupFn: makeLookup([]),
          stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
          delay: fastDelay,
          now: () => 0,
        },
      });

      const donePromise = done.catch((e) => e);
      const evsPromise = collect(events);

      // Drive both 2s + 6s backoff waits to completion.
      await vi.advanceTimersByTimeAsync(10_000);

      const err2 = await donePromise;
      await evsPromise;

      expect(stream).toHaveBeenCalledTimes(3);
      expect(onAttempt).toHaveBeenCalledTimes(3);
      expect(onAttempt).toHaveBeenNthCalledWith(1, 1);
      expect(onAttempt).toHaveBeenNthCalledWith(2, 2);
      expect(onAttempt).toHaveBeenNthCalledWith(3, 3);
      expect(onExhausted).toHaveBeenCalledTimes(1);
      expect(err2).toBeInstanceOf(Error);
      expect((err2 as Error & { status?: number }).status).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bucket is computed from nextScore only', async () => {
    const stream = vi.fn(async (args: StreamOptions) => {
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: emptyUsage });
      return { fullText: '', usage: emptyUsage };
    });

    const { done } = runOverrideTurn({
      dimension: 'strategic_innovation',
      prevScore: 1,
      nextScore: 3,
      clientId: 'acme',
      deps: {
        lookupFn: makeLookup([]),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        now: () => 0,
      },
    });
    const r = await done;
    expect(r.bucket).toBe('mid');
  });

  it('serializeCacheEntry produces a parser-compatible tag stream', () => {
    const entry = mkEntry('strategic_innovation', 'high');
    const out = serializeCacheEntry(entry);
    expect(out).toContain(`<rationale>${entry.rationale}</rationale>`);
    expect(out).toContain(`<hypothesis_start>${entry.hypotheses[0]!.id}</hypothesis_start>`);
    expect(out.endsWith('<done/>')).toBe(true);
  });

  it('cache-hit aborts cleanly when signal fires mid-pace', async () => {
    const entry = mkEntry('strategic_innovation', 'high');
    const stream = vi.fn();
    const ctrl = new AbortController();
    ctrl.abort();

    const { events, done } = runOverrideTurn({
      dimension: 'strategic_innovation',
      prevScore: 3,
      nextScore: 6,
      clientId: 'acme',
      signal: ctrl.signal,
      deps: {
        lookupFn: makeLookup([entry]),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        now: () => 0,
      },
    });

    const evs = await collect(events);
    const result = await done;
    expect(evs).toHaveLength(0);
    expect(result.path).toBe('cache');
  });
});

describe('B2 — concurrent same-dim abort (O16)', () => {
  it('aborting turn A before completion prevents its events from contaminating the second turn', async () => {
    // Turn A: stream that throws an AbortError-shaped error when its
    // signal aborts, and resolves only on that path.
    const streamA = vi.fn(async (args: StreamOptions) => {
      return await new Promise<typeof emptyUsage>((_, reject) => {
        const onAbort = () => {
          const err = new Error('aborted') as Error & { name?: string };
          err.name = 'AbortError';
          reject(err);
        };
        if (args.signal?.aborted) {
          onAbort();
          return;
        }
        args.signal?.addEventListener('abort', onAbort, { once: true });
      }).then((usage) => ({ fullText: '', usage }));
    });
    // Turn B: emits a fully committed hypothesis and done.
    const streamB = vi.fn(async (args: StreamOptions) => {
      args.onDelta('<rationale>B</rationale>');
      args.onDelta('<hypothesis_start>b-1</hypothesis_start>');
      args.onDelta(
        '<kind>structural</kind><label>B</label><statement>S</statement><confidence>0.9</confidence>'
      );
      args.onDelta('<hypothesis_end/><done/>');
      args.onComplete({ fullText: '', usage: emptyUsage });
      return { fullText: '', usage: emptyUsage };
    });

    const ctrlA = new AbortController();
    const turnA = runOverrideTurn({
      dimension: 'strategic_innovation',
      prevScore: 3,
      nextScore: 6,
      clientId: 'acme',
      signal: ctrlA.signal,
      deps: {
        lookupFn: makeLookup([]),
        stream: streamA as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        // Custom retry waits of 0 so abort doesn't race against real timers.
        now: () => 0,
      },
    });

    // Attach handlers BEFORE abort so nothing unhandled escapes.
    const aDone = turnA.done.catch((e) => ({ error: e }));
    const aEvents = collect(turnA.events);
    ctrlA.abort();
    const aResult = await aDone;
    await aEvents;

    // First turn: threw / errored.
    expect(aResult).toHaveProperty('error');
    expect(streamA).toHaveBeenCalled();

    // Now dispatch B on the same dim with a fresh chain.
    const turnB = runOverrideTurn({
      dimension: 'strategic_innovation',
      prevScore: 6,
      nextScore: 7,
      clientId: 'acme',
      deps: {
        lookupFn: makeLookup([]),
        stream: streamB as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        now: () => 0,
      },
    });

    const bEvents = await collect(turnB.events);
    const bResult = await turnB.done;

    expect(bResult.path).toBe('stream');
    expect(bResult.hypotheses).toHaveLength(1);
    expect(bResult.hypotheses[0]?.id).toBe('b-1');
    // No append-field contamination: exactly one hypothesis_end/done pair.
    expect(bEvents.filter((e) => e.field === 'done').length).toBe(1);
    expect(bEvents.filter((e) => e.field === 'hypothesis_end').length).toBe(1);
  });
});

describe('B3 — 45s budget timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('signal aborted after OVERRIDE_TURN_BUDGET_MS causes stream throw; caller decides failed status', async () => {
    // The chain itself does not own the budget timer — `useOverrideSession`
    // does (plan §6.6). This test pins the pipe: when signal fires at the
    // budget deadline, the in-flight stream throws and `done` rejects,
    // allowing the session hook to flip status → 'failed'. Use fake timers
    // to advance exactly to the budget boundary without real wall time.
    const ctrl = new AbortController();
    const stream = vi.fn(async (args: StreamOptions) => {
      await new Promise<void>((_, reject) => {
        args.signal?.addEventListener(
          'abort',
          () => reject(new Error('AbortError: aborted')),
          { once: true }
        );
      });
      return { fullText: '', usage: emptyUsage };
    });

    const { events, done } = runOverrideTurn({
      dimension: 'strategy_governance',
      prevScore: 3,
      nextScore: 6,
      clientId: 'acme',
      signal: ctrl.signal,
      deps: {
        lookupFn: makeLookup([]),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
        delay: fastDelay,
        now: () => 0,
      },
    });

    // Schedule the budget trip via the same mechanism useOverrideSession
    // uses (setTimeout + ctrl.abort). Assert OVERRIDE_TURN_BUDGET_MS is
    // the pin the hook will consume.
    expect(OVERRIDE_TURN_BUDGET_MS).toBe(45_000);
    const budgetTimer = setTimeout(() => ctrl.abort(), OVERRIDE_TURN_BUDGET_MS);

    const evsPromise = collect(events);
    const donePromise = done.catch((e) => e);

    await vi.advanceTimersByTimeAsync(OVERRIDE_TURN_BUDGET_MS + 1);

    const doneResult = await donePromise;
    await evsPromise;

    expect(doneResult).toBeInstanceOf(Error);
    clearTimeout(budgetTimer);
  });
});

describe('B4 — cache hit vs cache miss produce distinct event shapes', () => {
  it('cache hit: result.path is "cache", stream never called', async () => {
    const entry = mkEntry('external_sensing', 'low');
    const stream = vi.fn();

    const { events, done } = runOverrideTurn({
      dimension: 'external_sensing',
      prevScore: 5,
      nextScore: 1,
      clientId: 'acme',
      deps: { lookupFn: makeLookup([entry]), stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion, delay: fastDelay, now: () => 0 },
    });

    const evs = await collect(events);
    const result = await done;
    expect(result.path).toBe('cache');
    expect(stream).not.toHaveBeenCalled();
    expect(evs.some((e) => e.field === 'done' && e.isComplete)).toBe(true);
  });

  it('cache miss: result.path is "stream", stream called once', async () => {
    const stream = vi.fn(async (args: StreamOptions) => {
      args.onDelta('<rationale>miss-rationale</rationale><done/>');
      args.onComplete({ fullText: '', usage: emptyUsage });
      return { fullText: '', usage: emptyUsage };
    });

    const { events, done } = runOverrideTurn({
      dimension: 'internal_sensing',
      prevScore: 2,
      nextScore: 6,
      clientId: 'acme',
      deps: { lookupFn: makeLookup([]), stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion, delay: fastDelay, now: () => 0 },
    });

    await collect(events);
    const result = await done;
    expect(result.path).toBe('stream');
    expect(stream).toHaveBeenCalledTimes(1);
    expect(result.rationale).toBe('miss-rationale');
  });
});

describe('B5 — clientId null skips Seg 3', () => {
  it('clientId null: stream still called (no Seg 3 client context injected)', async () => {
    let capturedClientId: string | null | undefined = 'SENTINEL';
    const stream = vi.fn(async (args: StreamOptions) => {
      capturedClientId = args.clientId;
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: emptyUsage });
      return { fullText: '', usage: emptyUsage };
    });

    const { done } = runOverrideTurn({
      dimension: 'strategy_governance',
      prevScore: 3,
      nextScore: 6,
      clientId: null,
      deps: { lookupFn: makeLookup([]), stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion, delay: fastDelay, now: () => 0 },
    });
    await done;
    expect(stream).toHaveBeenCalledTimes(1);
    expect(capturedClientId).toBeNull();
  });

  it('clientId non-null: stream receives the client context', async () => {
    let capturedClientId: string | null | undefined = 'SENTINEL';
    const stream = vi.fn(async (args: StreamOptions) => {
      capturedClientId = args.clientId;
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: emptyUsage });
      return { fullText: '', usage: emptyUsage };
    });

    const { done } = runOverrideTurn({
      dimension: 'strategy_governance',
      prevScore: 3,
      nextScore: 6,
      clientId: 'acme',
      deps: { lookupFn: makeLookup([]), stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion, delay: fastDelay, now: () => 0 },
    });
    await done;
    expect(capturedClientId).toBe('acme');
  });
});
