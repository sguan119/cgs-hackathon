import { describe, it, expect } from 'vitest';
import { buildFollowupContext, type FollowupTurn } from '@/lib/llm/followup';

function mkTurn(q: string, precedentId: string | null, firstTag = 'Structural Inertia'): FollowupTurn {
  return {
    query: q,
    card: {
      year: '2018',
      client: 'Globex',
      scene: 'CDO reporting-line',
      quotes: ['one quote'],
      tags: [firstTag],
    },
    precedentId,
  };
}

describe('buildFollowupContext', () => {
  it('returns empty string when no prior turns', () => {
    expect(buildFollowupContext([])).toBe('');
  });

  it('keeps ≤3 turns verbatim without summary line', () => {
    const out = buildFollowupContext([
      mkTurn('q1', 'globex-2018-cdo'),
      mkTurn('q2', 'globex-2018-cdo'),
      mkTurn('q3', 'globex-2018-cdo'),
    ]);
    expect(out).toContain('Q: q1');
    expect(out).toContain('Q: q2');
    expect(out).toContain('Q: q3');
    expect(out).not.toContain('Earlier turns');
  });

  it('collapses older turns into one summary line when >3', () => {
    const out = buildFollowupContext([
      mkTurn('qold1', 'globex-2018-cdo'),
      mkTurn('qold2', 'initech-2019-refit', 'Dominant Logic'),
      mkTurn('q2', 'globex-2018-cdo'),
      mkTurn('q3', 'globex-2018-cdo'),
      mkTurn('q4', 'globex-2018-cdo'),
    ]);
    expect(out).toContain('Earlier turns (2)');
    expect(out).toContain('globex-2018-cdo');
    expect(out).toContain('initech-2019-refit');
    expect(out).toContain('Q: q2');
    expect(out).toContain('Q: q3');
    expect(out).toContain('Q: q4');
    expect(out).not.toContain('Q: qold1');
  });

  it('starts with the follow-up instruction header', () => {
    const out = buildFollowupContext([mkTurn('q1', 'globex-2018-cdo')]);
    expect(out.startsWith('Follow-up')).toBe(true);
  });

  it('tolerates null precedentId in older-turns summary', () => {
    const out = buildFollowupContext([
      { query: 'qold', card: { year: null, client: null, scene: null, quotes: [], tags: [] }, precedentId: null },
      mkTurn('q1', 'globex-2018-cdo'),
      mkTurn('q2', 'globex-2018-cdo'),
      mkTurn('q3', 'globex-2018-cdo'),
    ]);
    expect(out).toContain('Earlier turns (1)');
  });

  it('10 prior turns → last 3 verbatim, 7 in summary line; total length within plan budget', () => {
    const turns = Array.from({ length: 10 }, (_, i) =>
      mkTurn(`question-${i}`, `precedent-${i % 3}`)
    );
    const out = buildFollowupContext(turns);
    // Last 3 verbatim
    expect(out).toContain('Q: question-7');
    expect(out).toContain('Q: question-8');
    expect(out).toContain('Q: question-9');
    // Older 7 collapsed into one summary
    expect(out).toContain('Earlier turns (7)');
    // Older queries do not appear verbatim
    expect(out).not.toContain('Q: question-0');
    expect(out).not.toContain('Q: question-6');
    // Plan budget: keepings this rough — 4KB cap as a loose check
    expect(out.length).toBeLessThan(4096);
    // Single summary line (not multiple)
    const summaryLineCount = out.split('\n').filter((l) => l.startsWith('Earlier turns')).length;
    expect(summaryLineCount).toBe(1);
  });
});
