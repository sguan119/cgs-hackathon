// Prefix-match autocomplete against the scripted-queries pool.
// Case-insensitive, caps at 5 matches, preserves declaration order.

import type { ScriptedQuery } from './fixture-types';

const MAX_RESULTS = 5;
const MIN_CHARS = 2;

export function matchPrefix(input: string, pool: ScriptedQuery[]): ScriptedQuery[] {
  const trimmed = input.trim();
  if (trimmed.length < MIN_CHARS) return [];
  const needle = trimmed.toLowerCase();
  const matches: ScriptedQuery[] = [];
  for (const q of pool) {
    if (q.query.toLowerCase().startsWith(needle)) {
      matches.push(q);
      if (matches.length >= MAX_RESULTS) break;
    }
  }
  return matches;
}
