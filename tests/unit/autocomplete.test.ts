import { describe, it, expect } from 'vitest';
import { matchPrefix } from '@/lib/retrieval/autocomplete';
import type { ScriptedQuery } from '@/lib/retrieval/fixture-types';

function mk(id: string, query: string): ScriptedQuery {
  return { id, query, embedding: [], category: 'first-hit' };
}

describe('matchPrefix', () => {
  it('returns empty for <2 chars', () => {
    expect(matchPrefix('w', [mk('a', 'what is love')])).toEqual([]);
    expect(matchPrefix('', [mk('a', 'what')])).toEqual([]);
  });

  it('returns empty on whitespace-only input', () => {
    expect(matchPrefix('   ', [mk('a', 'what')])).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const pool = [mk('a', 'What is the analogue')];
    const r = matchPrefix('what', pool);
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe('a');
  });

  it('matches only by prefix (not substring)', () => {
    const pool = [mk('a', 'the closest analogue'), mk('b', 'what is closest')];
    // "clos" only appears as a prefix in neither; both match something else
    expect(matchPrefix('clos', pool)).toEqual([]);
    expect(matchPrefix('what', pool).map((e) => e.id)).toEqual(['b']);
  });

  it('caps at 5 matches preserving declaration order', () => {
    const pool = Array.from({ length: 8 }, (_, i) => mk(`q${i}`, `prefix ${i}`));
    const r = matchPrefix('prefix', pool);
    expect(r).toHaveLength(5);
    expect(r.map((e) => e.id)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4']);
  });

  it('returns empty when pool is empty', () => {
    expect(matchPrefix('what', [])).toEqual([]);
  });

  it('case-insensitive: uppercase prefix matches lowercase query', () => {
    const pool = [mk('a', 'what is the analogue')];
    expect(matchPrefix('WHAT', pool)).toHaveLength(1);
    expect(matchPrefix('What Is', pool)).toHaveLength(1);
  });

  it('duplicate queries in pool: both entries returned (de-dup is by cap, not by query text)', () => {
    // matchPrefix does not de-duplicate by query string — it preserves pool order
    // and stops at MAX_RESULTS=5. Two identical queries both appear in results.
    const pool = [mk('a', 'what is love'), mk('b', 'what is love')];
    const r = matchPrefix('what', pool);
    expect(r).toHaveLength(2);
    expect(r.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
