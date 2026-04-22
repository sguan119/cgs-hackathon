// Lazy loaders for fixture JSON. Bundled at build time via resolveJsonModule
// so the static-export serves them without needing a /public/ copy. Wrapped
// in promises to keep the async API stable for tests that mock with delays.

import offlineCacheData from '../../fixtures/offline_cache.json';
import precedentsData from '../../fixtures/precedents.json';
import scriptedQueriesData from '../../fixtures/scripted_queries.json';
import type { OfflineCache, OfflineCacheEntry, ScriptedQuery } from './fixture-types';
import type { Precedent } from './types';

let precedentsPromise: Promise<Precedent[]> | null = null;
let scriptedQueriesPromise: Promise<ScriptedQuery[]> | null = null;
let offlineCachePromise: Promise<OfflineCache> | null = null;

export async function loadPrecedents(): Promise<Precedent[]> {
  if (!precedentsPromise) {
    precedentsPromise = Promise.resolve(precedentsData as unknown as Precedent[]);
  }
  return precedentsPromise;
}

export async function loadScriptedQueries(): Promise<ScriptedQuery[]> {
  if (!scriptedQueriesPromise) {
    scriptedQueriesPromise = Promise.resolve(scriptedQueriesData as unknown as ScriptedQuery[]);
  }
  return scriptedQueriesPromise;
}

export async function loadOfflineCache(): Promise<OfflineCache> {
  if (!offlineCachePromise) {
    offlineCachePromise = Promise.resolve(offlineCacheData as unknown as OfflineCache);
  }
  return offlineCachePromise;
}

export function findOfflineEntry(
  cache: OfflineCache,
  query: string
): OfflineCacheEntry | null {
  const trimmed = query.trim();
  for (const entry of cache.entries) {
    if (entry.query.trim() === trimmed) return entry;
  }
  return null;
}

// Test seam — reset module-level caches between Vitest runs.
export function __resetLoaderCachesForTests(): void {
  precedentsPromise = null;
  scriptedQueriesPromise = null;
  offlineCachePromise = null;
}
