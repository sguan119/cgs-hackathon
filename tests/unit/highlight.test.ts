import { describe, expect, it } from 'vitest';
import { buildHighlightRegions } from '@/lib/toneguard/highlight';
import type { Reason } from '@/lib/toneguard/types';

function r(
  start: number | undefined,
  end: number | undefined,
  severity: 'high' | 'borderline' = 'high'
): Reason {
  return {
    rule: 'sales_blacklist',
    message: 'x',
    spanStart: start,
    spanEnd: end,
    severity,
  };
}

describe('buildHighlightRegions', () => {
  it('H1: two overlapping spans merge into one region with max severity', () => {
    const input = 'aaaaaaaaaaaaaaaa';
    const regions = buildHighlightRegions(input, [r(0, 5, 'borderline'), r(3, 8, 'high')]);
    expect(regions).toHaveLength(1);
    expect(regions[0].start).toBe(0);
    expect(regions[0].end).toBe(8);
    expect(regions[0].severity).toBe('high');
    expect(regions[0].reasons).toHaveLength(2);
  });

  it('H2: spanless reasons are dropped from regions', () => {
    const regions = buildHighlightRegions('abc', [
      r(undefined, undefined, 'high'),
      r(0, 1, 'borderline'),
    ]);
    expect(regions).toHaveLength(1);
    expect(regions[0].start).toBe(0);
    expect(regions[0].end).toBe(1);
  });

  it('H3: output is sorted by start and non-overlapping', () => {
    const input = 'abcdefghij';
    const regions = buildHighlightRegions(input, [
      r(7, 9),
      r(0, 2),
      r(4, 6),
    ]);
    expect(regions.map((x) => x.start)).toEqual([0, 4, 7]);
    for (let i = 1; i < regions.length; i++) {
      expect(regions[i - 1].end).toBeLessThanOrEqual(regions[i].start);
    }
  });

  it('ignores spans with invalid bounds', () => {
    const regions = buildHighlightRegions('abc', [r(-1, 2), r(1, 10), r(2, 2)]);
    // All three are invalid: negative start; end > input.length; zero-length.
    expect(regions).toHaveLength(0);
  });

  it('touching spans (end === start) are kept as separate regions', () => {
    const regions = buildHighlightRegions('abcdef', [r(0, 2), r(2, 4)]);
    expect(regions).toHaveLength(2);
  });

  it('H4: 3 overlapping spans of different severities → merged span has max severity (high)', () => {
    const input = 'abcdefghijklmnop';
    const regions = buildHighlightRegions(input, [
      r(0, 6, 'borderline'),
      r(3, 10, 'borderline'),
      r(7, 14, 'high'),
    ]);
    expect(regions).toHaveLength(1);
    expect(regions[0].start).toBe(0);
    expect(regions[0].end).toBe(14);
    expect(regions[0].severity).toBe('high');
    expect(regions[0].reasons).toHaveLength(3);
  });

  it('H5: spanStart < 0 is filtered out', () => {
    const input = 'abcdef';
    const regions = buildHighlightRegions(input, [r(-1, 3, 'high'), r(1, 4, 'borderline')]);
    expect(regions).toHaveLength(1);
    expect(regions[0].start).toBe(1);
    expect(regions[0].end).toBe(4);
  });

  it('H6: spanEnd > body.length is filtered out', () => {
    const input = 'abcdef';
    const regions = buildHighlightRegions(input, [r(0, 100, 'high'), r(0, 3, 'borderline')]);
    expect(regions).toHaveLength(1);
    expect(regions[0].start).toBe(0);
    expect(regions[0].end).toBe(3);
  });

  it('H7: 100 fuzzed spans → result is non-overlapping, sorted, length-bounded', () => {
    const input = 'x'.repeat(200);
    const reasons: ReturnType<typeof r>[] = [];
    for (let i = 0; i < 100; i++) {
      const start = Math.floor(Math.random() * 190);
      const end = start + 1 + Math.floor(Math.random() * 10);
      reasons.push(r(start, Math.min(end, 200)));
    }
    const regions = buildHighlightRegions(input, reasons);
    for (let i = 1; i < regions.length; i++) {
      expect(regions[i - 1].end).toBeLessThanOrEqual(regions[i].start);
      expect(regions[i].start).toBeGreaterThanOrEqual(regions[i - 1].start);
    }
    expect(regions.length).toBeLessThanOrEqual(100);
  });
});
