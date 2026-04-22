import { describe, expect, it } from 'vitest';
import { SALES_BLACKLIST } from '@/lib/methodology/sales-blacklist';

describe('SALES_BLACKLIST — seed invariants', () => {
  it('has the ≥15 seed patterns pinned by plan §3.4.1', () => {
    expect(SALES_BLACKLIST.length).toBeGreaterThanOrEqual(15);
  });

  it('ids are unique', () => {
    const ids = SALES_BLACKLIST.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a RegExp pattern and a valid severity', () => {
    for (const e of SALES_BLACKLIST) {
      expect(e.pattern).toBeInstanceOf(RegExp);
      expect(['high', 'borderline']).toContain(e.severity);
    }
  });

  it('has at least 8 high-severity and at least 7 borderline entries (plan §3.4.1 bucket mix)', () => {
    const high = SALES_BLACKLIST.filter((e) => e.severity === 'high').length;
    const borderline = SALES_BLACKLIST.filter((e) => e.severity === 'borderline').length;
    expect(high).toBeGreaterThanOrEqual(8);
    expect(borderline).toBeGreaterThanOrEqual(7);
  });
});

describe('SALES_BLACKLIST — pattern quality checks (gap-close)', () => {
  it('each high-severity pattern matches at least one real-world phrase', () => {
    const REAL_WORLD_PHRASES: Record<string, string> = {
      'bl-lead': 'We have several Leads to discuss.',
      'bl-proposal': 'I sent over the Proposal yesterday.',
      'bl-deal': 'The Deal is progressing well.',
      'bl-pipeline': 'Our Pipeline looks healthy.',
      'bl-customer': 'The Customer requested a follow-up.',
      'bl-rfp': 'We received an RFP from Acme.',
      'bl-sales-follow-up': 'This is our sales-follow-up note.',
      'bl-sales-push': 'Avoid the sales-push framing.',
    };
    for (const entry of SALES_BLACKLIST.filter((e) => e.severity === 'high')) {
      const phrase = REAL_WORLD_PHRASES[entry.id];
      if (phrase) {
        expect(entry.pattern.test(phrase)).toBe(true);
      }
    }
  });

  it('no pattern matches a whitespace-only string', () => {
    const WHITESPACE = '   \t\n  ';
    for (const entry of SALES_BLACKLIST) {
      expect(entry.pattern.test(WHITESPACE)).toBe(false);
    }
  });

  it('no pattern has ReDoS — worst-case per-pattern input runs in <10ms', () => {
    for (const entry of SALES_BLACKLIST) {
      const worstCase = entry.pattern.source.replace(/\\b/g, '').slice(0, 20);
      const input = 'a'.repeat(5000) + worstCase + 'a'.repeat(5000);
      const start = performance.now();
      new RegExp(entry.pattern.source, 'i').test(input);
      expect(performance.now() - start).toBeLessThan(10);
    }
  });
});

describe('SALES_BLACKLIST — no catastrophic backtracking on worst-case input', () => {
  // 20k-char worst-case: "Proposal" sandwiched between long runs of
  // filler so any unbounded `.*` or nested-quantifier pattern would
  // freeze. Plan §7.2 budget: <5 ms per pattern per input.
  const WORST_CASE = 'a'.repeat(10_000) + ' Proposal ' + 'a'.repeat(10_000);
  const BUDGET_MS = 5;

  for (const entry of SALES_BLACKLIST) {
    it(`${entry.id} pattern runs in <${BUDGET_MS}ms on 20k-char input`, () => {
      const started = performance.now();
      // `exec` in a while loop — identical to how validate.ts collects
      // all match spans — so perf check mirrors real hot-path work.
      const re = new RegExp(entry.pattern.source, entry.pattern.flags.includes('g')
        ? entry.pattern.flags
        : entry.pattern.flags + 'g');
      let safety = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(WORST_CASE)) !== null) {
        if (++safety > 1000) break;
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      const elapsed = performance.now() - started;
      expect(elapsed).toBeLessThan(BUDGET_MS);
    });
  }
});
