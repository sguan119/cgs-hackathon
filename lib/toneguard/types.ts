// Phase 2C Tone Guard validator types. Pure types, no runtime deps.
// Plan: docs/phase-plans/phase-2c-plan.md §3.1.

export type Verdict = 'pass' | 'borderline' | 'high-risk';

export type RuleId =
  | 'sales_blacklist'
  | 'sales_soft_hit'
  | 'missing_section'
  | 'out_of_order_section'
  | 'unknown_methodology_tag'
  | 'no_methodology_tag';

export type ReasonSeverity = 'high' | 'borderline';

export type Reason = {
  rule: RuleId;
  message: string;
  spanStart?: number;
  spanEnd?: number;
  severity: ReasonSeverity;
};

export type ValidateResult = {
  verdict: Verdict;
  reasons: Reason[];
};
