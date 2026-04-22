// Tests for scripts/lib/diff.ts (the gen-script dry-run diff helper).
// Named scripts-diff to avoid colliding with tests/unit/diff.test.ts (override/diff.ts).
import { describe, it, expect } from 'vitest';
import { summarizeDiff, embeddingDelta } from '@/scripts/lib/diff';

describe('embeddingDelta', () => {
  it('reports zero-to-1536 as +1536', () => {
    expect(embeddingDelta([], Array(1536).fill(0))).toMatch(/\+1536/);
  });

  it('reports 1536-to-1536 as +0', () => {
    expect(embeddingDelta(Array(1536).fill(0), Array(1536).fill(0))).toMatch(/\+0/);
  });

  it('reports shrink as negative delta', () => {
    const out = embeddingDelta(Array(10).fill(0), Array(5).fill(0));
    expect(out).toContain('-5');
  });

  it('includes old and new dimension counts', () => {
    const out = embeddingDelta([], Array(1536).fill(0));
    expect(out).toContain('old=0-d');
    expect(out).toContain('new=1536-d');
  });
});

describe('summarizeDiff', () => {
  it('reports key with type change from undefined to string', () => {
    const out = summarizeDiff({}, { headline: 'hello' });
    expect(out).toContain('headline');
  });

  it('reports array length change', () => {
    const out = summarizeDiff({ items: [1, 2] }, { items: [1, 2, 3] });
    expect(out).toContain('items');
    expect(out).toContain('array(2)');
    expect(out).toContain('array(3)');
  });

  it('returns no-changes message when objects are structurally identical at top level', () => {
    const out = summarizeDiff({ a: 'x', b: 1 }, { a: 'y', b: 2 });
    expect(out).toContain('no top-level changes');
  });

  it('handles undefined before state', () => {
    const out = summarizeDiff(undefined, { key: 'val' });
    expect(out).toBeDefined();
  });

  it('handles null after state', () => {
    const out = summarizeDiff({ a: 1 }, null);
    expect(out).toContain('no after state');
  });
});
