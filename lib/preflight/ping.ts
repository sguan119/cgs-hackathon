// Pre-flight connectivity checks for the demo host.
//
// Anthropic ping: a 5-token `messages.create` call — proves both API key
// and network path. Used as the entry gate (architecture.md §5.1).
// OpenAI ping: a single `/v1/embeddings` call via raw fetch so we don't
// pull in the OpenAI SDK just for a health check.

import Anthropic from '@anthropic-ai/sdk';

export type PingResult = {
  ok: boolean;
  latencyMs: number;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_PREFLIGHT_TIMEOUT_MS ?? 5000);

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    promise
      .then((value) => {
        clearTimeout(id);
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(id);
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      });
  });
}

export async function pingAnthropic(signal?: AbortSignal): Promise<PingResult> {
  const started = performance.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, latencyMs: 0, error: 'ANTHROPIC_API_KEY missing in .env.local' };
  }
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    await withTimeout(
      client.messages.create(
        {
          model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        },
        signal ? { signal } : undefined
      ),
      DEFAULT_TIMEOUT_MS,
      signal
    );
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function pingOpenAI(signal?: AbortSignal): Promise<PingResult> {
  const started = performance.now();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, latencyMs: 0, error: 'OPENAI_API_KEY missing in .env.local' };
  }
  const model = process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small';
  try {
    const res = await withTimeout(
      fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: 'ping' }),
        signal,
      }),
      DEFAULT_TIMEOUT_MS,
      signal
    );
    if (!res.ok) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        error: `HTTP ${res.status}`,
      };
    }
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
