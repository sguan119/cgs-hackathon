// End-to-end orchestrator for a single Fellow-Override turn.
//
//   (dim, prev → next) →
//     scoreToBucket →
//       lookupOverride(dim, bucket) →
//         HIT  → synthesize paced chunks through OverrideStreamParser (cache)
//         MISS → build Seg 4 payload → withRetry(streamCompletion)
//                → OverrideStreamParser → consumer queue (stream)
//         FAIL → onDegrade('failed'); no offline fallback — baseline
//                hypotheses stay visible per plan §5.4 step 6.
//
// Reuses Phase 2A `withRetry` + `lib/llm/client.streamCompletion` verbatim;
// inherits the Seg 1/2/3 prompt-cache prefix through Phase 1 client code
// (plan §5.4 step 5 — Phase 2B does NOT build its own system blocks).

import { streamCompletion } from '@/lib/llm/client';
import { withRetry } from '@/lib/llm/retry';
import { lookupOverride } from './cache-loader';
import {
  scoreToBucket,
  type InertiaHypothesis,
  type OverrideBucket,
  type OverrideCacheEntry,
  type StrategyDimensionId,
} from './dims';
import {
  OverrideStreamParser,
  type OverrideStreamEvent,
} from './override-parser';

// 45-second budget per plan §6.6. Exposed for test stubs so fake-timers
// don't have to infer the exact constant.
export const OVERRIDE_TURN_BUDGET_MS = 45_000;

// Cache-hit slicing: 40-char chunks at 40 ms so the UI renders a realistic
// streaming feel instead of a single synchronous dump. Plan §5.4 step 2.
const CACHE_HIT_CHUNK_SIZE = 40;
const CACHE_HIT_INTERVAL_MS = 40;

export type OverrideChainPath = 'cache' | 'stream';

export type OverrideChainOptions = {
  dimension: StrategyDimensionId;
  prevScore: number;
  nextScore: number;
  clientId: string | null;
  signal?: AbortSignal;
  onAttempt?: (_attempt: 1 | 2 | 3) => void;
  onRetryWait?: (_attempt: 2 | 3, _waitMs: number) => void;
  onExhausted?: () => void;
  deps?: Partial<ChainDeps>;
};

export type OverrideChainResult = {
  path: OverrideChainPath;
  bucket: OverrideBucket;
  latencyMs: number;
  rationale: string | null;
  hypotheses: InertiaHypothesis[];
};

type ChainDeps = {
  // Plan §5.2: O(1) keyed lookup that enforces the (dim,bucket) uniqueness
  // invariant via `buildOverrideIndex` in cache-loader.ts. The chain must
  // NOT reach into raw cache.entries[] — doing so skips the invariant.
  lookupFn: typeof lookupOverride;
  stream: typeof streamCompletion;
  now: () => number;
  // Async delay used between paced cache-hit chunks — stubbable in tests
  // so synthetic streams complete synchronously.
  delay: (_ms: number, _signal?: AbortSignal) => Promise<void>;
};

const DEFAULT_DEPS: ChainDeps = {
  lookupFn: lookupOverride,
  stream: streamCompletion,
  now: () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now(),
  delay: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (ms <= 0) {
        resolve();
        return;
      }
      const t = setTimeout(resolve, ms);
      if (signal) {
        const onAbort = () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }),
};

type Queue<T> = {
  push: (_item: T) => void;
  end: (_err?: unknown) => void;
  iterable: AsyncIterable<T>;
};

function makeQueue<T>(): Queue<T> {
  const pending: T[] = [];
  const waiters: Array<(_v: IteratorResult<T>) => void> = [];
  let ended = false;
  let finalErr: unknown = null;

  function push(item: T): void {
    if (ended) return;
    const waiter = waiters.shift();
    if (waiter) waiter({ value: item, done: false });
    else pending.push(item);
  }
  function end(err?: unknown): void {
    if (ended) return;
    ended = true;
    finalErr = err;
    while (waiters.length > 0) {
      const w = waiters.shift()!;
      if (err) w(Promise.reject(err) as unknown as IteratorResult<T>);
      else w({ value: undefined as unknown as T, done: true });
    }
  }
  const iterable: AsyncIterable<T> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<T>> {
          if (pending.length > 0) {
            return Promise.resolve({ value: pending.shift()!, done: false });
          }
          if (ended) {
            if (finalErr) return Promise.reject(finalErr);
            return Promise.resolve({ value: undefined as unknown as T, done: true });
          }
          return new Promise<IteratorResult<T>>((resolve) => waiters.push(resolve));
        },
      };
    },
  };
  return { push, end, iterable };
}

// Pre-formatted tag stream for a cached entry. Producing this server-side
// would be ideal; we generate it at runtime from the typed entry so Phase
// 3.3 content owners write plain JSON and the demo doesn't require a
// second toolchain. Ordering mirrors plan §4.3.
export function serializeCacheEntry(entry: OverrideCacheEntry): string {
  const parts: string[] = [];
  parts.push(`<rationale>${entry.rationale}</rationale>`);
  for (const h of entry.hypotheses) {
    parts.push(`<hypothesis_start>${h.id}</hypothesis_start>`);
    parts.push(`<kind>${h.kind}</kind>`);
    parts.push(`<label>${h.label}</label>`);
    parts.push(`<statement>${h.statement}</statement>`);
    parts.push(`<confidence>${h.confidence}</confidence>`);
    for (const ev of h.evidence) {
      parts.push(`<evidence_quote>${ev.quote}</evidence_quote>`);
      parts.push(`<evidence_source>${ev.source_id}</evidence_source>`);
    }
    for (const id of h.intervention_ids) {
      parts.push(`<intervention_id>${id}</intervention_id>`);
    }
    parts.push(`<hypothesis_end/>`);
  }
  parts.push(`<done/>`);
  return parts.join('');
}

function buildOverridePrompt(
  dim: StrategyDimensionId,
  bucket: OverrideBucket,
  prevScore: number,
  nextScore: number
): string {
  // Seg 4 dynamic text — plan §6.6 pin: include the literal "only
  // recompute affected downstream…" phrase and inline the grammar shape
  // so grammar evolution doesn't invalidate Seg 1's cache.
  return [
    `Fellow Override — dimension: ${dim}; bucket: ${bucket}; ${prevScore} → ${nextScore}.`,
    `Only recompute affected downstream Inertia + interventions. Do not regenerate other wheel dims.`,
    ``,
    `Emit ONLY the tag stream defined below — no Markdown, no commentary outside tags.`,
    `<rationale>…</rationale>`,
    `<hypothesis_start>ID</hypothesis_start><kind>dominant_logic|structural</kind><label>…</label><statement>…</statement><confidence>0..1</confidence>(<evidence_quote>…</evidence_quote><evidence_source>…</evidence_source>)+(<intervention_id>…</intervention_id>)+<hypothesis_end/>`,
    `(…more hypothesis blocks…)`,
    `<done/>`,
  ].join('\n');
}

async function runCacheHit(
  entry: OverrideCacheEntry,
  queue: Queue<OverrideStreamEvent>,
  signal: AbortSignal | undefined,
  deps: ChainDeps
): Promise<void> {
  const parser = new OverrideStreamParser();
  const stream = serializeCacheEntry(entry);
  for (let i = 0; i < stream.length; i += CACHE_HIT_CHUNK_SIZE) {
    if (signal?.aborted) return;
    if (i > 0 && CACHE_HIT_INTERVAL_MS > 0) {
      try {
        await deps.delay(CACHE_HIT_INTERVAL_MS, signal);
      } catch {
        return;
      }
    }
    if (signal?.aborted) return;
    for (const ev of parser.push(stream.slice(i, i + CACHE_HIT_CHUNK_SIZE))) {
      queue.push(ev);
    }
  }
}

async function runStream(
  opts: OverrideChainOptions,
  bucket: OverrideBucket,
  queue: Queue<OverrideStreamEvent>,
  deps: ChainDeps
): Promise<void> {
  const prompt = buildOverridePrompt(
    opts.dimension,
    bucket,
    opts.prevScore,
    opts.nextScore
  );

  await withRetry(
    async () => {
      // Buffer locally per attempt to match Phase 2A's retry discipline
      // (reviewer B1 pin on recall-chain.ts): failed attempts must not
      // pollute the consumer-facing queue with half-built events.
      const parser = new OverrideStreamParser();
      const localEvents: OverrideStreamEvent[] = [];
      await deps.stream({
        mode: 'override',
        clientId: opts.clientId,
        query: prompt,
        onDelta: (delta) => {
          for (const ev of parser.push(delta)) localEvents.push(ev);
        },
        onComplete: () => {
          /* resolved below */
        },
        onError: () => {
          /* surfaced via throw */
        },
        signal: opts.signal,
      });
      for (const ev of localEvents) queue.push(ev);
    },
    {
      onAttempt: opts.onAttempt,
      onRetryWait: opts.onRetryWait,
      onExhausted: opts.onExhausted,
    },
    { signal: opts.signal }
  );
}

function foldResultFromCache(entry: OverrideCacheEntry): {
  rationale: string;
  hypotheses: InertiaHypothesis[];
} {
  return { rationale: entry.rationale, hypotheses: [...entry.hypotheses] };
}

// Scan the queue-bound events a second time to produce the terminal
// OverrideChainResult (rationale + committed hypotheses). Cheap — the
// stream emits ~30 events per turn. Keeps the queue-based public surface
// decoupled from the result-folding concern.
function foldResultFromEvents(
  events: readonly OverrideStreamEvent[]
): { rationale: string | null; hypotheses: InertiaHypothesis[] } {
  let rationale: string | null = null;
  const out: InertiaHypothesis[] = [];
  let active: Partial<InertiaHypothesis> | null = null;

  for (const ev of events) {
    if (!ev.isComplete) continue;
    switch (ev.field) {
      case 'rationale':
        rationale = String(ev.value);
        break;
      case 'hypothesis_start':
        active = {
          id: String(ev.value),
          evidence: [],
          intervention_ids: [],
        };
        break;
      case 'kind':
        if (active) active.kind = String(ev.value) as InertiaHypothesis['kind'];
        break;
      case 'label':
        if (active) active.label = String(ev.value);
        break;
      case 'statement':
        if (active) active.statement = String(ev.value);
        break;
      case 'confidence': {
        if (active) {
          const n = Number(String(ev.value));
          if (!Number.isNaN(n)) active.confidence = n;
        }
        break;
      }
      case 'evidence_quote':
        if (active) {
          const evs = active.evidence ?? [];
          const last = evs[evs.length - 1];
          if (last && !last.quote) last.quote = String(ev.value);
          else evs.push({ source_id: '', quote: String(ev.value) });
          active.evidence = evs;
        }
        break;
      case 'evidence_source':
        if (active) {
          const evs = active.evidence ?? [];
          const last = evs[evs.length - 1];
          if (last && !last.source_id) last.source_id = String(ev.value);
          else evs.push({ source_id: String(ev.value), quote: '' });
          active.evidence = evs;
        }
        break;
      case 'intervention_id':
        if (active) {
          const ids = active.intervention_ids ?? [];
          ids.push(String(ev.value));
          active.intervention_ids = ids;
        }
        break;
      case 'hypothesis_end':
        if (active && active.id && active.kind && active.label) {
          out.push(active as InertiaHypothesis);
        }
        active = null;
        break;
      case 'done':
        active = null;
        break;
    }
  }
  return { rationale, hypotheses: out };
}

export function runOverrideTurn(opts: OverrideChainOptions): {
  events: AsyncIterable<OverrideStreamEvent>;
  done: Promise<OverrideChainResult>;
} {
  const deps: ChainDeps = { ...DEFAULT_DEPS, ...(opts.deps ?? {}) };
  const queue = makeQueue<OverrideStreamEvent>();
  const startedAt = deps.now();
  const bucket = scoreToBucket(opts.nextScore);
  const tapped: OverrideStreamEvent[] = [];

  // Tap the queue so we can fold the terminal result without forcing the
  // consumer to iterate twice. Wrap `push` transparently.
  const originalPush = queue.push;
  queue.push = (item) => {
    tapped.push(item);
    originalPush(item);
  };

  const done = (async (): Promise<OverrideChainResult> => {
    try {
      const cached = await deps.lookupFn(opts.dimension, bucket);

      if (cached) {
        await runCacheHit(cached, queue, opts.signal, deps);
        const { rationale, hypotheses } = foldResultFromCache(cached);
        return {
          path: 'cache',
          bucket,
          latencyMs: deps.now() - startedAt,
          rationale,
          hypotheses,
        };
      }

      await runStream(opts, bucket, queue, deps);
      const { rationale, hypotheses } = foldResultFromEvents(tapped);
      return {
        path: 'stream',
        bucket,
        latencyMs: deps.now() - startedAt,
        rationale,
        hypotheses,
      };
    } finally {
      queue.end();
    }
  })();

  return { events: queue.iterable, done };
}
