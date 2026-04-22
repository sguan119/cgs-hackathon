import { describe, it, expect } from 'vitest';
import { RecallStreamParser, type ParserEvent } from '@/lib/llm/stream-parser';

function drain(events: ParserEvent[]): ParserEvent[] {
  return events;
}

describe('RecallStreamParser — grammar §5 seed tests', () => {
  it('case 1: tag split across 2 chunks', () => {
    const p = new RecallStreamParser();
    const a = p.push('<ye');
    const b = p.push('ar>2018</year>');
    const all = [...a, ...b];
    const complete = all.filter((e) => e.isComplete);
    expect(complete).toHaveLength(1);
    expect(complete[0]).toEqual({ field: 'year', value: '2018', isComplete: true });
  });

  it('case 2: tag split across 3 chunks (stress — chunk-boundary invariant)', () => {
    const p = new RecallStreamParser();
    const a = p.push('<yea');
    const b = p.push('r>20');
    const c = p.push('18</year>');
    const partials = [...a, ...b, ...c].filter((e) => !e.isComplete);
    const completes = [...a, ...b, ...c].filter((e) => e.isComplete);
    expect(partials.length).toBeLessThanOrEqual(1);
    if (partials.length === 1) {
      expect(partials[0]).toEqual({ field: 'year', value: '20', isComplete: false });
    }
    expect(completes).toHaveLength(1);
    expect(completes[0]).toEqual({ field: 'year', value: '2018', isComplete: true });
  });

  it('case 3a: literal &lt; inside quote is emitted verbatim (no reverse-escape)', () => {
    const p = new RecallStreamParser();
    const events = drain(p.push('<quote>cost &lt; 10% of revenue</quote>'));
    const complete = events.filter((e) => e.isComplete);
    expect(complete).toHaveLength(1);
    expect(complete[0]).toEqual({
      field: 'quote',
      value: 'cost &lt; 10% of revenue',
      isComplete: true,
    });
  });

  it('case 3b: raw < inside open quote triggers ERROR_RECOVERY (no throw)', () => {
    const p = new RecallStreamParser();
    expect(() => {
      // Raw '<' mid-content is a nesting violation.
      const a = p.push('<quote>cost < 10</quote>');
      // No complete quote event expected — parser drops into recovery.
      const completes = a.filter((e) => e.field === 'quote' && e.isComplete);
      expect(completes).toHaveLength(0);
      // Following tag still parses cleanly.
      const b = p.push('<done/>');
      expect(b).toContainEqual({ field: 'done', value: true, isComplete: true });
    }).not.toThrow();
  });

  it('case 4: multiple <quote> in one chunk emits both as complete in order', () => {
    const p = new RecallStreamParser();
    const events = drain(p.push('<quote>A</quote><quote>B</quote>'));
    const completes = events.filter((e) => e.isComplete && e.field === 'quote');
    expect(completes.map((e) => e.value)).toEqual(['A', 'B']);
  });

  it('case 5: <no_anchor/><done/> emits both self-closing events, no content events', () => {
    const p = new RecallStreamParser();
    const events = drain(p.push('<no_anchor/><done/>'));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ field: 'no_anchor', value: true, isComplete: true });
    expect(events[1]).toEqual({ field: 'done', value: true, isComplete: true });
  });

  it('case 6: malformed <year>2018<done/> still closes the turn cleanly', () => {
    const p = new RecallStreamParser();
    const events = drain(p.push('<year>2018<done/>'));
    // No emitted year-complete (recovery drops it), but done must land.
    const completes = events.filter((e) => e.isComplete);
    expect(completes).toContainEqual({ field: 'done', value: true, isComplete: true });
    // The turn survived — no throw already covered by reaching here.
  });
});

describe('RecallStreamParser — additional invariants', () => {
  it('partial emissions are coalesced to at most one per push per content run', () => {
    const p = new RecallStreamParser();
    // Single push with many content chars — only one partial (actually zero
    // since close tag lands in same push, promoting straight to complete).
    const events = p.push('<scene>CDO reporting-line</scene>');
    const partials = events.filter((e) => !e.isComplete);
    expect(partials.length).toBeLessThanOrEqual(1);
  });

  it('canonical sequence emits in arrival order', () => {
    const p = new RecallStreamParser();
    const a = p.push('<year>2018</year><client>Globex</client><scene>CDO</scene>');
    const names = a.filter((e) => e.isComplete).map((e) => e.field);
    expect(names).toEqual(['year', 'client', 'scene']);
  });

  it('end() returns no trailing events', () => {
    const p = new RecallStreamParser();
    p.push('<year>2018</year>');
    expect(p.end()).toEqual([]);
  });
});

describe('RecallStreamParser — fuzz/stress', () => {
  it('fuzz-a: 1000-char content split at every chunk boundary produces same complete event', () => {
    const content = 'x'.repeat(1000);
    const fullChunk = `<quote>${content}</quote>`;

    // Baseline: single push
    const baseline = new RecallStreamParser();
    const baseEvents = baseline.push(fullChunk).filter((e) => e.isComplete);
    expect(baseEvents).toHaveLength(1);
    expect(baseEvents[0]!.value).toBe(content);

    // Split at every possible boundary 1..N-1
    for (let split = 1; split < fullChunk.length; split++) {
      const p = new RecallStreamParser();
      const a = p.push(fullChunk.slice(0, split));
      const b = p.push(fullChunk.slice(split));
      const completes = [...a, ...b].filter((e) => e.isComplete);
      expect(completes).toHaveLength(1);
      expect(completes[0]!.value).toBe(content);
    }
  });

  it('fuzz-b: interleaved multi-tag sequence split at random boundaries emits all 6 complete events', () => {
    const seq = '<year>2018</year><tag>A</tag><tag>B</tag><quote>Q1</quote><quote>Q2</quote><source_id>x</source_id><done/>';
    const expectedFields = ['year', 'tag', 'tag', 'quote', 'quote', 'source_id', 'done'];
    const expectedValues = ['2018', 'A', 'B', 'Q1', 'Q2', 'x', true];

    // Use a fixed set of representative split points: 10%, 30%, 50%, 70%, 90%
    const splits = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.floor(f * seq.length));
    for (const split of splits) {
      const p = new RecallStreamParser();
      const a = p.push(seq.slice(0, split));
      const b = p.push(seq.slice(split));
      const completes = [...a, ...b].filter((e) => e.isComplete);
      expect(completes.map((e) => e.field)).toEqual(expectedFields);
      expect(completes.map((e) => e.value)).toEqual(expectedValues);
    }
  });

  it('fuzz-c: ERROR_RECOVERY mid-quote then clean continuation', () => {
    const p = new RecallStreamParser();
    expect(() => {
      // Malformed: raw '<' mid-content triggers ERROR_RECOVERY
      const a = p.push('<quote>broken < content</quote>');
      // Quote should not complete cleanly
      const quoteDone = a.filter((e) => e.field === 'quote' && e.isComplete);
      expect(quoteDone).toHaveLength(0);
      // Following clean tag still parses correctly
      const b = p.push('<year>2019</year>');
      const yearDone = b.filter((e) => e.field === 'year' && e.isComplete);
      expect(yearDone).toHaveLength(1);
      expect(yearDone[0]!.value).toBe('2019');
      // Followed by done
      const c = p.push('<done/>');
      expect(c).toContainEqual({ field: 'done', value: true, isComplete: true });
    }).not.toThrow();
  });
});
