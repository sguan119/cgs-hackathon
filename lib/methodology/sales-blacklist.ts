// Phase 2C sales-speak blacklist for Tone Guard. Receipts drawn verbatim
// from PRD §6.2 + tech-design §2.8 exemplars.
// Plan: docs/phase-plans/phase-2c-plan.md §3.4, seeded per §3.4.1.
//
// Each pattern uses `\b` anchors + bounded character classes (`[\s\-]*`
// spanning a single-char span only) and NEVER uses unbounded `.*` or
// nested quantifiers — catastrophic-backtracking safe on 20k-char input
// per §7.2. Perf-sanity test pins this.

export type SalesBlacklistSeverity = 'high' | 'borderline';

export type SalesBlacklistEntry = {
  id: string;
  pattern: RegExp;
  severity: SalesBlacklistSeverity;
  sourceRef: string;
};

export const SALES_BLACKLIST: readonly SalesBlacklistEntry[] = Object.freeze([
  // --- High-severity: exact PRD §6.2 receipt hits ---
  {
    id: 'bl-lead',
    pattern: /\bLeads?\b/i,
    severity: 'high',
    sourceRef: 'PRD §6.2 L496',
  },
  {
    id: 'bl-proposal',
    pattern: /\bProposals?\b/i,
    severity: 'high',
    sourceRef: 'PRD §6.2 L496',
  },
  {
    id: 'bl-deal',
    pattern: /\bDeals?\b/i,
    severity: 'high',
    sourceRef: 'PRD §6.2 L496',
  },
  {
    id: 'bl-pipeline',
    pattern: /\bPipeline\b/i,
    severity: 'high',
    sourceRef: 'PRD §6.2 L496',
  },
  {
    id: 'bl-customer',
    pattern: /\bCustomers?\b/i,
    severity: 'high',
    sourceRef: 'PRD §6.2 L498',
  },
  {
    id: 'bl-rfp',
    pattern: /\bRFP\b/i,
    severity: 'high',
    sourceRef: 'PRD §6.2 L494',
  },
  {
    id: 'bl-sales-follow-up',
    pattern: /\bsales[\s-]follow[\s-]up\b/i,
    severity: 'high',
    sourceRef: 'PRD §6.2 L499',
  },
  {
    id: 'bl-sales-push',
    pattern: /\bsales[\s-]push\b/i,
    severity: 'high',
    sourceRef: 'PRD §6.2 L503',
  },
  // --- Borderline-severity: soft sales-speak drift ---
  {
    id: 'bl-follow-up',
    pattern: /\bfollow[\s-]up\b/i,
    severity: 'borderline',
    sourceRef: 'tech-design §2.8 borderline exemplar',
  },
  {
    id: 'bl-would-love-to-discuss',
    pattern: /\bwould love to discuss\b/i,
    severity: 'borderline',
    sourceRef: 'tech-design §2.8 high-risk exemplar (tone echo)',
  },
  {
    id: 'bl-close-the-loop',
    pattern: /\bclose the loop\b/i,
    severity: 'borderline',
    sourceRef: 'PRD §6.2 sales-speak drift',
  },
  {
    id: 'bl-circle-back',
    pattern: /\bcircle back\b/i,
    severity: 'borderline',
    sourceRef: 'PRD §6.2 sales-speak drift',
  },
  {
    id: 'bl-touch-base',
    pattern: /\btouch base\b/i,
    severity: 'borderline',
    sourceRef: 'PRD §6.2 sales-speak drift',
  },
  {
    id: 'bl-expanding-the-deal',
    pattern: /\bexpanding the deal\b/i,
    severity: 'borderline',
    sourceRef: 'tech-design §2.8 high-risk exemplar',
  },
  {
    id: 'bl-next-steps-for-the-deal',
    pattern: /\bnext steps for the deal\b/i,
    severity: 'borderline',
    sourceRef: 'PRD §6.2 sales-speak compound',
  },
]) as readonly SalesBlacklistEntry[];
