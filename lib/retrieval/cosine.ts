// Cosine top-k retrieval. We compute `dot / (|q| · |p|)` in full rather
// than assume unit-normalized inputs — OpenAI's `text-embedding-3-small`
// happens to be unit-length, but owning the math guards against a silent
// wrong answer if the embedder is ever swapped.

import type { Precedent } from './types';

export type ScoredPrecedent = {
  precedent: Precedent;
  score: number;
};

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

function norm(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i]! * v[i]!;
  return Math.sqrt(sum);
}

export function cosineTopK(
  queryEmbedding: number[],
  precedents: Precedent[],
  k = 3
): ScoredPrecedent[] {
  const qNorm = norm(queryEmbedding);
  if (qNorm === 0) return [];

  const scored: Array<ScoredPrecedent & { index: number }> = [];
  for (let i = 0; i < precedents.length; i++) {
    const p = precedents[i]!;
    if (p.embedding.length === 0) continue;
    if (p.embedding.length !== queryEmbedding.length) {
      throw new Error(
        `cosineTopK: dimension mismatch for ${p.id} (got ${p.embedding.length}, expected ${queryEmbedding.length})`
      );
    }
    const pNorm = norm(p.embedding);
    if (pNorm === 0) continue;
    const score = dot(queryEmbedding, p.embedding) / (qNorm * pNorm);
    scored.push({ precedent: p, score, index: i });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.slice(0, k).map(({ precedent, score }) => ({ precedent, score }));
}
