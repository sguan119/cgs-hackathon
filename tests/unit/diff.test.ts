import { describe, expect, it } from 'vitest';
import { INITIAL_DIFF_STATE, reduceDiff, type DiffState } from '@/lib/override/diff';
import type { OverrideStreamEvent } from '@/lib/override/override-parser';

function ev(
  field: OverrideStreamEvent['field'],
  value: string | boolean,
  hypothesisId: string | null = null
): OverrideStreamEvent {
  return { field, value, isComplete: true, hypothesisId };
}

describe('reduceDiff — plan §9 O10–O13', () => {
  it('O10: rationale-only event updates rationale slot', () => {
    const s1 = reduceDiff(INITIAL_DIFF_STATE as DiffState, ev('rationale', 'because reasons'));
    expect(s1.rationale).toBe('because reasons');
    expect(s1.incoming).toHaveLength(0);
    expect(s1.done).toBe(false);
  });

  it('O11: hypothesis_end promotes active into incoming[] and clears active', () => {
    let s: DiffState = INITIAL_DIFF_STATE as DiffState;
    s = reduceDiff(s, ev('hypothesis_start', 'h1', 'h1'));
    s = reduceDiff(s, ev('label', 'Label A', 'h1'));
    s = reduceDiff(s, ev('kind', 'structural', 'h1'));
    s = reduceDiff(s, ev('hypothesis_end', true, 'h1'));

    expect(s.active).toBeNull();
    expect(s.incoming).toHaveLength(1);
    expect(s.incoming[0]).toMatchObject({
      id: 'h1',
      kind: 'structural',
      label: 'Label A',
    });
  });

  it('O12: done flips done:true and clears active (mid-hypothesis discard)', () => {
    let s: DiffState = INITIAL_DIFF_STATE as DiffState;
    s = reduceDiff(s, ev('hypothesis_start', 'h-open', 'h-open'));
    s = reduceDiff(s, ev('label', 'unfinished', 'h-open'));
    s = reduceDiff(s, ev('done', true, null));
    expect(s.done).toBe(true);
    expect(s.active).toBeNull();
    // Unfinished hypothesis is NOT promoted.
    expect(s.incoming).toHaveLength(0);
  });

  it('O13: malformed partial (missing kind) is still promoted on hypothesis_end, marked incomplete', () => {
    let s: DiffState = INITIAL_DIFF_STATE as DiffState;
    s = reduceDiff(s, ev('hypothesis_start', 'h-mal', 'h-mal'));
    s = reduceDiff(s, ev('label', 'no kind yet', 'h-mal'));
    s = reduceDiff(s, ev('hypothesis_end', true, 'h-mal'));

    expect(s.incoming).toHaveLength(1);
    const promoted = s.incoming[0]!;
    expect(promoted.id).toBe('h-mal');
    expect(promoted.label).toBe('no kind yet');
    // Missing kind is preserved as undefined — consumer decides render.
    expect(promoted.kind).toBeUndefined();
  });

  it('evidence_quote / evidence_source pair in lockstep', () => {
    let s: DiffState = INITIAL_DIFF_STATE as DiffState;
    s = reduceDiff(s, ev('hypothesis_start', 'h1', 'h1'));
    s = reduceDiff(s, ev('evidence_quote', 'Q1', 'h1'));
    s = reduceDiff(s, ev('evidence_source', 'src-1', 'h1'));
    s = reduceDiff(s, ev('evidence_quote', 'Q2', 'h1'));
    s = reduceDiff(s, ev('evidence_source', 'src-2', 'h1'));
    s = reduceDiff(s, ev('hypothesis_end', true, 'h1'));

    const p = s.incoming[0]!;
    expect(p.evidence).toEqual([
      { source_id: 'src-1', quote: 'Q1' },
      { source_id: 'src-2', quote: 'Q2' },
    ]);
  });

  it('partial events (isComplete:false) are no-ops for diff state', () => {
    const partial: OverrideStreamEvent = {
      field: 'label',
      value: 'partial text',
      isComplete: false,
      hypothesisId: null,
    };
    const s = reduceDiff(INITIAL_DIFF_STATE as DiffState, partial);
    expect(s).toEqual(INITIAL_DIFF_STATE);
  });

  it('intervention_id appends to intervention_ids list', () => {
    let s: DiffState = INITIAL_DIFF_STATE as DiffState;
    s = reduceDiff(s, ev('hypothesis_start', 'h1', 'h1'));
    s = reduceDiff(s, ev('intervention_id', 'int-a', 'h1'));
    s = reduceDiff(s, ev('intervention_id', 'int-b', 'h1'));
    expect(s.active?.intervention_ids).toEqual(['int-a', 'int-b']);
  });

  it('confidence parses numeric string', () => {
    let s: DiffState = INITIAL_DIFF_STATE as DiffState;
    s = reduceDiff(s, ev('hypothesis_start', 'h1', 'h1'));
    s = reduceDiff(s, ev('confidence', '0.72', 'h1'));
    expect(s.active?.confidence).toBeCloseTo(0.72);
  });

  it('events arriving before hypothesis_start are ignored for hypothesis-scoped fields', () => {
    const s = reduceDiff(INITIAL_DIFF_STATE as DiffState, ev('label', 'stray'));
    expect(s.active).toBeNull();
    expect(s.incoming).toHaveLength(0);
  });

  it('rapid successive applyEvent calls on the same turn do not lose events', () => {
    let s: DiffState = INITIAL_DIFF_STATE as DiffState;
    s = reduceDiff(s, ev('hypothesis_start', 'h1', 'h1'));
    s = reduceDiff(s, ev('label', 'L1', 'h1'));
    s = reduceDiff(s, ev('kind', 'structural', 'h1'));
    s = reduceDiff(s, ev('statement', 'S1', 'h1'));
    s = reduceDiff(s, ev('confidence', '0.8', 'h1'));
    s = reduceDiff(s, ev('hypothesis_end', true, 'h1'));
    s = reduceDiff(s, ev('hypothesis_start', 'h2', 'h2'));
    s = reduceDiff(s, ev('label', 'L2', 'h2'));
    s = reduceDiff(s, ev('kind', 'dominant_logic', 'h2'));
    s = reduceDiff(s, ev('hypothesis_end', true, 'h2'));
    s = reduceDiff(s, ev('done', true, null));

    expect(s.incoming).toHaveLength(2);
    expect(s.incoming[0]?.id).toBe('h1');
    expect(s.incoming[1]?.id).toBe('h2');
    expect(s.done).toBe(true);
  });

  it('reducer handles unknown event field gracefully (ignores it)', () => {
    const unknownEv = {
      field: 'not_a_real_field' as OverrideStreamEvent['field'],
      value: 'ignored',
      isComplete: true,
      hypothesisId: null,
    };
    const s = reduceDiff(INITIAL_DIFF_STATE as DiffState, unknownEv);
    expect(s).toEqual(INITIAL_DIFF_STATE);
  });
});
