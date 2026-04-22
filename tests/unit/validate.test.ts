import { describe, expect, it } from 'vitest';
import { validate } from '@/lib/toneguard/validate';

// Minimal helper: build a body with the three required section headers
// using the canonical wording. Callers append the interesting content.
// Reviewer-3 N1: the helper embeds "Strategic Innovation" and "Dominant
// Logic" — both canonical methodology tags — so rule 3c
// (no_methodology_tag) never fires on helper-built bodies. This is
// intentional: it lets per-rule tests isolate exactly one rule without
// contamination from the methodology-coverage rule. Tests that DO need
// "no canonical tag" (T7, T9) build their body inline without this helper.
function withAllSections(prefix: string, mid = '', tail = ''): string {
  return (
    `${prefix}\n\n` +
    `What We're Seeing\n` +
    `The team is learning fast.\n\n` +
    `${mid}\n\n` +
    `Quick Pulse Check\n` +
    `We are tracking Strategic Innovation and Dominant Logic drift.\n\n` +
    `${tail}\n\n` +
    `Preliminary Read\n` +
    `Recommend next review Tuesday.`
  );
}

describe('validate() — T1..T12 matrix (plan §6.2)', () => {
  it('T1: clean pass — 3 sections + canonical tags + no blacklist', () => {
    const body = withAllSections('Hi D. — quick note.');
    const r = validate(body);
    expect(r.verdict).toBe('pass');
    expect(r.reasons).toHaveLength(0);
  });

  it('T2: single blacklist high hit on "Proposal"', () => {
    const body = withAllSections('Following up on our last Proposal.');
    const r = validate(body);
    expect(r.verdict).toBe('high-risk');
    const hit = r.reasons.find((x) => x.rule === 'sales_blacklist');
    expect(hit).toBeDefined();
    expect(body.slice(hit!.spanStart!, hit!.spanEnd!)).toBe('Proposal');
  });

  it('T3: single borderline soft-hit on "follow up"', () => {
    const body = withAllSections('Happy to follow up next week.');
    const r = validate(body);
    expect(r.verdict).toBe('borderline');
    expect(r.reasons.some((x) => x.rule === 'sales_soft_hit')).toBe(true);
    expect(r.reasons.every((x) => x.severity === 'borderline')).toBe(true);
  });

  it('T4: all sections present but wrong order → single out_of_order_section', () => {
    const body =
      'Preliminary Read\nRead first.\n\n' +
      'Quick Pulse Check\nPulse.\n\n' +
      "What We're Seeing\nSeeing. Strategic Innovation.";
    const r = validate(body);
    expect(r.verdict).toBe('high-risk');
    const oo = r.reasons.filter((x) => x.rule === 'out_of_order_section');
    expect(oo).toHaveLength(1);
    expect(r.reasons.some((x) => x.rule === 'missing_section')).toBe(false);
  });

  it('T5: one section missing → missing_section emitted for the absent header', () => {
    const body =
      "What We're Seeing\nHere is what we see. Strategic Innovation matters.\n\n" +
      'Preliminary Read\nTuesday.';
    const r = validate(body);
    expect(r.verdict).toBe('high-risk');
    const missing = r.reasons.filter((x) => x.rule === 'missing_section');
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain('Quick Pulse Check');
  });

  it('T6: unknown methodology-shaped phrase "Strategy Wheel Innovation" flagged', () => {
    const body = withAllSections(
      'Quick ask — can you review the Strategy Wheel Innovation doc?'
    );
    const r = validate(body);
    expect(r.verdict).toBe('high-risk');
    const unknown = r.reasons.find((x) => x.rule === 'unknown_methodology_tag');
    expect(unknown).toBeDefined();
    expect(body.slice(unknown!.spanStart!, unknown!.spanEnd!)).toContain(
      'Strategy Wheel Innovation'
    );
  });

  it('T7: no canonical methodology tag at all → borderline', () => {
    const body =
      "What We're Seeing\nThe team moved fast.\n\n" +
      'Quick Pulse Check\nAll good.\n\n' +
      'Preliminary Read\nSee you Tuesday.';
    const r = validate(body);
    expect(r.verdict).toBe('borderline');
    expect(r.reasons.some((x) => x.rule === 'no_methodology_tag')).toBe(true);
  });

  it('T8: combo — blacklist high + missing section', () => {
    const body =
      "What We're Seeing\nWe landed the Deal. Strategic Innovation matters.\n\n" +
      'Quick Pulse Check\nSteady.';
    const r = validate(body);
    expect(r.verdict).toBe('high-risk');
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
    expect(r.reasons.some((x) => x.rule === 'sales_blacklist')).toBe(true);
    expect(r.reasons.some((x) => x.rule === 'missing_section')).toBe(true);
  });

  it('T9: combo — borderline soft "circle back" + no methodology tag', () => {
    const body =
      "What We're Seeing\nWe should circle back on this item.\n\n" +
      'Quick Pulse Check\nok.\n\n' +
      'Preliminary Read\nTuesday.';
    const r = validate(body);
    expect(r.verdict).toBe('borderline');
    expect(r.reasons.some((x) => x.rule === 'sales_soft_hit')).toBe(true);
    expect(r.reasons.some((x) => x.rule === 'no_methodology_tag')).toBe(true);
    expect(r.reasons.every((x) => x.severity === 'borderline')).toBe(true);
  });

  it('T10: Unicode apostrophe (U+2019) in "What We\u2019re Seeing" still recognized', () => {
    const body =
      'What We\u2019re Seeing\nStrategic Innovation note.\n\n' +
      'Quick Pulse Check\nok.\n\n' +
      'Preliminary Read\nTuesday.';
    const r = validate(body);
    expect(r.verdict).toBe('pass');
    expect(r.reasons.some((x) => x.rule === 'missing_section')).toBe(false);
  });

  it('T11: multiple blacklist hits on same pattern → distinct spans', () => {
    const body = withAllSections('Proposal A vs Proposal B vs Proposal C.');
    const r = validate(body);
    expect(r.verdict).toBe('high-risk');
    const proposalHits = r.reasons.filter(
      (x) => x.rule === 'sales_blacklist' && /Proposal/i.test(x.message)
    );
    expect(proposalHits.length).toBe(3);
    const spans = proposalHits.map((h) => h.spanStart);
    expect(new Set(spans).size).toBe(3);
  });

  it('T12: empty string → 3 missing_section + 1 no_methodology_tag', () => {
    const r = validate('');
    expect(r.verdict).toBe('high-risk');
    expect(r.reasons.filter((x) => x.rule === 'missing_section')).toHaveLength(3);
    expect(r.reasons.some((x) => x.rule === 'no_methodology_tag')).toBe(true);
  });
});

describe('validate() — verdict composition pin (§4.3)', () => {
  it('high + borderline in the same input → verdict = high-risk', () => {
    const body = withAllSections('Proposal. We should circle back.');
    const r = validate(body);
    expect(r.verdict).toBe('high-risk');
    expect(r.reasons.some((x) => x.severity === 'high')).toBe(true);
    expect(r.reasons.some((x) => x.severity === 'borderline')).toBe(true);
  });
});

describe('validate() — edge cases (gap-close)', () => {
  it('body with only whitespace → returns result without crashing', () => {
    const r = validate('   \t\n  ');
    expect(r).toBeDefined();
    expect(r.verdict).toBeDefined();
    expect(Array.isArray(r.reasons)).toBe(true);
  });

  it('body with ONLY section headers and no body content → missing_headers false, may flag no_methodology_tag', () => {
    const body = "What We're Seeing\nQuick Pulse Check\nPreliminary Read";
    const r = validate(body);
    expect(r.reasons.some((x) => x.rule === 'missing_section')).toBe(false);
    expect(r.reasons.some((x) => x.rule === 'no_methodology_tag')).toBe(true);
  });

  it('very long body (10KB) → completes in <50ms', () => {
    const filler = 'The team is learning fast. '.repeat(400);
    const body = withAllSections(filler);
    const start = performance.now();
    validate(body);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('section headers in reverse order → flags out_of_order_section (or missing_section if not recognized)', () => {
    const body =
      'Preliminary Read\nRead first. Strategic Innovation.\n\n' +
      'Quick Pulse Check\nPulse.\n\n' +
      "What We're Seeing\nSeeing.";
    const r = validate(body);
    const hasOoo = r.reasons.some((x) => x.rule === 'out_of_order_section');
    expect(hasOoo).toBe(true);
  });

  it('duplicate section headers → does not crash; both duplicates detected', () => {
    const body =
      "What We're Seeing\nFirst mention. Strategic Innovation.\n\n" +
      'Quick Pulse Check\nPulse.\n\n' +
      'Preliminary Read\nFirst read.\n\n' +
      "What We're Seeing\nDuplicate mention.";
    expect(() => validate(body)).not.toThrow();
    const r = validate(body);
    expect(r).toBeDefined();
    expect(Array.isArray(r.reasons)).toBe(true);
  });

  it('curly quotes (U+2019) in section header "What We\u2019re Seeing" → recognized (no missing_section)', () => {
    const body =
      'What We\u2019re Seeing\nContent here. Strategic Innovation.\n\n' +
      'Quick Pulse Check\nPulse.\n\n' +
      'Preliminary Read\nTuesday.';
    const r = validate(body);
    expect(r.reasons.some((x) => x.rule === 'missing_section')).toBe(false);
  });
});
