// Builders for the 4-segment prompt-cache pipeline described in
// architecture.md §4.
//
//   Seg 1 — Framework         (cache breakpoint)
//   Seg 2 — Precedents         (cache breakpoint)
//   Seg 3 — Acme context       (cache breakpoint; null when clientId !== 'acme')
//   Seg 4 — Dynamic user turn  (not cached)
//
// **Cache-key invariant**: Seg 1 / 2 / 3 must be byte-identical across
// calls once the app has booted. Any whitespace drift invalidates the
// cache. The Phase 1 stubs are frozen with `Object.freeze` on the exported
// objects so consumers can't mutate them; content owners will replace the
// TODO text in Phase 2C / Phase 3.

import type { CacheSegmentSpec } from './types';

// TODO (Phase 2C content owner): replace with full CGS Strategy Wheel 7-dim
// canon + Dominant Logic + Structural Inertia + First Mile from
// lib/methodology/tags.ts. The size here is a couple KB so cache-hit
// measurements in the exit gate are realistic.
const SEG1_FRAMEWORK = `# CGS Strategic Framework (Phase 1 stub)

## Strategy Wheel — 7 dimensions
1. Purpose
2. Market
3. Offering
4. Economic engine
5. Organization
6. Execution rhythm
7. Evidence of impact

## Dominant Logic
The unspoken cause-and-effect story the leadership team reaches for when
under pressure. Naming it is the first diagnostic move; replacing it is
the hardest.

## Structural Inertia
The residue of past strategic choices — reporting lines, incentive design,
procurement contracts, asset footprint — that keeps the current operating
model stable even when the thesis has moved.

## First Mile
The first 90 days of a new mandate: where priority, sequencing, and the
stop-doing list get fought over. Getting the first mile wrong pays
compounding interest for the remainder of the engagement.

---
This stub text is sized to be representative (~1–2 KB) so the prompt-cache
hit assertion in the Phase 1 exit gate measures something real.`;

// TODO (Phase 3.A content owner): replace with concatenated content fields
// from the full ~15-precedent library. Phase 1 reads the example fixture
// for the shape; real content lands with the corpus build.
const SEG2_PRECEDENTS = `# CGS Precedent Library (Phase 1 stub)

## Globex — 2018 (CDO reporting-line case, hero precedent)
Structural-inertia diagnosis: the newly created Chief Data Officer
reported into the CIO, which reproduced the same bottleneck the role was
chartered to remove. CGS recommended dual-line reporting into the CEO
with a tripwire review at 90 days.

## Initech — 2019 (operating-model refit)
Dominant-logic intervention: leadership narrative conflated 'growth' with
'headcount'. The refit reframed growth around unit economics, forcing an
unwinding of three parallel go-to-market motions.

---
Additional precedents deferred to Phase 3.A. Sized to a couple KB so the
cache-read assertion is meaningful during the Phase 1 exit gate.`;

// TODO (content owner): replace with the sealed Acme fixture text.
// Returning `null` when clientId !== 'acme' is LOAD-BEARING — it means the
// message array has one fewer entry, which keeps the cache prefix
// byte-identical for the non-Acme path.
const SEG3_ACME_CONTEXT = `# Acme Industrial — sealed engagement context (Phase 1 stub)

Industry-neutral framing per PRD §3.7 — no sector-specific language.

- Engagement codename: Acme Industrial
- Fellow of record: D. Park
- Current phase: Pre-RFP, advancing toward M2 (second-meeting readiness)
- Prior CGS touchpoints: advisory ping 2024-Q4; executive read-out 2025-Q1
- Known thesis tensions: structural inertia around procurement; first-mile
  sequencing contested between operations and finance leadership

---
Phase 2C will replace this with the frozen Acme text.`;

// Memoized frozen singletons — identity equality is stable across calls so
// the SDK sees byte-identical system blocks on every cache lookup. Seg 3 is
// keyed by client id so a future multi-client world stays cache-correct;
// Phase 1 only uses 'acme' but the keyed pattern is free.

let seg1Cached: Readonly<CacheSegmentSpec> | null = null;
let seg2Cached: Readonly<CacheSegmentSpec> | null = null;
const seg3Cache = new Map<string, Readonly<CacheSegmentSpec>>();

export function buildSeg1Framework(): Readonly<CacheSegmentSpec> {
  if (!seg1Cached) {
    seg1Cached = Object.freeze({ text: SEG1_FRAMEWORK, cache: true });
  }
  return seg1Cached;
}

export function buildSeg2Precedents(): Readonly<CacheSegmentSpec> {
  if (!seg2Cached) {
    seg2Cached = Object.freeze({ text: SEG2_PRECEDENTS, cache: true });
  }
  return seg2Cached;
}

export function buildSeg3AcmeContext(clientId: string | null): Readonly<CacheSegmentSpec> | null {
  if (clientId !== 'acme') return null;
  const existing = seg3Cache.get(clientId);
  if (existing) return existing;
  const frozen = Object.freeze({ text: SEG3_ACME_CONTEXT, cache: true });
  seg3Cache.set(clientId, frozen);
  return frozen;
}

export function buildSeg4Dynamic(query: string | undefined, precedentIds: string[] = []): string {
  const q = (query ?? '').trim();
  if (precedentIds.length === 0) return q || 'ping';
  return `${q || 'ping'}\n\n[precedent refs: ${precedentIds.join(', ')}]`;
}
