import { describe, it, expect, vi } from 'vitest';
import { runRecallTurn, COSINE_THRESHOLD } from '@/lib/llm/recall-chain';
import type { Precedent } from '@/lib/retrieval/types';
import type { OfflineCache, ScriptedQuery } from '@/lib/retrieval/fixture-types';

function mkPrecedent(id: string, summary = 'test summary'): Precedent {
  return {
    id,
    client_name: id,
    year: 2018,
    industry: 'test',
    summary,
    scene: 'scene',
    key_quotes: ['q'],
    cgs_tags: ['Structural Inertia'],
    source_id: `${id}-src`,
    embedding: [1, 0, 0],
    drilldown_layers: [
      { depth: 1, theme: 'decision', quotes: ['q'], key_facts: [{ label: 'l', value: 'v' }] },
    ],
  };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of it) out.push(item);
  return out;
}

describe('runRecallTurn', () => {
  it('scripted path: skips embed and feeds pre-baked vector into cosine', async () => {
    const scripted: ScriptedQuery[] = [
      { id: 'q1', query: 'analogue', embedding: [1, 0, 0], category: 'first-hit' },
    ];
    const embed = vi.fn();
    const stream = vi.fn(async (args: { onDelta: (s: string) => void; onComplete: (r: unknown) => void }) => {
      args.onDelta('<year>2018</year>');
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: {} });
      return { fullText: '', usage: {} };
    });

    const chain = runRecallTurn({
      query: 'analogue',
      source: 'scripted',
      priorTurns: [],
      clientId: 'acme',
      deps: {
        embed,
        loadPrecedents: async () => [mkPrecedent('globex-2018-cdo')],
        loadScripted: async () => scripted,
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });

    const events = await collect(chain.events);
    const result = await chain.done;
    expect(embed).not.toHaveBeenCalled();
    expect(stream).toHaveBeenCalledTimes(1);
    expect(result.path).toBe('live');
    expect(result.precedentId).toBe('globex-2018-cdo');
    expect(events.some((e) => e.field === 'year' && e.isComplete)).toBe(true);
    expect(events.some((e) => e.field === 'done' && e.isComplete)).toBe(true);
  });

  it('resolves via scriptedId when id provided, even if query string does not match any scripted entry', async () => {
    // Reviewer-4 N1: the chain must prefer id-based lookup when the caller
    // threads a scripted id through from autocomplete, so small
    // whitespace/user-edit drift in the query string does not silently
    // force the OpenAI embed path.
    const scripted: ScriptedQuery[] = [
      {
        id: 'q-known',
        // Deliberately differs from the submitted query string below —
        // only the id match should succeed.
        query: 'canonical form of the query',
        embedding: [1, 0, 0],
        category: 'first-hit',
      },
    ];
    const embed = vi.fn();
    const stream = vi.fn(async (args: {
      onDelta: (s: string) => void;
      onComplete: (r: unknown) => void;
    }) => {
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: {} });
      return { fullText: '', usage: {} };
    });
    const chain = runRecallTurn({
      query: 'CANONICAL FORM of the query   ', // drift vs the scripted .query
      source: 'scripted',
      scriptedId: 'q-known',
      priorTurns: [],
      clientId: null,
      deps: {
        embed,
        loadPrecedents: async () => [mkPrecedent('p1')],
        loadScripted: async () => scripted,
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    await collect(chain.events);
    const result = await chain.done;
    expect(embed).not.toHaveBeenCalled();
    expect(result.path).toBe('live');
    expect(result.precedentId).toBe('p1');
  });

  it('free-text path: calls embed, cosine, stream', async () => {
    const embed = vi.fn().mockResolvedValue([1, 0, 0]);
    const stream = vi.fn(async (args: { onDelta: (s: string) => void; onComplete: (r: unknown) => void }) => {
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: {} });
      return { fullText: '', usage: {} };
    });
    const chain = runRecallTurn({
      query: 'open question',
      source: 'free-text',
      priorTurns: [],
      clientId: null,
      deps: {
        embed,
        loadPrecedents: async () => [mkPrecedent('p1')],
        loadScripted: async () => [],
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    await collect(chain.events);
    const result = await chain.done;
    expect(embed).toHaveBeenCalledTimes(1);
    expect(result.path).toBe('live');
  });

  it('falls back to keyword cosine when embed throws', async () => {
    const embed = vi.fn().mockRejectedValue(new Error('no key'));
    const keyword = vi.fn().mockReturnValue([
      { precedent: mkPrecedent('p2'), score: 0.7 },
    ]);
    const stream = vi.fn(async (args: { onDelta: (s: string) => void; onComplete: (r: unknown) => void }) => {
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: {} });
      return { fullText: '', usage: {} };
    });
    const chain = runRecallTurn({
      query: 'question',
      source: 'free-text',
      priorTurns: [],
      clientId: null,
      deps: {
        embed,
        keyword,
        loadPrecedents: async () => [mkPrecedent('p2')],
        loadScripted: async () => [],
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    await collect(chain.events);
    const result = await chain.done;
    expect(keyword).toHaveBeenCalledTimes(1);
    expect(result.path).toBe('live');
  });

  it('threshold miss: synthesizes no-anchor without calling stream', async () => {
    const embed = vi.fn().mockResolvedValue([1, 0, 0]);
    const cosine = vi.fn().mockReturnValue([
      { precedent: mkPrecedent('p1'), score: COSINE_THRESHOLD - 0.01 },
    ]);
    const stream = vi.fn();
    const chain = runRecallTurn({
      query: 'unrelated',
      source: 'free-text',
      priorTurns: [],
      clientId: null,
      deps: {
        embed,
        cosine,
        loadPrecedents: async () => [mkPrecedent('p1')],
        loadScripted: async () => [],
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    const events = await collect(chain.events);
    const result = await chain.done;
    expect(stream).not.toHaveBeenCalled();
    expect(result.path).toBe('no-anchor');
    expect(result.precedentId).toBeNull();
    expect(events.some((e) => e.field === 'no_anchor')).toBe(true);
    expect(events.some((e) => e.field === 'done')).toBe(true);
  });

  it('retry-exhausted + offline hit → offline path with precedent id', async () => {
    const offline: OfflineCache = {
      entries: [
        {
          query: 'analogue',
          tagged_stream: '<year>2018</year><done/>',
          precedent_id: 'globex-2018-cdo',
        },
      ],
    };
    const scripted: ScriptedQuery[] = [
      { id: 'q1', query: 'analogue', embedding: [1, 0, 0], category: 'first-hit' },
    ];
    const transient = Object.assign(new Error('upstream 503'), { status: 503 });
    const stream = vi.fn().mockRejectedValue(transient);
    const chain = runRecallTurn({
      query: 'analogue',
      source: 'scripted',
      priorTurns: [],
      clientId: 'acme',
      deps: {
        loadPrecedents: async () => [mkPrecedent('globex-2018-cdo')],
        loadScripted: async () => scripted,
        loadOffline: async () => offline,
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    const events = await collect(chain.events);
    const result = await chain.done;
    expect(stream.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(result.path).toBe('offline');
    expect(result.precedentId).toBe('globex-2018-cdo');
    expect(events.some((e) => e.field === 'year' && e.isComplete)).toBe(true);
  }, 20_000);

  it('retry does not duplicate append fields: attempt 1 emits <tag>A</tag> then fails, attempt 2 emits <tag>A</tag><done/> — consumer sees tags=[A] not [A,A]', async () => {
    // Reviewer-3 B1: failed-attempt events must not leak into the consumer
    // queue, or append-array fields (tags/quotes) accumulate duplicates on
    // retry. Scalars like year survive via last-wins; arrays don't.
    const transient = Object.assign(new Error('upstream 503'), { status: 503 });
    let callCount = 0;
    const stream = vi.fn(async (args: {
      onDelta: (s: string) => void;
      onComplete: (r: unknown) => void;
    }) => {
      callCount += 1;
      if (callCount === 1) {
        // First attempt emits a complete <tag> then errors out.
        args.onDelta('<tag>A</tag>');
        throw transient;
      }
      // Second attempt succeeds with the same tag plus done.
      args.onDelta('<tag>A</tag><done/>');
      args.onComplete({ fullText: '', usage: {} });
      return { fullText: '', usage: {} };
    });
    const chain = runRecallTurn({
      query: 'free text',
      source: 'free-text',
      priorTurns: [],
      clientId: null,
      deps: {
        embed: async () => [1, 0, 0],
        loadPrecedents: async () => [mkPrecedent('p1')],
        loadScripted: async () => [],
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    const events = await collect(chain.events);
    const result = await chain.done;
    expect(stream).toHaveBeenCalledTimes(2);
    expect(result.path).toBe('live');
    const tagCompletes = events.filter((e) => e.field === 'tag' && e.isComplete);
    expect(tagCompletes).toHaveLength(1);
    expect(tagCompletes[0]!.value).toBe('A');
  }, 10_000);

  it('retry-exhausted without offline hit → no-anchor', async () => {
    const transient = Object.assign(new Error('upstream 503'), { status: 503 });
    const stream = vi.fn().mockRejectedValue(transient);
    const chain = runRecallTurn({
      query: 'free text that does not match scripted',
      source: 'free-text',
      priorTurns: [],
      clientId: null,
      deps: {
        embed: async () => [1, 0, 0],
        loadPrecedents: async () => [mkPrecedent('p1')],
        loadScripted: async () => [],
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    const events = await collect(chain.events);
    const result = await chain.done;
    expect(result.path).toBe('no-anchor');
    expect(events.some((e) => e.field === 'no_anchor')).toBe(true);
  }, 20_000);

  it('scripted query with empty embedding falls through to OpenAI embed path (does not crash)', async () => {
    // Pre-Phase-3.1 fixture state: embedding array is empty [].
    // The chain must not throw; it falls through to the free-text embed path.
    const scripted: ScriptedQuery[] = [
      { id: 'q-empty', query: 'no embedding yet', embedding: [], category: 'first-hit' },
    ];
    const embed = vi.fn().mockResolvedValue([1, 0, 0]);
    const stream = vi.fn(async (args: { onDelta: (s: string) => void; onComplete: (r: unknown) => void }) => {
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: {} });
      return { fullText: '', usage: {} };
    });
    const chain = runRecallTurn({
      query: 'no embedding yet',
      source: 'scripted',
      priorTurns: [],
      clientId: null,
      deps: {
        embed,
        loadPrecedents: async () => [mkPrecedent('p1')],
        loadScripted: async () => scripted,
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    await collect(chain.events);
    const result = await chain.done;
    // Falls through to free-text path and calls embed
    expect(embed).toHaveBeenCalledTimes(1);
    expect(result.path).toBe('live');
  });

  it('scripted turn-2 with prior turns keeps pre-baked embedding path (no embed call, followup prefix present)', async () => {
    // Reviewer B4: when the user picks a scripted query for a follow-up
    // turn, the chain must still skip OpenAI embedding AND prepend
    // follow-up context into Seg 4.
    const scripted = [
      { id: 'q-turn2', query: 'deeper analogue', embedding: [1, 0, 0], category: 'first-hit' as const },
    ];
    const embed = vi.fn();
    let capturedFollowupQuery = '';
    const stream = vi.fn(async (args: {
      query?: string;
      onDelta: (s: string) => void;
      onComplete: (r: unknown) => void;
    }) => {
      capturedFollowupQuery = args.query ?? '';
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: {} });
      return { fullText: '', usage: {} };
    });
    const chain = runRecallTurn({
      query: 'deeper analogue',
      source: 'scripted',
      priorTurns: [
        {
          query: 'first',
          card: {
            year: '2018',
            client: 'Globex',
            scene: 'CDO',
            quotes: ['q1'],
            tags: ['Structural Inertia'],
          },
          precedentId: 'globex-2018-cdo',
        },
      ],
      clientId: 'acme',
      deps: {
        embed,
        loadPrecedents: async () => [mkPrecedent('globex-2018-cdo')],
        loadScripted: async () => scripted,
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    await collect(chain.events);
    const result = await chain.done;
    expect(embed).not.toHaveBeenCalled();
    expect(result.path).toBe('live');
    expect(result.precedentId).toBe('globex-2018-cdo');
    expect(capturedFollowupQuery).toContain('Follow-up');
    expect(capturedFollowupQuery).toContain('Q: first');
    expect(capturedFollowupQuery).toContain('deeper analogue');
  });

  it('follow-up source prepends followup context to the user query', async () => {
    let capturedQuery = '';
    const stream = vi.fn(async (args: {
      query?: string;
      onDelta: (s: string) => void;
      onComplete: (r: unknown) => void;
    }) => {
      capturedQuery = args.query ?? '';
      args.onDelta('<done/>');
      args.onComplete({ fullText: '', usage: {} });
      return { fullText: '', usage: {} };
    });
    const chain = runRecallTurn({
      query: 'and then what',
      source: 'follow-up',
      priorTurns: [
        {
          query: 'first',
          card: {
            year: '2018',
            client: 'Globex',
            scene: 'CDO',
            quotes: ['q1'],
            tags: ['Structural Inertia'],
          },
          precedentId: 'globex-2018-cdo',
        },
      ],
      clientId: 'acme',
      deps: {
        embed: async () => [1, 0, 0],
        loadPrecedents: async () => [mkPrecedent('globex-2018-cdo')],
        loadScripted: async () => [],
        loadOffline: async () => ({ entries: [] }),
        stream: stream as unknown as typeof import('@/lib/llm/client').streamCompletion,
      },
    });
    await collect(chain.events);
    await chain.done;
    expect(capturedQuery).toContain('Follow-up');
    expect(capturedQuery).toContain('Q: first');
    expect(capturedQuery).toContain('and then what');
  });
});
