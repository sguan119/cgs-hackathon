import { describe, expect, it } from 'vitest';
import {
  EVENT_ROUTE_MAP,
  type DashboardEventKind,
} from '@/lib/dashboard/dashboard-timeline';

describe('EVENT_ROUTE_MAP invariant (routing-map.test.ts)', () => {
  const KINDS: readonly DashboardEventKind[] = [
    'meeting',
    'earnings',
    'email',
    'memo',
    'project',
    'signal',
  ];

  it('defines every DashboardEventKind key', () => {
    for (const k of KINDS) {
      expect(EVENT_ROUTE_MAP[k]).toBeDefined();
    }
  });

  it('every value resolves to a renderable route vocabulary word', () => {
    const VALID = new Set(['recall', 'diagnostic', 'continuity', 'meeting']);
    for (const k of KINDS) {
      expect(VALID.has(EVENT_ROUTE_MAP[k])).toBe(true);
    }
  });

  it('has no stray extra keys beyond DashboardEventKind', () => {
    const mapKeys = Object.keys(EVENT_ROUTE_MAP).sort();
    const expected = [...KINDS].sort();
    expect(mapKeys).toEqual(expected);
  });
});
