// Strategy Wheel dimension registry and bucket helpers for Phase 2B Fellow
// Override. Pure data + pure helpers — no React, no async, no IO.
//
// Reconciled with `lib/methodology/tags.ts` (Phase 2C): the 7 `short`
// labels below form the `strategy_wheel` category subset of
// METHODOLOGY_TAGS. `tests/unit/tags.test.ts` pins this invariant —
// drift fails the test, so content owners must update both files in
// the same commit. CLAUDE.md §3.5.3 still applies: methodology-label
// drift is a demo red line.
//
// Types:
//   - StrategyDimensionId     union of the 7 canonical ids
//   - StrategyDimension       registry entry
//   - OverrideBucket          'low' | 'mid' | 'high'
//   - InertiaKind / Hypothesis types re-exported so `lib/override/*` only
//     needs to import from dims.ts.

import type { WheelScore } from '@/lib/store';

export type StrategyDimensionId =
  | 'external_sensing'
  | 'internal_sensing'
  | 'strategy_formulation'
  | 'transformation_concept'
  | 'strategic_transformation'
  | 'strategic_innovation'
  | 'strategy_governance';

export type StrategyDimension = {
  id: StrategyDimensionId;
  short: string;
  abbr: string;
  // Wheel-position angle in degrees, 0 = top, clockwise. Derived from
  // (i / 7) * 360 so the 7 ids sit at 0/51/103/154/206/257/309.
  angle: number;
  desc: string;
};

type SevenTuple<T> = readonly [T, T, T, T, T, T, T];

export const STRATEGY_WHEEL_DIMS: SevenTuple<StrategyDimension> = Object.freeze([
  {
    id: 'external_sensing',
    short: 'External Sensing',
    abbr: 'EXT',
    angle: 0,
    desc: 'Market, competitor, regulatory signal detection',
  },
  {
    id: 'internal_sensing',
    short: 'Internal Sensing',
    abbr: 'INT',
    angle: 51,
    desc: 'Org health, culture & capability introspection',
  },
  {
    id: 'strategy_formulation',
    short: 'Strategy Formulation',
    abbr: 'FRM',
    angle: 103,
    desc: 'Choice architecture & positioning',
  },
  {
    id: 'transformation_concept',
    short: 'Strategic Transformation Concept',
    abbr: 'TCN',
    angle: 154,
    desc: 'Designing the change model',
  },
  {
    id: 'strategic_transformation',
    short: 'Strategic Transformation',
    abbr: 'TRX',
    angle: 206,
    desc: 'Execution of large-scale change',
  },
  {
    id: 'strategic_innovation',
    short: 'Strategic Innovation',
    abbr: 'INV',
    angle: 257,
    desc: 'Horizon-2 / 3 capability building',
  },
  {
    id: 'strategy_governance',
    short: 'Strategy Governance & Comms',
    abbr: 'GOV',
    angle: 309,
    desc: 'Board, cadence, narrative discipline',
  },
]) as SevenTuple<StrategyDimension>;

export type WheelScores = Partial<Record<StrategyDimensionId, WheelScore>>;

// Seeds on first visit to /diagnostic. `strategic_innovation = 2` is the
// structural-mismatch hero cell per architecture §4.3.
export const DEFAULT_WHEEL_SCORES: Readonly<Record<StrategyDimensionId, WheelScore>> =
  Object.freeze({
    external_sensing: 4,
    internal_sensing: 3,
    strategy_formulation: 5,
    transformation_concept: 3,
    strategic_transformation: 3,
    strategic_innovation: 2,
    strategy_governance: 5,
  });

export type OverrideBucket = 'low' | 'mid' | 'high';

// 1–7 → low(1–2) / mid(3–4) / high(5–7). Closed-inclusive at the top
// edge — score 2 is low, score 3 is mid, score 4 is mid, score 5 is high.
// Out-of-range input clamps: ≤1 → low, ≥7 → high.
export function scoreToBucket(score: number): OverrideBucket {
  if (score <= 2) return 'low';
  if (score <= 4) return 'mid';
  return 'high';
}

// Alias kept for plan §3.3 wording — `toBucket` is the short name used in
// downstream modules; `scoreToBucket` is the one pinned by the team-lead
// brief. Same implementation.
export const toBucket = scoreToBucket;

export function overrideCacheKey(dim: StrategyDimensionId, bucket: OverrideBucket): string {
  return `${dim}:${bucket}`;
}

export function findDim(id: string): StrategyDimension | undefined {
  return STRATEGY_WHEEL_DIMS.find((d) => d.id === id);
}

export function isStrategyDimensionId(id: string): id is StrategyDimensionId {
  return STRATEGY_WHEEL_DIMS.some((d) => d.id === id);
}

// Inertia hypothesis shape — owned by dims.ts so both runtime modules
// (chain, diff) and fixtures share a single source of truth.
export type InertiaKind = 'dominant_logic' | 'structural';

export type InertiaEvidence = {
  source_id: string;
  quote: string;
};

export type InertiaHypothesis = {
  id: string;
  kind: InertiaKind;
  label: string;
  statement: string;
  confidence: number;
  evidence: InertiaEvidence[];
  intervention_ids: string[];
};

export type OverrideCacheEntry = {
  dimension: StrategyDimensionId;
  bucket: OverrideBucket;
  hypotheses: InertiaHypothesis[];
  rationale: string;
  baked_at: string;
};

export type OverrideCache = {
  version: 1;
  entries: OverrideCacheEntry[];
};
