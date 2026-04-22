// Phase 2C highlight-region builder. Pure over (input, reasons).
// Plan: docs/phase-plans/phase-2c-plan.md §5.4.

import type { Reason, ReasonSeverity } from './types';

export type HighlightRegion = {
  start: number;
  end: number;
  severity: ReasonSeverity;
  reasons: Reason[];
};

function maxSeverity(a: ReasonSeverity, b: ReasonSeverity): ReasonSeverity {
  return a === 'high' || b === 'high' ? 'high' : 'borderline';
}

export function buildHighlightRegions(input: string, reasons: Reason[]): HighlightRegion[] {
  const spans = reasons
    .filter(
      (r) =>
        typeof r.spanStart === 'number' &&
        typeof r.spanEnd === 'number' &&
        r.spanEnd > r.spanStart &&
        r.spanStart >= 0 &&
        r.spanEnd <= input.length
    )
    .map((r) => ({
      start: r.spanStart as number,
      end: r.spanEnd as number,
      severity: r.severity,
      reason: r,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const regions: HighlightRegion[] = [];
  for (const s of spans) {
    const last = regions[regions.length - 1];
    if (last && s.start < last.end) {
      last.end = Math.max(last.end, s.end);
      last.severity = maxSeverity(last.severity, s.severity);
      last.reasons.push(s.reason);
    } else {
      regions.push({
        start: s.start,
        end: s.end,
        severity: s.severity,
        reasons: [s.reason],
      });
    }
  }
  return regions;
}
