import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WHEEL_SCORES,
  STRATEGY_WHEEL_DIMS,
  findDim,
  isStrategyDimensionId,
  overrideCacheKey,
  scoreToBucket,
  toBucket,
  type StrategyDimensionId,
} from '@/lib/override/dims';

describe('Strategy Wheel dims registry', () => {
  it('STRATEGY_WHEEL_DIMS is a frozen 7-tuple with unique ids', () => {
    expect(STRATEGY_WHEEL_DIMS).toHaveLength(7);
    expect(Object.isFrozen(STRATEGY_WHEEL_DIMS)).toBe(true);
    const ids = STRATEGY_WHEEL_DIMS.map((d) => d.id);
    expect(new Set(ids).size).toBe(7);
  });

  it('DEFAULT_WHEEL_SCORES covers all 7 dims and strategic_innovation is the hero-cell 2', () => {
    const ids = STRATEGY_WHEEL_DIMS.map((d) => d.id);
    for (const id of ids) {
      expect(DEFAULT_WHEEL_SCORES[id]).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_WHEEL_SCORES[id]).toBeLessThanOrEqual(7);
    }
    expect(DEFAULT_WHEEL_SCORES.strategic_innovation).toBe(2);
  });

  it('each dim has a unique abbr and an angle in [0, 360)', () => {
    const abbrs = STRATEGY_WHEEL_DIMS.map((d) => d.abbr);
    expect(new Set(abbrs).size).toBe(7);
    for (const d of STRATEGY_WHEEL_DIMS) {
      expect(d.angle).toBeGreaterThanOrEqual(0);
      expect(d.angle).toBeLessThan(360);
    }
  });

  it('findDim returns the entry when id matches, undefined otherwise', () => {
    const hit = findDim('strategic_innovation');
    expect(hit?.abbr).toBe('INV');
    expect(findDim('not-a-dim')).toBeUndefined();
  });

  it('isStrategyDimensionId narrows correctly', () => {
    expect(isStrategyDimensionId('strategic_innovation')).toBe(true);
    expect(isStrategyDimensionId('bogus')).toBe(false);
  });
});

describe('scoreToBucket — closed-inclusive at top edge', () => {
  it('scores 1 and 2 are low', () => {
    expect(scoreToBucket(1)).toBe('low');
    expect(scoreToBucket(2)).toBe('low');
  });

  it('scores 3 and 4 are mid (plan §3.3 boundary pin)', () => {
    expect(scoreToBucket(3)).toBe('mid');
    expect(scoreToBucket(4)).toBe('mid');
  });

  it('scores 5, 6, 7 are high', () => {
    expect(scoreToBucket(5)).toBe('high');
    expect(scoreToBucket(6)).toBe('high');
    expect(scoreToBucket(7)).toBe('high');
  });

  it('clamps out-of-range inputs', () => {
    expect(scoreToBucket(0)).toBe('low');
    expect(scoreToBucket(-1)).toBe('low');
    expect(scoreToBucket(8)).toBe('high');
    expect(scoreToBucket(99)).toBe('high');
  });

  it('toBucket alias matches scoreToBucket', () => {
    for (const s of [1, 2, 3, 4, 5, 6, 7]) {
      expect(toBucket(s)).toBe(scoreToBucket(s));
    }
  });
});

describe('scoreToBucket — edge anchor + idempotency', () => {
  it('score 1 returns low (bottom edge anchor)', () => {
    expect(scoreToBucket(1)).toBe('low');
  });

  it('score 7 returns high (top edge anchor)', () => {
    expect(scoreToBucket(7)).toBe('high');
  });

  it('same score always returns same bucket (idempotent)', () => {
    for (const s of [1, 2, 3, 4, 5, 6, 7] as const) {
      expect(scoreToBucket(s)).toBe(scoreToBucket(s));
    }
  });
});

describe('overrideCacheKey serialization', () => {
  it('produces canonical "${dim}:${bucket}" key', () => {
    const dim: StrategyDimensionId = 'strategic_innovation';
    expect(overrideCacheKey(dim, 'high')).toBe('strategic_innovation:high');
    expect(overrideCacheKey(dim, 'low')).toBe('strategic_innovation:low');
    expect(overrideCacheKey(dim, 'mid')).toBe('strategic_innovation:mid');
  });

  it('keys for different dims or buckets collide only when both match', () => {
    const a = overrideCacheKey('strategic_innovation', 'high');
    const b = overrideCacheKey('strategic_innovation', 'mid');
    const c = overrideCacheKey('strategy_governance', 'high');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });
});
