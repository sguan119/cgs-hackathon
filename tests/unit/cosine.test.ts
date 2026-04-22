import { describe, it, expect } from 'vitest';
import { cosineTopK } from '@/lib/retrieval/cosine';
import type { Precedent } from '@/lib/retrieval/types';

function makePrecedent(id: string, embedding: number[]): Precedent {
  return {
    id,
    client_name: id,
    year: 2020,
    industry: 'test',
    summary: '',
    scene: '',
    key_quotes: ['q'],
    cgs_tags: ['t'],
    source_id: 'src',
    embedding,
    drilldown_layers: [{ depth: 1, theme: 't', quotes: ['q'], key_facts: [{ label: 'l', value: 'v' }] }],
  };
}

describe('cosineTopK', () => {
  it('orthogonal vectors → score 0', () => {
    const q = [1, 0];
    const p = makePrecedent('p1', [0, 1]);
    const result = cosineTopK(q, [p], 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBeCloseTo(0);
  });

  it('identical vectors → score 1', () => {
    const q = [1, 2, 3];
    const p = makePrecedent('p1', [1, 2, 3]);
    const result = cosineTopK(q, [p], 1);
    expect(result[0]!.score).toBeCloseTo(1);
  });

  it('opposite vectors → score -1', () => {
    const q = [1, 0];
    const p = makePrecedent('p1', [-1, 0]);
    const result = cosineTopK(q, [p], 1);
    expect(result[0]!.score).toBeCloseTo(-1);
  });

  it('zero query vector → returns empty (no NaN)', () => {
    const q = [0, 0];
    const p = makePrecedent('p1', [1, 0]);
    const result = cosineTopK(q, [p], 1);
    expect(result).toHaveLength(0);
  });

  it('skips precedents with empty embedding', () => {
    const q = [1, 0];
    const empty = makePrecedent('empty', []);
    const valid = makePrecedent('valid', [1, 0]);
    const result = cosineTopK(q, [empty, valid], 2);
    expect(result).toHaveLength(1);
    expect(result[0]!.precedent.id).toBe('valid');
  });

  it('throws on dimension mismatch', () => {
    const q = [1, 0];
    const p = makePrecedent('p1', [1, 0, 0]);
    expect(() => cosineTopK(q, [p], 1)).toThrow(/dimension mismatch/);
  });

  it('returns all results when k > precedents.length', () => {
    const q = [1, 0];
    const p = makePrecedent('p1', [1, 0]);
    const result = cosineTopK(q, [p], 10);
    expect(result).toHaveLength(1);
  });

  it('stable sort on tied scores (lower original index first)', () => {
    const q = [1, 0];
    const p1 = makePrecedent('p1', [1, 0]);
    const p2 = makePrecedent('p2', [1, 0]);
    const result = cosineTopK(q, [p1, p2], 2);
    expect(result[0]!.precedent.id).toBe('p1');
    expect(result[1]!.precedent.id).toBe('p2');
  });
});
