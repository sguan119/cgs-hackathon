import { describe, expect, it } from 'vitest';
import passFixture from '@/fixtures/continuity_fixtures/pass.json';
import borderlineFixture from '@/fixtures/continuity_fixtures/borderline.json';
import highRiskFixture from '@/fixtures/continuity_fixtures/high-risk.json';
import { validate } from '@/lib/toneguard/validate';
import type { Verdict } from '@/lib/toneguard/types';

type Fixture = { id: string; body: string; expected_verdict: Verdict };

// Plan §6.3: fixture-contract test. Edits to `body` that drift the
// verdict away from `expected_verdict` fail loudly.
const FIXTURES: Fixture[] = [passFixture, borderlineFixture, highRiskFixture] as Fixture[];

describe('continuity_fixtures — verdict contract (§6.3)', () => {
  for (const f of FIXTURES) {
    it(`${f.id}.json: validate(body).verdict === expected_verdict (${f.expected_verdict})`, () => {
      const r = validate(f.body);
      expect(r.verdict).toBe(f.expected_verdict);
    });
  }
});

describe('continuity_fixtures — schema fields (gap-close)', () => {
  const REQUIRED_FIELDS = ['id', 'to', 'subject', 'body', 'expected_verdict'] as const;

  it('all fixtures have all required schema fields', () => {
    for (const f of FIXTURES) {
      for (const field of REQUIRED_FIELDS) {
        expect((f as Record<string, unknown>)[field]).toBeDefined();
      }
    }
  });

  it('body field is non-empty for all fixtures', () => {
    for (const f of FIXTURES) {
      expect(typeof f.body).toBe('string');
      expect(f.body.trim().length).toBeGreaterThan(0);
    }
  });
});
