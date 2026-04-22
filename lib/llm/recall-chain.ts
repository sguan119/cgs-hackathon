// End-to-end orchestrator for a single Real-Time Recall turn.
//
//   query → embed/scripted-vector → cosineTopK → Claude stream →
//     parser → consumer (via async iterable)
//
// Fallback ladder lives here at the edges: threshold-miss skips Claude and
// emits a synthesized <no_anchor/><done/> payload; retry.withRetry wraps
// the Claude call; if the retry ladder exhausts we attempt an offline-cache
// lookup (scripted path only) and finally degrade to no-anchor.
//
// The THRESHOLD is a demo-tuning knob — 0.25 for the unit-normalized
// OpenAI embeddings. Keyword-cosine scores are on a different scale
// (bag-of-words intersection over length product); we deliberately reuse
// the same constant because the demo calibration work happens against the
// real embeddings.

import { cosineTopK, type ScoredPrecedent } from '../retrieval/cosine';
import { cosineByKeyword, embedQuery } from '../retrieval/embed';
import {
  findOfflineEntry,
  loadOfflineCache,
  loadPrecedents,
  loadScriptedQueries,
} from '../retrieval/precedents-loader';
import type { Precedent } from '../retrieval/types';
import { streamCompletion } from './client';
import { buildFollowupContext, type FollowupTurn } from './followup';
import { synthesizeNoAnchor } from './no-anchor';
import { withRetry } from './retry';
import { RecallStreamParser, type ParserEvent } from './stream-parser';

export const COSINE_THRESHOLD = 0.25;

export type RecallChainSource = 'scripted' | 'free-text' | 'follow-up';
export type RecallChainPath = 'live' | 'offline' | 'no-anchor';

export type RecallChainOptions = {
  query: string;
  source: RecallChainSource;
  // When provided, the chain looks up the scripted entry by id first
  // (plan §5.3). Useful when autocomplete surfaced the query and we want
  // to use the exact pre-baked embedding without a brittle query-string
  // match — e.g. if the user edited whitespace before pressing Enter.
  scriptedId?: string;
  priorTurns: FollowupTurn[];
  clientId: string | null;
  signal?: AbortSignal;
  // Injection seams — ALL default to real impls; overridden in tests.
  deps?: Partial<ChainDeps>;
  // Callback surface — matches the retry-ladder cb contract so the
  // RecallPanel can show a <Toast variant="loading"> during backoff.
  onAttempt?: (_attempt: 1 | 2 | 3) => void;
  onRetryWait?: (_attempt: 2 | 3, _waitMs: number) => void;
  onDegrade?: (_reason: 'offline' | 'no-anchor') => void;
};

export type RecallChainResult = {
  precedentId: string | null;
  latencyMs: number | null;
  path: RecallChainPath;
  scores: ScoredPrecedent[];
};

type ChainDeps = {
  embed: typeof embedQuery;
  cosine: typeof cosineTopK;
  keyword: typeof cosineByKeyword;
  stream: typeof streamCompletion;
  loadPrecedents: typeof loadPrecedents;
  loadScripted: typeof loadScriptedQueries;
  loadOffline: typeof loadOfflineCache;
  findOffline: typeof findOfflineEntry;
};

const DEFAULT_DEPS: ChainDeps = {
  embed: embedQuery,
  cosine: cosineTopK,
  keyword: cosineByKeyword,
  stream: streamCompletion,
  loadPrecedents,
  loadScripted: loadScriptedQueries,
  loadOffline: loadOfflineCache,
  findOffline: findOfflineEntry,
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

function buildPrecedentRefs(scores: ScoredPrecedent[]): string[] {
  return scores.map((s) => s.precedent.id);
}

async function resolveScores(
  opts: RecallChainOptions,
  deps: ChainDeps
): Promise<ScoredPrecedent[]> {
  const precedents: Precedent[] = await deps.loadPrecedents();
  if (precedents.length === 0) return [];

  // Scripted path: skip OpenAI, use the pre-baked vector on the scripted
  // query directly. Reviewer-4 N1: prefer lookup by `scriptedId` when it
  // was threaded from autocomplete, since the query string can drift
  // (whitespace, user edit) while the id is stable. Falls back to query
  // match so callers that don't pass an id still work.
  if (opts.source === 'scripted') {
    const scripted = await deps.loadScripted();
    let match = opts.scriptedId
      ? scripted.find((s) => s.id === opts.scriptedId)
      : undefined;
    if (!match) match = scripted.find((s) => s.query.trim() === opts.query.trim());
    if (match && match.embedding.length > 0) {
      return deps.cosine(match.embedding, precedents, 3);
    }
    // Fall through to free-text handling if the scripted fixture is still
    // skeletal (no embedding yet).
  }

  // Free-text (or scripted fallback) path: try OpenAI, else keyword cosine.
  try {
    const emb = await deps.embed(opts.query, opts.signal);
    return deps.cosine(emb, precedents, 3);
  } catch {
    return deps.keyword(opts.query, precedents, 3);
  }
}

async function runLiveStream(
  opts: RecallChainOptions,
  scores: ScoredPrecedent[],
  queue: Queue<ParserEvent>,
  deps: ChainDeps
): Promise<void> {
  const precedentIds = buildPrecedentRefs(scores);
  // "Is follow-up" is independent of source (plan §5.7 + reviewer B4):
  // a scripted query can land after a first turn and must still use the
  // pre-baked embedding / offline-cache path while prepending context.
  const isFollowup = opts.priorTurns.length > 0;
  const followupPrefix = isFollowup ? buildFollowupContext(opts.priorTurns) : '';
  const userQuery = followupPrefix ? `${followupPrefix}\n\n${opts.query}` : opts.query;

  await withRetry(
    async () => {
      // Reviewer-3 B1: buffer events locally per attempt and only flush
      // to the outer queue after the stream resolves. Previously, append
      // fields (`tags`, `quotes`) would duplicate on retry because failed
      // attempts had already pushed their events into the consumer-facing
      // queue; scalars survive via last-wins but arrays don't.
      //
      // Reviewer-2 B2: parser MUST be fresh on each retry too — a stream
      // that failed mid-tag leaves the parser with a populated buffer.
      const parser = new RecallStreamParser();
      const localEvents: ParserEvent[] = [];
      const result = await deps.stream({
        mode: 'recall',
        clientId: opts.clientId,
        precedentIds,
        query: userQuery,
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
      // Success: flush buffered events to the consumer queue only now.
      for (const ev of localEvents) queue.push(ev);
      return result;
    },
    {
      onAttempt: opts.onAttempt,
      onRetryWait: opts.onRetryWait,
    },
    { signal: opts.signal }
  );
}

async function runOfflineCache(
  opts: RecallChainOptions,
  queue: Queue<ParserEvent>,
  deps: ChainDeps
): Promise<{ precedentId: string | null; hit: boolean }> {
  if (opts.source !== 'scripted') return { precedentId: null, hit: false };
  const cache = await deps.loadOffline();
  const entry = deps.findOffline(cache, opts.query);
  if (!entry) return { precedentId: null, hit: false };

  const parser = new RecallStreamParser();
  const stream = entry.tagged_stream;
  const CHUNK = 40;
  const INTER_CHUNK_MS = 60; // plan §5.9 — approximates Claude streaming cadence

  // Slice into 40-char chunks AND pace them at ~60ms so the offline card
  // visually streams instead of appearing as a synchronous dump. Awaits
  // each scheduled push; callers that iterate the queue get realistic
  // arrival timing.
  for (let i = 0; i < stream.length; i += CHUNK) {
    // Reviewer-4 B1: bail if the caller aborted. Without this check the
    // paced loop keeps pushing events into a queue nobody is reading
    // once the consumer has moved on.
    if (opts.signal?.aborted) break;
    if (i > 0 && INTER_CHUNK_MS > 0) {
      await new Promise<void>((r) => setTimeout(r, INTER_CHUNK_MS));
    }
    if (opts.signal?.aborted) break;
    for (const ev of parser.push(stream.slice(i, i + CHUNK))) queue.push(ev);
  }
  return { precedentId: entry.precedent_id, hit: true };
}

function emitNoAnchor(queue: Queue<ParserEvent>): void {
  for (const ev of synthesizeNoAnchor()) queue.push(ev);
}

export function runRecallTurn(opts: RecallChainOptions): {
  events: AsyncIterable<ParserEvent>;
  done: Promise<RecallChainResult>;
} {
  const deps: ChainDeps = { ...DEFAULT_DEPS, ...(opts.deps ?? {}) };
  const queue = makeQueue<ParserEvent>();
  const startedAt = Date.now();

  const done = (async (): Promise<RecallChainResult> => {
    try {
      const scores = await resolveScores(opts, deps);
      const topScore = scores[0]?.score ?? 0;

      // Threshold miss → skip Claude entirely, synthesize no-anchor.
      if (scores.length === 0 || topScore < COSINE_THRESHOLD) {
        opts.onDegrade?.('no-anchor');
        emitNoAnchor(queue);
        return { precedentId: null, latencyMs: null, path: 'no-anchor', scores };
      }

      try {
        await runLiveStream(opts, scores, queue, deps);
        const precedentId = scores[0]?.precedent.id ?? null;
        return {
          precedentId,
          latencyMs: Date.now() - startedAt,
          path: 'live',
          scores,
        };
      } catch (err) {
        // Live path failed. Try offline cache (scripted only).
        const offline = await runOfflineCache(opts, queue, deps);
        if (offline.hit) {
          opts.onDegrade?.('offline');
          return { precedentId: offline.precedentId, latencyMs: null, path: 'offline', scores };
        }
        opts.onDegrade?.('no-anchor');
        emitNoAnchor(queue);
        return { precedentId: null, latencyMs: null, path: 'no-anchor', scores };
      }
    } finally {
      queue.end();
    }
  })();

  return { events: queue.iterable, done };
}
