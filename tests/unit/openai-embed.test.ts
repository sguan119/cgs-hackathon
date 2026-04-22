import { describe, it, expect, vi } from 'vitest';
import { embedBatch, OPENAI_BATCH_MAX } from '@/scripts/lib/openai-embed';

function mockFetchOk(vectorsByCall: number[][][]): typeof fetch {
  let callIdx = 0;
  return vi.fn(async () => {
    const vectors = vectorsByCall[callIdx++]!;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: vectors.map((v, i) => ({ embedding: v, index: i })),
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 10, total_tokens: 10 },
      }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('embedBatch', () => {
  it('sends a single HTTP call and returns vectors zipped by key in input order', async () => {
    const fetchImpl = mockFetchOk([[[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]]);
    const out = await embedBatch(
      [
        { key: 'a', text: 'alpha' },
        { key: 'b', text: 'beta' },
        { key: 'c', text: 'gamma' },
      ],
      { apiKey: 'sk-test', model: 'text-embedding-3-small', fetchImpl }
    );
    expect(out.embeddings).toHaveLength(3);
    expect(out.embeddings[0]).toEqual({ key: 'a', vector: [0.1, 0.2] });
    expect(out.embeddings[2]).toEqual({ key: 'c', vector: [0.5, 0.6] });
    expect(out.model).toBe('text-embedding-3-small');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('handles empty input without calling fetch', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const out = await embedBatch([], {
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
      fetchImpl,
    });
    expect(out.embeddings).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('propagates non-OK HTTP errors with status on the Error object', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(
      embedBatch([{ key: 'a', text: 'alpha' }], {
        apiKey: 'sk-bad',
        model: 'text-embedding-3-small',
        fetchImpl,
      })
    ).rejects.toMatchObject({ message: /OpenAI embed failed: 401/, status: 401 });
  });

  it('chunks inputs larger than OPENAI_BATCH_MAX into separate calls', async () => {
    const size = OPENAI_BATCH_MAX + 3;
    const items = Array.from({ length: size }, (_, i) => ({
      key: `k${i}`,
      text: `t${i}`,
    }));
    const firstChunkVectors = Array.from({ length: OPENAI_BATCH_MAX }, () => [0.1]);
    const secondChunkVectors = [[0.2], [0.3], [0.4]];
    const fetchImpl = mockFetchOk([firstChunkVectors, secondChunkVectors]);
    const out = await embedBatch(items, {
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out.embeddings).toHaveLength(size);
    expect(out.embeddings[size - 1]).toEqual({ key: `k${size - 1}`, vector: [0.4] });
  });

  it('throws when OpenAI returns fewer vectors than requested', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: [0.1] }] }),
    })) as unknown as typeof fetch;
    await expect(
      embedBatch(
        [
          { key: 'a', text: 'alpha' },
          { key: 'b', text: 'beta' },
        ],
        { apiKey: 'sk-test', model: 'text-embedding-3-small', fetchImpl }
      )
    ).rejects.toThrow(/expected 2 vectors, got 1/);
  });
});
