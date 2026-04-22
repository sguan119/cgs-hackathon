import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cosineByKeyword, embedQuery } from '@/lib/retrieval/embed';
import type { Precedent } from '@/lib/retrieval/types';

function mkPrecedent(id: string, summary: string, extras: Partial<Precedent> = {}): Precedent {
  return {
    id,
    client_name: id,
    year: 2020,
    industry: 'test',
    summary,
    scene: '',
    key_quotes: [''],
    cgs_tags: ['t'],
    source_id: 'src',
    embedding: [],
    drilldown_layers: [{ depth: 1, theme: 't', quotes: ['q'], key_facts: [{ label: 'l', value: 'v' }] }],
    ...extras,
  };
}

describe('cosineByKeyword', () => {
  it('ranks most overlapping precedent first', () => {
    const pool = [
      mkPrecedent('p1', 'completely unrelated text about apples'),
      mkPrecedent('p2', 'the CDO reporting line was restructured'),
    ];
    const r = cosineByKeyword('CDO reporting line', pool, 2);
    expect(r[0]!.precedent.id).toBe('p2');
    expect(r[0]!.score).toBeGreaterThan(0);
  });

  it('returns empty when query has no tokens', () => {
    expect(cosineByKeyword('   ', [mkPrecedent('p1', 'hello')])).toEqual([]);
  });

  it('returns empty when pool is empty', () => {
    expect(cosineByKeyword('whatever', [])).toEqual([]);
  });

  it('handles case-insensitive matching', () => {
    const pool = [mkPrecedent('p1', 'Chief Data Officer rollout')];
    const r = cosineByKeyword('chief data officer', pool, 1);
    expect(r).toHaveLength(1);
    expect(r[0]!.score).toBeGreaterThan(0);
  });
});

describe('embedQuery', () => {
  const OLD_KEY = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    process.env.OPENAI_API_KEY = OLD_KEY;
  });

  it('throws when OPENAI_API_KEY is absent', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(embedQuery('hello')).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('posts to OpenAI and returns the embedding when key is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const emb = await embedQuery('hello');
    expect(emb).toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('openai.com');
    expect(init.method).toBe('POST');
  });

  it('throws on non-OK response', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );
    await expect(embedQuery('hello')).rejects.toThrow(/OpenAI embed failed: 503/);
  });
});
