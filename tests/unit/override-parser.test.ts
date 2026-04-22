import { describe, expect, it } from 'vitest';
import {
  OverrideStreamParser,
  type OverrideStreamEvent,
} from '@/lib/override/override-parser';

function drain(events: OverrideStreamEvent[]): OverrideStreamEvent[] {
  return events;
}

describe('OverrideStreamParser — plan §9 seed tests O1–O5', () => {
  it('O1: tag split across 2 chunks stitches content without losing bytes', () => {
    const p = new OverrideStreamParser();
    const a = p.push('<ration');
    const b = p.push('ale>hello world</rationale>');
    const all = [...a, ...b];
    const complete = all.filter((e) => e.isComplete);
    expect(complete).toHaveLength(1);
    expect(complete[0]).toMatchObject({
      field: 'rationale',
      value: 'hello world',
      isComplete: true,
      hypothesisId: null,
    });
  });

  it('O2: hypothesis block stamps hypothesisId on all sibling events', () => {
    const p = new OverrideStreamParser();
    const stream =
      '<hypothesis_start>sli-1</hypothesis_start>' +
      '<kind>structural</kind>' +
      '<label>Innovation reports into Ops</label>' +
      '<hypothesis_end/>';
    const events = drain(p.push(stream));
    const completeById = events.filter((e) => e.isComplete);

    const start = completeById.find((e) => e.field === 'hypothesis_start');
    const kind = completeById.find((e) => e.field === 'kind');
    const label = completeById.find((e) => e.field === 'label');
    const end = completeById.find((e) => e.field === 'hypothesis_end');

    expect(start?.hypothesisId).toBe('sli-1');
    expect(kind?.hypothesisId).toBe('sli-1');
    expect(label?.hypothesisId).toBe('sli-1');
    // hypothesis_end: id cleared AFTER the event is stamped, so the
    // closing event carries the just-closed id.
    expect(end?.hypothesisId).toBe('sli-1');

    // A subsequent <done/> after the block is stamped with null.
    const tail = p.push('<done/>');
    const done = tail.find((e) => e.field === 'done');
    expect(done?.hypothesisId).toBeNull();
  });

  it('O3: raw "<" inside open content triggers ERROR_RECOVERY (no throw, no bad event)', () => {
    const p = new OverrideStreamParser();
    expect(() => {
      // Raw '<' mid-content (no '/') is a nesting violation.
      const a = p.push('<label>Innovation < Ops</label>');
      // No complete label event — recovery drops the malformed run.
      const completesForLabel = a.filter((e) => e.field === 'label' && e.isComplete);
      expect(completesForLabel).toHaveLength(0);

      // Subsequent tag still parses cleanly.
      const b = p.push('<done/>');
      expect(b).toContainEqual(
        expect.objectContaining({ field: 'done', value: true, isComplete: true })
      );
    }).not.toThrow();
  });

  it('O4: <done/> after a malformed tag still emits cleanly', () => {
    const p = new OverrideStreamParser();
    // Malformed kind (raw '<' mid-content), followed by done.
    const events = drain(p.push('<kind>structural < malformed<done/>'));
    const completes = events.filter((e) => e.isComplete);
    expect(completes).toContainEqual(
      expect.objectContaining({ field: 'done', value: true, isComplete: true })
    );
    // No kind-complete emitted.
    expect(completes.filter((e) => e.field === 'kind')).toHaveLength(0);
  });

  it('O6 fuzz: 500-char hypothesis body split at random chunk boundaries yields same content', () => {
    // Build a well-formed stream with a 500-char hypothesis body.
    const body = 'A'.repeat(500);
    const full =
      `<hypothesis_start>fuzz-1</hypothesis_start>` +
      `<label>${body}</label>` +
      `<kind>structural</kind>` +
      `<hypothesis_end/><done/>`;

    // Baseline: parse as single chunk.
    const baseline = new OverrideStreamParser();
    const baseEvents = baseline.push(full).filter((e) => e.isComplete && e.field === 'label');
    expect(baseEvents).toHaveLength(1);
    const expectedValue = baseEvents[0]!.value;

    // Fuzz: split at 20 pseudo-random positions and re-parse.
    // Using a deterministic LCG so the test is reproducible.
    let seed = 0xdeadbeef;
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    for (let trial = 0; trial < 20; trial++) {
      const positions: number[] = [];
      const numSplits = 3 + Math.floor(rng() * 10);
      for (let i = 0; i < numSplits; i++) {
        positions.push(Math.floor(rng() * (full.length - 1)) + 1);
      }
      positions.sort((a, b) => a - b);
      const chunks: string[] = [];
      let prev = 0;
      for (const p of [...new Set(positions)]) {
        if (p > prev) { chunks.push(full.slice(prev, p)); prev = p; }
      }
      chunks.push(full.slice(prev));

      const p = new OverrideStreamParser();
      const allEvents: OverrideStreamEvent[] = [];
      for (const chunk of chunks) allEvents.push(...p.push(chunk));
      const labelEvs = allEvents.filter((e) => e.isComplete && e.field === 'label');
      expect(labelEvs).toHaveLength(1);
      expect(labelEvs[0]!.value).toBe(expectedValue);
    }
  });

  it('O5: <done/> mid-hypothesis clears scope without a hypothesis_end stamp', () => {
    const p = new OverrideStreamParser();
    const events = drain(
      p.push(
        '<hypothesis_start>sli-1</hypothesis_start>' +
          '<label>partial</label>' +
          '<done/>'
      )
    );
    const completes = events.filter((e) => e.isComplete);
    const labelEv = completes.find((e) => e.field === 'label');
    const doneEv = completes.find((e) => e.field === 'done');

    // label fully closed inside the hypothesis — kept, stamped with id.
    expect(labelEv?.hypothesisId).toBe('sli-1');
    // done received without hypothesis_end — the turn closes, scope
    // cleared. The done event itself is stamped `null` because the scope
    // is cleared as part of handling the done emission.
    expect(doneEv?.hypothesisId).toBeNull();
  });
});
