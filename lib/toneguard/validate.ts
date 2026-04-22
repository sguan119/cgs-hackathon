// Phase 2C Tone Guard validator — the third "real" implementation pinned
// by tech-design §1.1. Synchronous, zero IO, zero async, <5ms on 2KB
// input. Plan: docs/phase-plans/phase-2c-plan.md §3.5 / §4 / §5.3.

import { SALES_BLACKLIST } from '@/lib/methodology/sales-blacklist';
import { allCanonicalPhrases, findCanonicalTag } from '@/lib/methodology/tags';
import type { Reason, ReasonSeverity, ValidateResult, Verdict } from './types';

// Case-sensitive literal headers per plan §4.2 — PRD §6.3 E2 pins the
// exact wording. "We're" tolerates U+2019 OR U+0027; no other tolerance.
const SECTION_HEADERS = [
  ["What We're Seeing", "What We\u2019re Seeing"],
  ['Quick Pulse Check'],
  ['Preliminary Read'],
] as const;

const SECTION_LABELS = [
  "What We're Seeing",
  'Quick Pulse Check',
  'Preliminary Read',
] as const;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Alternation source cached at module load per plan §5.3 step 3a. We
// store the `source` string and build a fresh `RegExp` per `validate()`
// call via `.matchAll()` — avoids any shared-`lastIndex` foot-gun under
// future async/concurrent-caller refactors.
const CANONICAL_ALTERNATION_SRC: string = (() => {
  const phrases = allCanonicalPhrases()
    .slice()
    .sort((a, b) => b.length - a.length) // longest first so compounds win
    .map(escapeRegex);
  return '\\b(?:' + phrases.join('|') + ')\\b';
})();

// Methodology-shaped unknown-phrase heuristic (§3.3.2). Intentionally
// conservative: a match must contain at least one methodology hint word
// (so plain capitalized phrases like "Quick Pulse Check" or "The Team"
// are not flagged as unknown methodology tags). Runs over a bounded
// character class (no `.`), stays within a single line (`[^\n]*` not
// used — we use explicit capitalized-word runs).
const CAPITALIZED_RUN = /\b[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){1,4}\b/g;
const METHODOLOGY_HINT = /\b(?:Strategy|Strategic|Inertia|Framework|Wheel|Transformation|Innovation|Governance|Logic|Sensing|Formulation|Mile|Archetype)\b/;
const METHODOLOGY_KEYWORDS = /\b(?:Strategy[ \t]+Wheel|Inertia|Framework)\b/g;

function firstIndexOfAny(input: string, variants: readonly string[]): number {
  let best = -1;
  for (const v of variants) {
    const i = input.indexOf(v);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

export function validate(input: string): ValidateResult {
  const reasons: Reason[] = [];

  // --- Rule 1: sales blacklist (§4.1) ---
  for (const entry of SALES_BLACKLIST) {
    const flags = entry.pattern.flags.includes('g')
      ? entry.pattern.flags
      : entry.pattern.flags + 'g';
    const re = new RegExp(entry.pattern.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      const spanStart = m.index;
      const spanEnd = spanStart + m[0].length;
      const rule = entry.severity === 'high' ? 'sales_blacklist' : 'sales_soft_hit';
      reasons.push({
        rule,
        message: `${entry.severity === 'high' ? 'Blacklist hit' : 'Soft sales-speak'}: "${m[0]}" at col ${spanStart}`,
        spanStart,
        spanEnd,
        severity: entry.severity,
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  // --- Rule 2: three-section headers (§4.2) ---
  const sectionOffsets: number[] = SECTION_HEADERS.map((variants) =>
    firstIndexOfAny(input, variants)
  );
  sectionOffsets.forEach((off, i) => {
    if (off < 0) {
      reasons.push({
        rule: 'missing_section',
        message: `Missing required section: "${SECTION_LABELS[i]}"`,
        severity: 'high',
      });
    }
  });
  const allPresent = sectionOffsets.every((o) => o >= 0);
  if (allPresent) {
    const ordered =
      sectionOffsets[0] < sectionOffsets[1] && sectionOffsets[1] < sectionOffsets[2];
    if (!ordered) {
      reasons.push({
        rule: 'out_of_order_section',
        message:
          'Section headers out of order: expected "What We\'re Seeing" → "Quick Pulse Check" → "Preliminary Read"',
        severity: 'high',
      });
    }
  }

  // --- Rule 3a: canonical methodology alternation — count hits ---
  // Fresh RegExp per call (N1 fix) — no shared lastIndex state.
  const canonicalRe = new RegExp(CANONICAL_ALTERNATION_SRC, 'gi');
  let canonicalHits = 0;
  const canonicalSpans: Array<[number, number]> = [];
  for (const cm of input.matchAll(canonicalRe)) {
    if (cm.index === undefined) continue;
    canonicalHits++;
    canonicalSpans.push([cm.index, cm.index + cm[0].length]);
  }

  // --- Rule 3b: unknown methodology-shaped phrase (§3.3.2) ---
  // Collect candidate spans from the two heuristic patterns, dedup by
  // start+length, then drop any candidate whose span overlaps a known
  // canonical hit (so "Strategic Innovation" inside a legit mention
  // does not double-flag).
  const candidates = new Map<string, { start: number; end: number; phrase: string }>();
  const pushIf = (start: number, end: number, phrase: string) => {
    // Drop if overlaps a canonical hit.
    for (const [cs, ce] of canonicalSpans) {
      if (start < ce && end > cs) return;
    }
    // Drop if the phrase itself is canonical (alias / case variant).
    if (findCanonicalTag(phrase)) return;
    // Conservative heuristic: only flag if the phrase contains a
    // methodology hint word. Prevents ordinary capitalized phrases
    // ("Quick Pulse Check", "The Team", "Happy Tuesday") from
    // tripping unknown_methodology_tag — those aren't methodology
    // misuse, they're ordinary prose.
    if (!METHODOLOGY_HINT.test(phrase)) return;
    candidates.set(`${start}:${end}`, { start, end, phrase });
  };

  const capRe = new RegExp(CAPITALIZED_RUN.source, CAPITALIZED_RUN.flags);
  let capMatch: RegExpExecArray | null;
  while ((capMatch = capRe.exec(input)) !== null) {
    pushIf(capMatch.index, capMatch.index + capMatch[0].length, capMatch[0]);
    if (capMatch.index === capRe.lastIndex) capRe.lastIndex++;
  }
  const kwRe = new RegExp(METHODOLOGY_KEYWORDS.source, METHODOLOGY_KEYWORDS.flags);
  let kwMatch: RegExpExecArray | null;
  while ((kwMatch = kwRe.exec(input)) !== null) {
    // Extend rightward to include one trailing capitalized word, if any.
    const after = input.slice(kwMatch.index + kwMatch[0].length);
    const trail = /^\s+([A-Z][a-z]+)/.exec(after);
    if (trail) {
      const start = kwMatch.index;
      const end = kwMatch.index + kwMatch[0].length + trail[0].length;
      pushIf(start, end, input.slice(start, end));
    }
    if (kwMatch.index === kwRe.lastIndex) kwRe.lastIndex++;
  }

  for (const { start, end, phrase } of candidates.values()) {
    reasons.push({
      rule: 'unknown_methodology_tag',
      message: `Unknown methodology-shaped phrase: "${phrase}" — not in canonical whitelist`,
      spanStart: start,
      spanEnd: end,
      severity: 'high',
    });
  }

  // --- Rule 3c: zero canonical hits → borderline (tech-design §2.1) ---
  if (canonicalHits === 0) {
    reasons.push({
      rule: 'no_methodology_tag',
      message: 'No canonical CGS methodology tag detected in the body',
      severity: 'borderline',
    });
  }

  const verdict = composeVerdict(reasons);
  return { verdict, reasons };
}

function composeVerdict(reasons: Reason[]): Verdict {
  if (reasons.length === 0) return 'pass';
  const maxSev: ReasonSeverity = reasons.some((r) => r.severity === 'high') ? 'high' : 'borderline';
  return maxSev === 'high' ? 'high-risk' : 'borderline';
}
