import { describe, expect, it } from 'vitest';
import { STRATEGY_WHEEL_DIMS } from '@/lib/override/dims';
import {
  METHODOLOGY_TAGS,
  allCanonicalPhrases,
  findCanonicalTag,
  isCanonicalTag,
} from '@/lib/methodology/tags';

describe('METHODOLOGY_TAGS — seed invariants', () => {
  it('has the ≥10 canonical seed entries pinned by plan §3.3.1', () => {
    expect(METHODOLOGY_TAGS.length).toBeGreaterThanOrEqual(10);
  });

  it('all canonical labels are unique (case-insensitive)', () => {
    const lower = METHODOLOGY_TAGS.map((t) => t.canonical.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('every tag carries a category and a non-empty sourceRef', () => {
    for (const t of METHODOLOGY_TAGS) {
      expect(t.canonical.length).toBeGreaterThan(0);
      expect(t.category).toBeTruthy();
      expect(t.sourceRef.length).toBeGreaterThan(0);
    }
  });

  it('contains all three methodology pillars (strategy_wheel, inertia, first_mile)', () => {
    const cats = new Set(METHODOLOGY_TAGS.map((t) => t.category));
    expect(cats.has('strategy_wheel')).toBe(true);
    expect(cats.has('inertia')).toBe(true);
    expect(cats.has('first_mile')).toBe(true);
  });
});

describe('isCanonicalTag / findCanonicalTag — matching semantics', () => {
  it('isCanonicalTag is case-insensitive', () => {
    expect(isCanonicalTag('Strategic Innovation')).toBe(true);
    expect(isCanonicalTag('strategic innovation')).toBe(true);
    expect(isCanonicalTag('STRATEGIC INNOVATION')).toBe(true);
  });

  it('trims whitespace from input', () => {
    expect(isCanonicalTag('  First Mile  ')).toBe(true);
  });

  it('alias lookup works (Dominant Logic Inertia → Dominant Logic)', () => {
    const tag = findCanonicalTag('Dominant Logic Inertia');
    expect(tag?.canonical).toBe('Dominant Logic');
  });

  it('Structural Friction alias resolves to Structural Inertia', () => {
    expect(findCanonicalTag('Structural Friction')?.canonical).toBe('Structural Inertia');
  });

  it('bare "Structural" alias resolves to Structural Inertia (plan §3.3.1 L9)', () => {
    expect(isCanonicalTag('Structural')).toBe(true);
    expect(findCanonicalTag('Structural')?.canonical).toBe('Structural Inertia');
    expect(findCanonicalTag('structural')?.canonical).toBe('Structural Inertia');
  });

  it('unknown phrase returns undefined / false', () => {
    expect(findCanonicalTag('Strategy Wheel Innovation')).toBeUndefined();
    expect(isCanonicalTag('Strategy Wheel Innovation')).toBe(false);
    expect(isCanonicalTag('')).toBe(false);
  });

  it('gap-close: isCanonicalTag("Blitz Velocity") returns false (invented phrase)', () => {
    expect(isCanonicalTag('Blitz Velocity')).toBe(false);
    expect(findCanonicalTag('Blitz Velocity')).toBeUndefined();
  });
});

describe('allCanonicalPhrases — for validator alternation build', () => {
  it('includes every canonical + every alias', () => {
    const phrases = allCanonicalPhrases();
    expect(phrases).toContain('Strategic Innovation');
    expect(phrases).toContain('Dominant Logic');
    expect(phrases).toContain('Dominant Logic Inertia');
    expect(phrases).toContain('Structural Friction');
  });
});

// Phase 2B reconciliation per plan §5.1.1 / §7.1. Clears the
// `lib/override/dims.ts` TODO banner by pinning drift as a test failure.
describe('STRATEGY_WHEEL_DIMS ⊂ METHODOLOGY_TAGS (strategy_wheel category)', () => {
  it('every dim `short` label appears as a canonical with category strategy_wheel', () => {
    const wheelCanonicals = new Set(
      METHODOLOGY_TAGS.filter((t) => t.category === 'strategy_wheel').map((t) =>
        t.canonical.toLowerCase()
      )
    );
    for (const d of STRATEGY_WHEEL_DIMS) {
      expect(wheelCanonicals.has(d.short.toLowerCase())).toBe(true);
    }
  });

  it('there are exactly 7 strategy_wheel canonicals (matching the 7-tuple)', () => {
    const count = METHODOLOGY_TAGS.filter((t) => t.category === 'strategy_wheel').length;
    expect(count).toBe(7);
  });
});
