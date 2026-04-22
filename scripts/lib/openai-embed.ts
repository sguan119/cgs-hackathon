// Batched OpenAI /v1/embeddings caller — plan §5.7 / §3.5.
// Reuses the fetch + Authorization pattern from lib/retrieval/embed.ts but
// with array input so 15 precedents embed in a single HTTP call.

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_TIMEOUT_MS = 60_000;
// OpenAI /v1/embeddings input array limit.
export const OPENAI_BATCH_MAX = 2048;

export type EmbedItem = { key: string; text: string };

export type EmbedBatchResult = {
  embeddings: Array<{ key: string; vector: number[] }>;
  usage: { promptTokens: number; totalTokens: number };
  model: string;
};

export type EmbedBatchOpts = {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type OpenAiEmbedResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  model?: string;
  usage?: { prompt_tokens?: number; total_tokens?: number };
};

async function singleCall(
  items: EmbedItem[],
  opts: EmbedBatchOpts
): Promise<EmbedBatchResult> {
  const { apiKey, model } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await doFetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: items.map((i) => i.text) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err: Error & { status?: number } = new Error(
        `OpenAI embed failed: ${res.status}`
      );
      err.status = res.status;
      throw err;
    }
    const body = (await res.json()) as OpenAiEmbedResponse;
    const data = body.data ?? [];
    if (data.length !== items.length) {
      throw new Error(
        `OpenAI embed: expected ${items.length} vectors, got ${data.length}`
      );
    }
    const embeddings = data.map((d, i) => {
      const vector = d.embedding;
      if (!vector || vector.length === 0) {
        throw new Error(`OpenAI embed: empty vector at index ${i}`);
      }
      // OpenAI returns vectors in input order; key by items[i].key.
      return { key: items[i]!.key, vector };
    });
    return {
      embeddings,
      usage: {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        totalTokens: body.usage?.total_tokens ?? 0,
      },
      model: body.model ?? model,
    };
  } finally {
    clearTimeout(timeout);
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
  }
}

// Chunks on OPENAI_BATCH_MAX so a >2048-item input stays correct. Expected
// to be exercised only in tests; the real corpora are far under the cap.
export async function embedBatch(
  items: EmbedItem[],
  opts: EmbedBatchOpts
): Promise<EmbedBatchResult> {
  if (items.length === 0) {
    return {
      embeddings: [],
      usage: { promptTokens: 0, totalTokens: 0 },
      model: opts.model,
    };
  }
  if (items.length <= OPENAI_BATCH_MAX) {
    return singleCall(items, opts);
  }
  const embeddings: Array<{ key: string; vector: number[] }> = [];
  let promptTokens = 0;
  let totalTokens = 0;
  let model = opts.model;
  for (let start = 0; start < items.length; start += OPENAI_BATCH_MAX) {
    const chunk = items.slice(start, start + OPENAI_BATCH_MAX);
    const r = await singleCall(chunk, opts);
    embeddings.push(...r.embeddings);
    promptTokens += r.usage.promptTokens;
    totalTokens += r.usage.totalTokens;
    model = r.model;
  }
  return { embeddings, usage: { promptTokens, totalTokens }, model };
}
