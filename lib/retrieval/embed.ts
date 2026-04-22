// Query embedding + keyword-cosine fallback.
//
// Primary path: OpenAI text-embedding-3-small via fetch with a 5s timeout.
// Key surface note: the bundled OPENAI_API_KEY ships in the static export
// (architecture.md §5) — only acceptable for the single-host Tauri demo.
// Do NOT reuse this pattern in a web deployment.
//
// Fallback path: keyword cosine over a per-query ad-hoc vocabulary. We do
// not try to align dimensionality with the 1536-d precedent embeddings —
// instead `cosineByKeyword` returns `ScoredPrecedent[]` directly so
// callers branch at the chain level.

import { cosineTopK, type ScoredPrecedent } from './cosine';
import type { Precedent } from './types';

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_TIMEOUT_MS = 5_000;
const TOKEN_RE = /[^a-z0-9]+/;

export async function embedQuery(query: string, signal?: AbortSignal): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const model = process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  // Chain the external signal: aborting either aborts the fetch.
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: query }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status}`);
    const body = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const emb = body.data?.[0]?.embedding;
    if (!emb || emb.length === 0) throw new Error('OpenAI embed: empty response');
    return emb;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(TOKEN_RE).filter((t) => t.length > 0);
}

function precedentText(p: Precedent): string {
  return [p.summary, p.scene, p.key_quotes.join(' '), p.cgs_tags.join(' ')].join(' ');
}

export function cosineByKeyword(
  query: string,
  precedents: Precedent[],
  k = 3
): ScoredPrecedent[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0 || precedents.length === 0) return [];

  // Build shared vocab: query tokens + each precedent's tokens.
  const vocab: string[] = [];
  const vocabIdx = new Map<string, number>();
  function addTok(t: string): void {
    if (!vocabIdx.has(t)) {
      vocabIdx.set(t, vocab.length);
      vocab.push(t);
    }
  }
  qTokens.forEach(addTok);
  const pTokens: string[][] = precedents.map((p) => tokenize(precedentText(p)));
  pTokens.forEach((toks) => toks.forEach(addTok));

  function bag(toks: string[]): number[] {
    const v = new Array<number>(vocab.length).fill(0);
    for (const t of toks) {
      const idx = vocabIdx.get(t);
      if (idx !== undefined) v[idx] = (v[idx] ?? 0) + 1;
    }
    return v;
  }

  const qVec = bag(qTokens);
  // Build Precedent-ish entries whose embeddings are the per-precedent bag
  // vectors, then reuse cosineTopK for the scoring/sorting work.
  const shimPrecedents: Precedent[] = precedents.map((p, i) => ({
    ...p,
    embedding: bag(pTokens[i]!),
  }));
  return cosineTopK(qVec, shimPrecedents, k);
}
