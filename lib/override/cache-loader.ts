// Lazy loader for the Fellow-Override fixture cache. Mirrors the
// `lib/retrieval/precedents-loader.ts` pattern — static-imported JSON,
// hydrated into a `Map<overrideCacheKey, entry>` on first call, served
// from memory after. Uniqueness on (dimension, bucket) is enforced at
// load-time because a duplicate would silently shadow a later entry and
// corrupt the demo.

import overrideCacheData from '../../fixtures/override_cache.json';
import {
  overrideCacheKey,
  type OverrideBucket,
  type OverrideCache,
  type OverrideCacheEntry,
  type StrategyDimensionId,
} from './dims';

let cachePromise: Promise<OverrideCache> | null = null;
let indexPromise: Promise<Map<string, OverrideCacheEntry>> | null = null;

function buildIndex(cache: OverrideCache): Map<string, OverrideCacheEntry> {
  const idx = new Map<string, OverrideCacheEntry>();
  for (const entry of cache.entries) {
    const key = overrideCacheKey(entry.dimension, entry.bucket);
    if (idx.has(key)) {
      throw new Error(
        `override_cache: duplicate entry for ${key} — uniqueness invariant violated`
      );
    }
    idx.set(key, entry);
  }
  return idx;
}

export async function loadOverrideCache(): Promise<OverrideCache> {
  if (!cachePromise) {
    cachePromise = Promise.resolve(overrideCacheData as unknown as OverrideCache);
  }
  return cachePromise;
}

async function getIndex(): Promise<Map<string, OverrideCacheEntry>> {
  if (!indexPromise) {
    indexPromise = loadOverrideCache().then(buildIndex);
  }
  return indexPromise;
}

export async function lookupOverride(
  dim: StrategyDimensionId,
  bucket: OverrideBucket
): Promise<OverrideCacheEntry | null> {
  const idx = await getIndex();
  return idx.get(overrideCacheKey(dim, bucket)) ?? null;
}

// Validates the fixture at import-time boundaries without relying on a
// secondary schema pass. Returns the built index so tests can inspect it.
export async function loadOverrideIndex(): Promise<Map<string, OverrideCacheEntry>> {
  return getIndex();
}

// Test seam — reset module-level caches between Vitest runs.
export function __resetOverrideCacheForTests(): void {
  cachePromise = null;
  indexPromise = null;
}

// Pure helper exposed for cache-loader.test.ts so tests can drive the
// uniqueness invariant without hitting the bundled fixture.
export function buildOverrideIndex(
  cache: OverrideCache
): Map<string, OverrideCacheEntry> {
  return buildIndex(cache);
}
