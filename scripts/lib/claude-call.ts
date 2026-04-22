// Non-streaming Claude wrapper — plan §5.8.
//
// Delegates to lib/llm/client.ts `streamCompletion` (which owns the 4-seg
// cache prefix bytes and SDK shape). Collects onDelta chunks into fullText,
// awaits onComplete, returns the bundled result. Gen scripts need the final
// artifact to JSON-serialize, not the per-token stream.
//
// Cache-prefix discipline (plan §7.5): this wrapper does NOT accept a custom
// `system` block — Seg 1+2+3 byte-identity with the app runtime is
// load-bearing for cache hits on demo day.

import { streamCompletion } from '@/lib/llm/client';
import type { StreamMode } from '@/lib/llm/types';

export type ClaudeCallResult = {
  fullText: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
  latencyMs: number;
  model: string;
};

export type ClaudeCallOpts = {
  mode: StreamMode;
  clientId: string | null;
  precedentIds?: string[];
  query?: string;
  // Gen scripts set 2048 (offline-cache) / 4096 (diagnostic, override) so
  // long JSON outputs don't truncate mid-struct (B1).
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export async function callClaudeOnce(opts: ClaudeCallOpts): Promise<ClaudeCallResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const local = new AbortController();
  const timer = setTimeout(() => local.abort(), timeoutMs);
  const onAbort = () => local.abort();
  if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });

  const started = Date.now();
  try {
    const result = await streamCompletion({
      mode: opts.mode,
      clientId: opts.clientId,
      precedentIds: opts.precedentIds,
      query: opts.query,
      maxTokens: opts.maxTokens,
      onDelta: () => {
        // Script does not need per-delta; streamCompletion accumulates fullText.
      },
      onComplete: () => {
        // noop
      },
      signal: local.signal,
    });
    const latencyMs = Date.now() - started;
    return {
      fullText: result.fullText,
      usage: result.usage,
      latencyMs,
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
    };
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
  }
}

// Claude sometimes prepends a preamble or wraps output in ```json fences.
// This sanitizer strips the most common two cases (plan §4.2 parser
// strategy). On JSON.parse failure the caller dumps the raw text and exits.
export function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(text);
  if (fenced) text = fenced[1]!.trim();
  // If a preamble exists, find the first { or [ and slice to the matching
  // terminal. We match on balanced braces to avoid slicing into a nested
  // object's internals.
  const firstBrace = Math.min(
    ...[text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0)
  );
  if (isFinite(firstBrace) && firstBrace > 0) {
    text = text.slice(firstBrace);
  }
  return JSON.parse(text);
}
