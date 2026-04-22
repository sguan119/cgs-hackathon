// Shared prompt fragments used across the Claude-backed gen scripts.
// Plan §5.9.

export const GRAMMAR_REMINDER = [
  'Emit tags in the Recall stream grammar (docs/recall-stream-grammar.md).',
  'Do not paraphrase — quote verbatim.',
].join(' ');

export const JSON_ONLY_REMINDER = [
  'Return ONLY valid JSON. No markdown fences. No prose before or after the JSON.',
  'No trailing commentary.',
].join(' ');
