// Phase 2C canonical CGS methodology vocabulary — the single source of
// truth for Tone Guard's whitelist and future surfaces that render
// methodology labels (Phase 4 dashboard / data hub / etc).
// Plan: docs/phase-plans/phase-2c-plan.md §3.3, seeded per §3.3.1.

export type MethodologyCategory =
  | 'strategy_wheel'
  | 'inertia'
  | 'first_mile'
  | 'connecting_world'
  | 'archetype';

export type MethodologyTag = {
  canonical: string;
  category: MethodologyCategory;
  aliases?: readonly string[];
  sourceRef: string;
};

export const METHODOLOGY_TAGS: readonly MethodologyTag[] = Object.freeze([
  {
    canonical: 'External Sensing',
    category: 'strategy_wheel',
    sourceRef: 'CGS_Slides_3_4 p.7',
  },
  {
    canonical: 'Internal Sensing',
    category: 'strategy_wheel',
    sourceRef: 'CGS_Slides_3_4 p.7',
  },
  {
    canonical: 'Strategy Formulation',
    category: 'strategy_wheel',
    sourceRef: 'CGS_Slides_3_4 p.7',
  },
  {
    canonical: 'Strategic Transformation Concept',
    category: 'strategy_wheel',
    sourceRef: 'CGS_Slides_3_4 p.7',
  },
  {
    canonical: 'Strategic Transformation',
    category: 'strategy_wheel',
    sourceRef: 'CGS_Slides_3_4 p.7',
  },
  {
    canonical: 'Strategic Innovation',
    category: 'strategy_wheel',
    sourceRef: 'CGS_Slides_3_4 p.7',
  },
  {
    canonical: 'Strategy Governance & Comms',
    category: 'strategy_wheel',
    aliases: ['Strategy Governance and Comms', 'Strategy Governance'],
    sourceRef: 'CGS_Slides_3_4 p.7',
  },
  {
    canonical: 'Dominant Logic',
    category: 'inertia',
    aliases: ['Dominant Logic Inertia'],
    sourceRef: 'cgs.com/about',
  },
  {
    canonical: 'Structural Inertia',
    category: 'inertia',
    // Plan §3.3.1 L9: aliases include bare 'Structural' so an email that
    // writes "Structural friction is blocking rollout" resolves to the
    // canonical tag (rather than triggering unknown_methodology_tag on
    // the capitalized-run heuristic). PRD §3.5.3 red line — methodology
    // misuse catch must be tight.
    aliases: ['Structural', 'Structural Friction'],
    sourceRef: 'cgs.com/about',
  },
  {
    canonical: 'First Mile',
    category: 'first_mile',
    sourceRef: 'cgs.com/about',
  },
]) as readonly MethodologyTag[];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function allCanonicalPhrases(): string[] {
  const out: string[] = [];
  for (const t of METHODOLOGY_TAGS) {
    out.push(t.canonical);
    if (t.aliases) out.push(...t.aliases);
  }
  return out;
}

export function findCanonicalTag(phrase: string): MethodologyTag | undefined {
  const needle = norm(phrase);
  if (!needle) return undefined;
  for (const t of METHODOLOGY_TAGS) {
    if (norm(t.canonical) === needle) return t;
    if (t.aliases) {
      for (const a of t.aliases) {
        if (norm(a) === needle) return t;
      }
    }
  }
  return undefined;
}

export function isCanonicalTag(phrase: string): boolean {
  return findCanonicalTag(phrase) !== undefined;
}
