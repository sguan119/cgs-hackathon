// Mirror of the fixture JSON schemas. Runtime validation lives in
// scripts/test-phase-0.js (ajv); these types are TypeScript ergonomics.

export type ScriptedQueryCategory =
  | 'first-hit'
  | 'follow-up'
  | 'fallback-trigger'
  | 'safety-net';

export type ScriptedQuery = {
  id: string;
  query: string;
  embedding: number[];
  expected_precedent_ids?: string[];
  category: ScriptedQueryCategory;
  notes?: string;
};

export type OfflineCacheEntry = {
  query: string;
  tagged_stream: string;
  precedent_id: string;
};

export type OfflineCache = {
  entries: OfflineCacheEntry[];
};
