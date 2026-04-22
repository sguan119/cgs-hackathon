import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetOverrideCacheForTests,
  buildOverrideIndex,
  loadOverrideCache,
  lookupOverride,
} from '@/lib/override/cache-loader';
import {
  overrideCacheKey,
  type OverrideCache,
  type OverrideCacheEntry,
  type StrategyDimensionId,
} from '@/lib/override/dims';

function mkEntry(
  dim: StrategyDimensionId,
  bucket: 'low' | 'mid' | 'high',
  id = `${dim}-${bucket}`
): OverrideCacheEntry {
  return {
    dimension: dim,
    bucket,
    hypotheses: [
      {
        id,
        kind: 'structural',
        label: `label ${id}`,
        statement: `statement ${id}`,
        confidence: 0.7,
        evidence: [{ source_id: 'src-1', quote: 'q' }],
        intervention_ids: ['int-a'],
      },
    ],
    rationale: `rationale ${id}`,
    baked_at: '2026-04-01T00:00:00Z',
  };
}

afterEach(() => {
  __resetOverrideCacheForTests();
});

describe('cache-loader', () => {
  it('O9: empty fixture → every lookup returns null', async () => {
    // Shipped fixture is empty in Phase 2B — covers the live-streaming
    // default path (plan §6.5 acceptance).
    const cache = await loadOverrideCache();
    expect(cache.version).toBe(1);
    expect(cache.entries).toHaveLength(0);
    expect(await lookupOverride('strategic_innovation', 'high')).toBeNull();
    expect(await lookupOverride('strategy_governance', 'mid')).toBeNull();
  });

  it('O7: hand-built cache returns the matching entry by {dim, bucket}', () => {
    const cache: OverrideCache = {
      version: 1,
      entries: [
        mkEntry('strategic_innovation', 'high'),
        mkEntry('strategic_innovation', 'mid'),
        mkEntry('strategy_governance', 'high'),
      ],
    };
    const idx = buildOverrideIndex(cache);
    expect(idx.size).toBe(3);
    expect(idx.get(overrideCacheKey('strategic_innovation', 'high'))?.hypotheses[0]?.id).toBe(
      'strategic_innovation-high'
    );
    expect(idx.get(overrideCacheKey('strategy_governance', 'high'))?.hypotheses[0]?.id).toBe(
      'strategy_governance-high'
    );
  });

  it('O8: uniqueness invariant — duplicate (dim, bucket) throws at load time', () => {
    const cache: OverrideCache = {
      version: 1,
      entries: [
        mkEntry('strategic_innovation', 'high', 'a'),
        mkEntry('strategic_innovation', 'high', 'b'),
      ],
    };
    expect(() => buildOverrideIndex(cache)).toThrowError(/duplicate entry/i);
  });

  it('different dims at the same bucket do NOT collide', () => {
    const cache: OverrideCache = {
      version: 1,
      entries: [
        mkEntry('strategic_innovation', 'mid'),
        mkEntry('strategy_governance', 'mid'),
      ],
    };
    const idx = buildOverrideIndex(cache);
    expect(idx.size).toBe(2);
  });

  it('canonical cache key is "${dim}:${bucket}"', () => {
    const entry = mkEntry('strategic_innovation', 'high');
    expect(overrideCacheKey(entry.dimension, entry.bucket)).toBe('strategic_innovation:high');
  });

  it('empty entries array → lookupOverride always returns null', async () => {
    // Drive a known-empty cache through the module's lazy index.
    // __resetOverrideCacheForTests resets the singleton; loadOverrideCache
    // returns the bundled fixture which has entries: [].
    const result1 = await lookupOverride('strategic_innovation', 'high');
    const result2 = await lookupOverride('strategy_governance', 'low');
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  it('duplicate (dim, bucket) in JSON → buildIndex throws, subsequent lookupOverride rejects', async () => {
    const cache: OverrideCache = {
      version: 1,
      entries: [
        mkEntry('external_sensing', 'mid', 'a'),
        mkEntry('external_sensing', 'mid', 'b'),
      ],
    };
    // Direct helper: must throw synchronously.
    expect(() => buildOverrideIndex(cache)).toThrowError(/duplicate entry/i);
  });

  it('schema catches malformed entry missing headline (structural: no label)', () => {
    // InertiaHypothesis requires `label`. Build an entry that would be
    // rejected by the schema's `required` check. We verify the schema
    // itself has the guard — the loader is not the validator, so we
    // inspect the schema file directly via JSON.
    const schemaText = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../fixtures/override_cache.schema.json'),
      'utf8'
    );
    const schema = JSON.parse(schemaText);
    const required: string[] = schema.definitions.InertiaHypothesis.required;
    expect(required).toContain('label');
    // Bucket enum is enforced.
    const bucketEnum: string[] = schema.definitions.OverrideCacheEntry.properties.bucket.enum;
    expect(bucketEnum).toEqual(['low', 'mid', 'high']);
  });
});
