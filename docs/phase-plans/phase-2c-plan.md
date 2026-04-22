# Phase 2C Implementation Plan — Tone Guard Validator

## 1. Overview

Phase 2C turns the Phase 1 `/continuity/` stub into the **§6 E3 Tone Guard** demo surface that `tech-design.md` §1.1 / §1.2 locks as the third "real" implementation (VP will Q&A with "what if the email said X"). Three pure-TypeScript rules run **synchronously** against any email body — regex blacklist for sales-speak (PRD §6.2 receipts), three-section header presence + order check (`What We're Seeing` / `Quick Pulse Check` / `Preliminary Read`), and methodology-tag whitelist comparison against the canonical CGS vocabulary — returning a three-bucket verdict (`pass` / `borderline` / `high-risk`) with per-rule reasons that carry character spans for UI highlighting. The validator is exercised in two surfaces on the Continuity page: (a) three pre-generated email fixtures (pass / borderline / high-risk per tech-design §2.8) rendered with a `<TrafficLight/>` badge + reason popover that runs `validate()` at render time, and (b) a VP paste component with a multi-line textarea + Validate button + result card that underlines the matched substrings in the original text. Phase 2C also lands `lib/methodology/tags.ts` as the **single source of truth for CGS methodology vocabulary** — this reconciles the placeholder label set Phase 2B left on `lib/override/dims.ts`. Content fills for the whitelist, blacklist, and three email bodies are out-of-engineering-scope (impl-plan §3.A owner), but this plan locks every shape they must satisfy and ships the skeletal seeds required to run the test suite and render the page end-to-end.

---

## 2. Directory deltas (new files only)

```
app/
  (main)/
    continuity/
      page.tsx                                # REWRITTEN: renders <ContinuityPage/>
      ContinuityPage.tsx                      # container: loads 3 fixtures, mounts paste component
      EmailCard.tsx                           # per-email card: body + <TrafficLight/> + reason popover
      ToneGuardPaste.tsx                      # VP paste surface: textarea + Validate + result card
      ReasonPopover.tsx                       # shared reason list rendering (used by EmailCard + paste)
      HighlightedBody.tsx                     # renders text with spanStart/spanEnd underlines
fixtures/
  continuity_fixtures/
    pass.json                                 # CONTENT-OWNER DELIVERABLE (shape locked §3.4)
    borderline.json                           # CONTENT-OWNER DELIVERABLE
    high-risk.json                            # CONTENT-OWNER DELIVERABLE
    email-fixture.schema.json                 # JSON Schema validated in scripts/test-phase-0.js
lib/
  methodology/
    tags.ts                                   # canonical CGS whitelist (SSoT for Phase 2C + Phase 2B reconciliation)
    sales-blacklist.ts                        # regex receipts per PRD §6.2
    tags.test.ts                              # whitelist sanity (contains minimum canonical set + no dupes)
    sales-blacklist.test.ts                   # each entry compiles + does not backtrack on worst-case input
  toneguard/
    validate.ts                               # the synchronous validator (~50 lines)
    validate.test.ts                          # ≥10 strings covering each rule + combos
    highlight.ts                              # maps reasons[].spanStart/End → render regions for HighlightedBody
    highlight.test.ts                         # span merging + non-overlap invariant
    types.ts                                  # Verdict / RuleId / ValidateResult / Reason
```

No new Rust / Tauri capability JSON changes. No new `.env.local` keys. No changes to `src-tauri/tauri.conf.json`. Validator is synchronous — no use of Phase 2A `retry.ts` or `lib/llm/*`. Reuses `<TrafficLight/>` (Phase 1) and `<Toast/>` (Phase 1) verbatim.

---

## 3. Data shapes

### 3.1 Verdict + RuleId + ValidateResult (`lib/toneguard/types.ts`)

```ts
export type Verdict = 'pass' | 'borderline' | 'high-risk';

export type RuleId =
  | 'sales_blacklist'          // regex hit
  | 'sales_soft_hit'           // soft/borderline phrase echo (e.g. "close the loop")
  | 'missing_section'          // one or more of the 3 headers absent
  | 'out_of_order_section'     // all 3 present but wrong order
  | 'unknown_methodology_tag'  // tag-looking phrase not in canonical whitelist
  | 'no_methodology_tag';      // body mentions no canonical tag at all

export type Reason = {
  rule: RuleId;
  message: string;              // human-readable ("Blacklist hit: 'Deal' at col 42")
  spanStart?: number;           // inclusive 0-based char offset in the input
  spanEnd?: number;             // exclusive
  severity: 'high' | 'borderline';
};

export type ValidateResult = {
  verdict: Verdict;
  reasons: Reason[];            // order: collected in rule-check order; UI may re-sort
};
```

**Decision: rules compose via collect-all, not first-fail.** The validator runs all three rule categories against the full input and returns **every** match. The final `verdict` is the max severity seen across all reasons (`high-risk` > `borderline` > `pass`). Rationale: demo requires the VP to see *why* an email was flagged and from which angles; first-fail would hide multi-fault emails (e.g. the §2.8 high-risk fixture intentionally trips blacklist AND missing-methodology-tag AND missing-section — all three must show up in the reason popover).

### 3.2 EmailFixture (`fixtures/continuity_fixtures/*.json`)

```ts
export type EmailFixture = {
  id: 'pass' | 'borderline' | 'high-risk';
  to: string;                   // e.g. "D. Park <dpark@acme.example>"
  subject: string;
  body: string;                 // full plain-text body; validator runs against this exact string
  expected_verdict: Verdict;    // authoring hint (MUST match validate(body).verdict; enforced in test-phase-0 §6)
  notes?: string;               // content-owner notes (not rendered)
};
```

Top-level shape is a single `EmailFixture` per file (three files total). The `expected_verdict` field is a **contract**: `pnpm test:phase-0` runs `validate(body)` against every fixture and asserts `.verdict === expected_verdict` (see §9.2). If a content-owner edit to `body` drifts the verdict, the phase-0 smoke fails loudly instead of silently shipping a mis-bucketed demo email.

### 3.3 MethodologyTag (`lib/methodology/tags.ts`)

**Decision: tagged-object shape, not bare `string[]`.** Each entry carries an explicit category so the validator (and downstream `ContinuityPage`) can reason about whether an email uses *Strategy Wheel dim names*, *Inertia terminology*, *First Mile / Connecting World*, etc. — a flat string list would force second-pass category re-derivation inside the validator, which is exactly the "Frankenstein" drift the PRD §3.5.3 red line warns against. Category also lets Phase 2B `lib/override/dims.ts` reconcile its 7 Strategy Wheel names against the `strategy_wheel` subset without colliding with Inertia/First-Mile labels.

```ts
export type MethodologyCategory =
  | 'strategy_wheel'     // the 7 dimensions
  | 'inertia'            // Dominant Logic / Structural Inertia
  | 'first_mile'         // First Mile
  | 'connecting_world'   // Connecting World
  | 'archetype';         // named archetype labels (if any land in the canonical set)

export type MethodologyTag = {
  canonical: string;           // exact canonical label, case as authored
  category: MethodologyCategory;
  aliases?: readonly string[]; // case-insensitive match variants ("Strategic Innovation" ↔ "Strat Innovation")
  sourceRef: string;           // citation: "CGS_Slides_3_4 p.7" or "cgs.com/about"
};

export const METHODOLOGY_TAGS: readonly MethodologyTag[] = Object.freeze([ /* seeded per §3.3.1 */ ]);

export function isCanonicalTag(phrase: string): boolean;
export function findCanonicalTag(phrase: string): MethodologyTag | undefined;
```

#### 3.3.1 Seed content (minimum canonical set — ships in Phase 2C engineering deliverable)

Per team-lead recommendation: seed with **Strategy Wheel 7 dims + Dominant Logic + Structural Inertia + First Mile** (already used in prior phases + prototype). This is the minimum set needed for tests to pass and for the three fixture emails to be classifiable. Content-owner extension (additional archetypes, Connecting World variants, etc.) is additive and non-breaking.

Seeded entries:
1. External Sensing (strategy_wheel, source: cgs-ui-design/project/fixtures.js CGS_DIMENSIONS + CGS_Slides_3_4)
2. Internal Sensing (strategy_wheel, same source)
3. Strategy Formulation (strategy_wheel)
4. Strategic Transformation Concept (strategy_wheel)
5. Strategic Transformation (strategy_wheel)
6. Strategic Innovation (strategy_wheel)
7. Strategy Governance & Comms (strategy_wheel)
8. Dominant Logic (inertia, alias: `['Dominant Logic Inertia']`)
9. Structural Inertia (inertia, alias: `['Structural', 'Structural Friction']` — matches PRD §6.3 E5 friction labels)
10. First Mile (first_mile)

Ten entries. The placeholder name warning in `lib/override/dims.ts` (line 4–8 TODO banner) is cleared by this phase: Phase 2C importer of `dims.ts` reads from `METHODOLOGY_TAGS` filtered by `category === 'strategy_wheel'` to confirm the 7 dim `short` labels are a subset of the canonical set. A unit test (`tags.test.ts` O-reconcile) pins this invariant.

#### 3.3.2 Matching semantics

- **Case**: aliases and `canonical` are compared **case-insensitive** via `String.prototype.toLowerCase()`. Trim whitespace from input phrases.
- **Word boundary**: matching uses `\b` anchors — "First Mile" inside "First Miler" does NOT match; "First Mile." (period adjacent) DOES.
- **Multi-word tokens**: the validator scans for **exact multi-word matches** against `canonical` and each `alias` — it does NOT fuzzy-match partial subsequences. If the canonical is "Strategic Transformation Concept", the input must contain the whole phrase (case-insensitive, word-bounded).
- **Methodology-shaped phrase detection**: the `unknown_methodology_tag` rule fires when the input contains a **capitalized multi-word phrase that is NOT in the whitelist but LOOKS like a methodology tag** (e.g. "Strategy Wheel Innovation" — not canonical but has the shape). Heuristic: a phrase of 2+ consecutive capitalized words OR a single capitalized word immediately adjacent to known methodology keywords (`Strategy Wheel`, `Inertia`, `Framework`). This rule is intentionally conservative — false positives are cheaper than false negatives for the red-line constraint.

### 3.4 SalesBlacklistEntry (`lib/methodology/sales-blacklist.ts`)

```ts
export type SalesBlacklistEntry = {
  id: string;                  // stable slug for reason messages ("bl-proposal")
  pattern: RegExp;             // case-insensitive, word-boundary-anchored
  severity: 'high' | 'borderline';
  sourceRef: string;           // PRD §6.2 line citation
  // Examples of borderline vs high:
  //   high      → exact receipt hits (Proposal, Deal, Pipeline, Lead)
  //   borderline → soft echoes ("close the loop", "circle back")
};

export const SALES_BLACKLIST: readonly SalesBlacklistEntry[] = Object.freeze([ /* seeded per §3.4.1 */ ]);
```

#### 3.4.1 Seed patterns (≥15 per team-lead recommendation)

Seeds are drawn **verbatim** from PRD §6.2 lines 494–505 plus §2.8 borderline example (`"happy to follow up next week"`). Each pattern uses `\b` anchors, `[\s\-_]*` only where joining multi-word tokens is needed, and **no unbounded `.*`** (see §7.2 catastrophic-backtracking callout).

High-severity (8 entries — exact receipts):
1. `/\bLead(s)?\b/i` — PRD §6.2 L496
2. `/\bProposal(s)?\b/i` — PRD §6.2 L496
3. `/\bDeal(s)?\b/i` — PRD §6.2 L496
4. `/\bPipeline\b/i` — PRD §6.2 L496
5. `/\bCustomer(s)?\b/i` — PRD §6.2 L498 (must say "Client/Prospect")
6. `/\bRFP\b/i` — PRD §6.2 L494 (CGS does not respond to RFP)
7. `/\bsales[\s-]*follow[\s-]*up\b/i` — PRD §6.2 L499
8. `/\bsales[\s-]*push\b/i` — PRD §6.2 L503

Borderline-severity (7 entries — soft hits that trigger `borderline`, not `high-risk`, unless combined with other high hits):
9. `/\bfollow[\s-]*up\b/i` — §2.8 borderline fixture exemplar
10. `/\bwould love to discuss\b/i` — §2.8 high-risk exemplar (tone echo)
11. `/\bclose the loop\b/i` — common sales-speak drift
12. `/\bcircle back\b/i` — common sales-speak drift
13. `/\btouch base\b/i` — common sales-speak drift
14. `/\bexpanding the deal\b/i` — §2.8 high-risk exemplar (bridges to `Deal` high hit, but phrase-level soft)
15. `/\bnext steps for the deal\b/i` — compound

Total 15 — meets the "≥15 regex patterns" floor. Severity mapping into final `Verdict`:
- Any `severity: 'high'` blacklist hit → contributes a `Reason { severity: 'high' }` → verdict ≥ `high-risk`.
- Any `severity: 'borderline'` blacklist hit → contributes a `Reason { severity: 'borderline' }` → verdict ≥ `borderline`.

### 3.5 ValidateInput (`lib/toneguard/validate.ts` signature)

```ts
export function validate(input: string): ValidateResult;
```

**Decision: string input, not structured `{subject, body}`.** The validator scans the full raw string passed in. `ContinuityPage.tsx` passes `fixture.body` (the body only, per §2.8 which locates the three section headers inside the body). The `ToneGuardPaste.tsx` paste component passes the entire textarea content — if the VP pastes a subject + body, the validator treats the concatenation as one input and will still find the headers as long as they're present in the pasted string. This matches the "paste whatever" UX promise.

---

## 4. Rule semantics — decision matrix

### 4.1 Rule catalog

| Rule id | Trigger | Default severity | Notes |
|---|---|---|---|
| `sales_blacklist` | Any regex from `SALES_BLACKLIST` with `severity: 'high'` matches | `high` | Multiple hits → multiple reasons; verdict stays `high-risk` |
| `sales_soft_hit` | Any regex from `SALES_BLACKLIST` with `severity: 'borderline'` matches AND no `sales_blacklist` high hit fired in the same input | `borderline` | If a high hit ALSO fired, the borderline hits still emit as reasons but do not change the `high-risk` verdict |
| `missing_section` | One or more of the three canonical headers absent | `high` | "Absent" = not found as a case-sensitive substring per §4.2 |
| `out_of_order_section` | All three headers present but in the wrong order | `high` | Order comparison uses first-occurrence offsets (§4.2) |
| `unknown_methodology_tag` | Methodology-shaped phrase (see §3.3.2) is present AND not found in `METHODOLOGY_TAGS` or its aliases | `high` | **Methodology misuse is the demo red line** (CLAUDE.md + PRD §3.5.3) — high severity |
| `no_methodology_tag` | Input contains ZERO matches against `METHODOLOGY_TAGS` or aliases | `borderline` | Per tech-design §2.1: "通篇无方法论标签 → borderline" |

### 4.2 Three-section header check — exact string semantics

Headers are matched **case-sensitive** as substring lookups — NOT case-insensitive — because PRD §6.3 E2 specifies the exact wording ("What We're Seeing / Quick Pulse Check / Preliminary Read") and we want to flag a lowercase or renamed header as missing. Apostrophe in "We're" is the **Unicode right single quotation mark (U+2019) OR ASCII apostrophe (U+0027)** — both acceptable; check both forms. No other tolerance.

```ts
// Canonical literal tokens — exactly these three phrases, in this order.
const SECTION_HEADERS = [
  "What We're Seeing",    // also accepts U+2019 variant "What We\u2019re Seeing"
  "Quick Pulse Check",
  "Preliminary Read",
] as const;
```

**Order check**: find first occurrence offset of each header; if all three ≥ 0, assert `offset[0] < offset[1] < offset[2]`. If any offset < 0, emit `missing_section` for each missing header. If all present but order is wrong, emit a SINGLE `out_of_order_section` reason (not three).

### 4.3 Verdict composition

```
if any reason.severity === 'high'  → verdict = 'high-risk'
else if any reason                 → verdict = 'borderline'
else                               → verdict = 'pass'
```

No exceptions. No "high-but-only-one" demotions. Red-line rule: methodology misuse and section-format violations are always high-severity because the demo validator exists to catch precisely those. VP Q&A "what if the email said X" is answered deterministically by this matrix.

### 4.4 Whitespace and normalization

The validator does NOT rewrite or normalize the input before scanning — all `spanStart`/`spanEnd` values are offsets into the **original** unchanged string. Rules that need case-insensitivity (blacklist, methodology tag matching) use regex `i` flag; they do not lowercase the input. This preserves the highlight contract (§4.5).

### 4.5 Reason → span contract

Every rule that can localize a hit MUST emit `spanStart` + `spanEnd`:
- `sales_blacklist` / `sales_soft_hit` → match.index + match[0].length.
- `missing_section` → no span (the whole input is "missing"; `spanStart`/`spanEnd` left undefined).
- `out_of_order_section` → no span (it's a structural property).
- `unknown_methodology_tag` → span of the offending phrase.
- `no_methodology_tag` → no span.

Reasons without spans render in the popover as plain list items; reasons with spans also render an underline in `HighlightedBody.tsx` (§5.7).

---

## 5. Module design

### 5.1 `lib/methodology/tags.ts`

- **Responsibilities**: export the canonical methodology vocabulary and a membership helper. Pure data + pure functions; no React, no async, no IO.
- **Public API**:
  ```ts
  export type MethodologyCategory = ...;
  export type MethodologyTag = ...;
  export const METHODOLOGY_TAGS: readonly MethodologyTag[];
  export function isCanonicalTag(phrase: string): boolean;
  export function findCanonicalTag(phrase: string): MethodologyTag | undefined;
  export function allCanonicalPhrases(): string[];  // canonical + aliases (for regex build in validate.ts)
  ```
- **Dependencies**: none.
- **Consumed by**: `lib/toneguard/validate.ts` (primary), `lib/override/dims.ts` (Phase 2B reconciliation — see §5.1.1), future phases.

#### 5.1.1 Phase 2B reconciliation

Phase 2B left a `TODO (Phase 2C)` banner on `lib/override/dims.ts` L4–8. Phase 2C clears it by adding:
- A `tags.test.ts` invariant: every `STRATEGY_WHEEL_DIMS[i].short` appears as a `canonical` with `category === 'strategy_wheel'`.
- NO renaming of `STRATEGY_WHEEL_DIMS` entries is performed — because the prototype's 7 labels already match the canonical set per §3.3.1. The TODO banner is replaced with a pointer comment `// Reconciled with lib/methodology/tags.ts — strategy_wheel category is the 7-tuple below.` to prevent future drift.
- If the seed list in §3.3.1 is changed during content review and a dim label drifts, the invariant test fails loudly — content owner must update both files.

### 5.2 `lib/methodology/sales-blacklist.ts`

- **Responsibilities**: export the seeded `SALES_BLACKLIST` array. Pure data.
- **Public API**:
  ```ts
  export type SalesBlacklistEntry = ...;
  export const SALES_BLACKLIST: readonly SalesBlacklistEntry[];
  ```
- **Dependencies**: none.
- **Notes**: each `pattern` is constructed with `/.../i` literal syntax, never via `new RegExp(userInput)`. No pattern uses unbounded `.*` or unbounded `+?` over greedy ranges — see §7.2.

### 5.3 `lib/toneguard/validate.ts`

- **Responsibilities**: single synchronous entry point `validate(input) → ValidateResult`. Runs each rule category, collects reasons, composes verdict. Zero async, zero IO, zero external calls. Target ~50 lines excluding JSDoc.
- **Public API**:
  ```ts
  export function validate(input: string): ValidateResult;
  ```
- **Implementation order inside the function** (pinned):
  1. Iterate `SALES_BLACKLIST`; for each entry, run `pattern.exec()` in a `while` loop (capture all matches, not just first) against `input`. Emit a `Reason` per match with correct span.
  2. Check the three section headers (§4.2). Emit `missing_section` per missing header; emit a single `out_of_order_section` if all present but mis-ordered.
  3. Scan methodology vocabulary:
     a. Build a single big word-bounded alternation regex from `allCanonicalPhrases()` **once at module load** (cached), and match all occurrences in input → `canonicalHits: number` counter.
     b. Scan for "methodology-shaped unknown phrases" via the §3.3.2 heuristic → emit `unknown_methodology_tag` per offending phrase.
     c. If `canonicalHits === 0` → emit `no_methodology_tag`.
  4. Compose verdict via §4.3.
- **Dependencies**: `./types`, `@/lib/methodology/tags`, `@/lib/methodology/sales-blacklist`.

### 5.4 `lib/toneguard/highlight.ts`

- **Responsibilities**: pure function `buildHighlightRegions(input, reasons) → Region[]` that converts the `spanStart`/`spanEnd` fields of reasons into a non-overlapping list of render regions. Merges overlapping spans (rare but possible if two blacklist patterns hit the same substring), preserves severity (a region carries the max severity of any overlapping reason).
- **Public API**:
  ```ts
  export type HighlightRegion = {
    start: number;
    end: number;
    severity: 'high' | 'borderline';
    reasons: Reason[];   // which reasons contributed
  };
  export function buildHighlightRegions(input: string, reasons: Reason[]): HighlightRegion[];
  ```
- **Dependencies**: `./types`. Pure over inputs.
- **Invariant**: output regions are sorted by `start` ascending, non-overlapping, fully contained within `[0, input.length]`.

### 5.5 `app/(main)/continuity/ContinuityPage.tsx`

- **Responsibilities**: container; loads 3 `EmailFixture` files, mounts `<EmailCard/>` × 3, mounts `<ToneGuardPaste/>`. Ports the prototype `ContinuityPage.jsx` layout (E1 baseline strip + E2/E3 grid + E4/E5 grid) at the structural level but **simplifies** to the E2/E3 surfaces this phase owns — E1/E4/E5 render as **static fixture-driven placeholders** (read directly from `fixtures/continuity_fixtures/` E4/E5 content if present, else render a "Phase 4.3 fills this" placeholder). The page owns no validator state itself — each child component runs `validate()` as needed on mount / on click.
- **Phase dependency**: Phase 1 `(main)/layout.tsx` shell + `app/globals.css`.
- **Architectural translation**: prototype used `window.CONTINUITY` global + inline styles; port uses `className` + `globals.css` rules under a `/* §2C continuity */` banner. Reuses existing tokens — no new tokens introduced.
- **Correctness callouts**:
  - Three email fixtures are imported via static JSON imports (`import passFixture from '@/fixtures/continuity_fixtures/pass.json' with { type: 'json' }` — matching Phase 2A/2B loader pattern). This keeps the page statically-exportable (D1).
  - `validate()` runs at render time inside each `<EmailCard/>` — cheap (~50 lines of string scanning over a few hundred chars). **No memoization needed** because re-renders of the page are rare and the function is fast; adding `useMemo` would obscure the "VP paste gives instant feedback" story.
- **Acceptance**: `/continuity/` renders a page with three email cards + the paste component; each card shows the correct `<TrafficLight/>` color per fixture; clicking a badge opens the reason popover.

### 5.6 `app/(main)/continuity/EmailCard.tsx`

- **Responsibilities**: one card per email fixture. Shows `to`, `subject`, `body`, a `<TrafficLight/>` badge (red for high-risk, yellow for borderline, green for pass), and a reason popover when the badge is clicked. Validator runs once per mount.
- **Phase dependency**: 5.5; `lib/components/TrafficLight.tsx` (Phase 1).
- **Verdict → color mapping**:
  ```ts
  const VERDICT_COLOR = { pass: 'green', borderline: 'yellow', 'high-risk': 'red' } as const;
  ```
- **Popover UX**: click badge → opens `<ReasonPopover/>` anchored below the badge. Click outside / Esc closes. No Tauri-window tricks — popover is a same-window absolutely-positioned div.
- **Correctness callouts**:
  - The fixture's `body` is rendered via `<HighlightedBody/>` so matched sales-speak / unknown methodology tags are underlined **inline in the email body** as well as listed in the popover. This is the "rule-hit highlight in original text" requirement from the task brief — applied to fixtures, not just the paste surface, so the VP can see it on the pre-gen `high-risk` fixture without opening the paste tool.
  - The popover list orders reasons as: high severity first, then borderline, stable within severity.

### 5.7 `app/(main)/continuity/HighlightedBody.tsx`

- **Responsibilities**: render `input: string` with zero-or-more `<mark>`-style span underlines per `HighlightRegion[]`. Pure presentational.
- **Public API**:
  ```ts
  type Props = { body: string; regions: HighlightRegion[] };
  ```
- **Implementation**: walks regions in order, slicing `body` into alternating plain-text and highlighted chunks; renders each highlight as `<span className={`tg-hl tg-hl-${region.severity}`}>{slice}</span>`. CSS in `globals.css` applies `text-decoration: underline wavy ...` with color per severity (crimson for high, gold for borderline).
- **Correctness callouts**:
  - `regions` from `buildHighlightRegions` are pre-merged + non-overlapping → single pass suffices, no React `key` collisions.
  - Preserves newlines (render `body` inside `<pre className="tg-body">` OR `white-space: pre-wrap` container) so the email reads naturally.

### 5.8 `app/(main)/continuity/ToneGuardPaste.tsx`

- **Responsibilities**: VP paste surface. Controlled `<textarea>` + Validate button + result card.
- **Phase dependency**: 5.3, 5.4, 5.7; `<TrafficLight/>` (Phase 1).
- **Behaviour**:
  - Textarea accepts multi-line input. Initial state: empty string.
  - Click Validate → calls `validate(textareaValue)` synchronously → sets result state.
  - Result card renders: `<TrafficLight/>` with `VERDICT_COLOR[result.verdict]` + short label, reason list via `<ReasonPopover/>` (inline rather than popover — it's the main focus of this component), and `<HighlightedBody body={textareaValue} regions={buildHighlightRegions(textareaValue, result.reasons)} />`.
  - Re-validate on every click; previous result is replaced.
- **Correctness callouts**:
  - **Paste performance** (§7.4): textarea is capped at `maxLength={20000}` to prevent pathological paste. Realistic emails are <3k chars. 20k caps total `validate()` work at a few ms (the regex set is ≤15 patterns + a single alternation for methodology).
  - Empty input on Validate click: emit a `<Toast variant="info">Paste an email body first.</Toast>` (reuses Phase 1 Toast) and skip the result card render. No validator call.
  - No submit-on-Enter — Enter inserts newline as normal textarea behaviour. The Validate button is the only trigger. Documented inline because a `<form>` wrapper would submit on Enter and reload the static-export route.
- **Acceptance**: VP pastes the §2.8 `high-risk` exemplar → clicks Validate → red traffic light + reasons list showing ≥3 high-severity hits (blacklist + missing section + no methodology tag) + inline underline on `"Proposal"`, `"Deal"`, etc.

### 5.9 `app/(main)/continuity/ReasonPopover.tsx`

- **Responsibilities**: pure presentational list of `Reason[]` grouped by severity. Used both as a floating popover (EmailCard) and as an inline panel (ToneGuardPaste).
- **Public API**:
  ```ts
  type Props = { reasons: Reason[]; layout: 'popover' | 'inline' };
  ```
- **Layout**:
  - `popover` → absolutely-positioned card with close button + Esc handler + click-outside handler.
  - `inline` → same content, flows in document order, no close button.
- **Dependencies**: Phase 1 `globals.css` tokens for the card shell.

---

## 6. Per-item plans (the 4 scope items from the task brief)

### 6.1 `lib/toneguard/validate.ts` (~50 lines)

- **Files**: `lib/toneguard/validate.ts`, `lib/toneguard/types.ts`.
- **Depends on**: `lib/methodology/tags.ts`, `lib/methodology/sales-blacklist.ts`.
- **Correctness callouts**:
  - Regex alternation cache: `allCanonicalPhrases()` is computed once at module load, then fed into a single big `RegExp` via `new RegExp('\\b(' + phrases.map(escapeRegExp).join('|') + ')\\b', 'gi')`. `escapeRegExp` escapes metacharacters in seeded phrases (no phrase contains them today but future-proofs). Resetting `.lastIndex = 0` before each `exec` loop is required when using the `/g` flag.
  - Per-rule order: run blacklist first (cheap regex sweep), then sections (three substring lookups), then methodology (one alternation sweep + capitalized-phrase heuristic). Total pass over input ≈ O(n · k) where k is the pattern count — all patterns bounded per §7.2 → linear in input length in practice.
  - Result's `reasons` array preserves the order above; UI re-sorts by severity in the popover.
- **Acceptance criteria** (testable):
  - `validate("")` → `{ verdict: 'high-risk', reasons: [3 missing_section + 1 no_methodology_tag] }`.
  - `validate(pass.body)` → `{ verdict: 'pass', reasons: [] }`.
  - `validate(borderline.body)` → `{ verdict: 'borderline', reasons: [...] }` with all reasons' severity ∈ `{'borderline'}`.
  - `validate(high-risk.body)` → `{ verdict: 'high-risk', reasons: [...] }` with ≥1 `severity: 'high'` reason.
  - A high hit + borderline hit in the same input → verdict is `high-risk`, both reasons present.

### 6.2 `lib/toneguard/validate.test.ts` — ≥10 test strings

- **Files**: `lib/toneguard/validate.test.ts`, `lib/toneguard/highlight.test.ts`.
- **Depends on**: 6.1, 5.4.
- **Test matrix** (non-negotiable for merge):

| # | Rule | Input fixture | Expected verdict | Expected key reason |
|---|---|---|---|---|
| T1 | Clean pass | Full 3-section email using Strategic Innovation + Dominant Logic labels, no blacklist | `pass` | `reasons.length === 0` |
| T2 | Single blacklist high hit | `"Following up on our last Proposal"` + all sections + canonical tag | `high-risk` | `sales_blacklist` on "Proposal" |
| T3 | Single blacklist borderline hit | `"happy to follow up next week"` + all sections + canonical tag | `borderline` | `sales_soft_hit` on "follow up" |
| T4 | All sections present, wrong order | Sections ordered Preliminary Read → Quick Pulse Check → What We're Seeing + canonical tag | `high-risk` | `out_of_order_section` (exactly one reason) |
| T5 | One section missing | Only "What We're Seeing" + "Preliminary Read" present + canonical tag | `high-risk` | `missing_section` on "Quick Pulse Check" |
| T6 | Unknown methodology tag | Body contains "Strategy Wheel Innovation" (not canonical) | `high-risk` | `unknown_methodology_tag` with span on "Strategy Wheel Innovation" |
| T7 | No methodology tag at all | 3 clean sections but body mentions no canonical tag or alias | `borderline` | `no_methodology_tag` |
| T8 | Combo: blacklist + missing section | "Deal" in body + missing "Preliminary Read" | `high-risk` | `reasons.length >= 2` — both `sales_blacklist` and `missing_section` |
| T9 | Combo: borderline soft + no methodology | "circle back" + no canonical tag + all sections | `borderline` | both `sales_soft_hit` and `no_methodology_tag` |
| T10 | Unicode apostrophe in header | Uses `What We\u2019re Seeing` (U+2019) + other sections + canonical tag | `pass` | no `missing_section` for "What We're Seeing" |
| T11 | Multiple blacklist hits, same pattern | Body contains "Proposal" three times | `high-risk` | `reasons` contains 3 entries of `sales_blacklist` id `bl-proposal` with distinct spans |
| T12 | Empty string | `""` | `high-risk` | 3 `missing_section` + 1 `no_methodology_tag` |

Additional tests in `highlight.test.ts`:
- H1: two reasons with overlapping spans → merged into one region with max severity.
- H2: reasons without spans are dropped from region output (but preserved in `result.reasons`).
- H3: regions sorted by start, no overlap invariant holds.

**Acceptance**: `pnpm test:unit` runs all 12 validate tests + 3 highlight tests green. These ≥12 strings cover every rule + combo per the task brief's "~10 strings" floor.

### 6.3 §6 E2 integration — 3 pre-generated email fixtures with validate() at render time

- **Files**: `fixtures/continuity_fixtures/{pass,borderline,high-risk}.json`, `fixtures/continuity_fixtures/email-fixture.schema.json`, `app/(main)/continuity/ContinuityPage.tsx`, `app/(main)/continuity/EmailCard.tsx`, `app/(main)/continuity/ReasonPopover.tsx`, `app/(main)/continuity/HighlightedBody.tsx`.
- **Depends on**: 6.1, 5.5, 5.6, 5.7, 5.9. Phase 1 `<TrafficLight/>`.
- **Fixture seed (ships with engineering deliverable)**: three **skeletal** JSON files that contain valid shape + minimal body text proving the three-verdict mapping actually works end-to-end. Content owner replaces these with the real Acme emails (§2.8 scenarios) before demo. Seed bodies:
  - `pass.json` — three sections present, uses "Strategic Innovation" + "Dominant Logic" canonical tags, no blacklist words.
  - `borderline.json` — missing "Quick Pulse Check" + contains "follow up" (per §2.8 spec).
  - `high-risk.json` — opens "Following up on our last Proposal" + "would love to discuss expanding the deal" + no methodology tags (per §2.8).
- **Correctness callouts**:
  - `expected_verdict` in each fixture is enforced by `scripts/test-phase-0.js`: after schema validation, the script calls `validate(fixture.body)` (requires the validator to be compiled — since test-phase-0 is Node, either run it after `pnpm build` OR provide a minimal `.cjs` port of the validator. **Simpler decision**: add the cross-check to `pnpm test:unit` as a dedicated vitest file `tests/unit/fixtures.test.ts` that imports each fixture + the validator and asserts `validate(fixture.body).verdict === fixture.expected_verdict`. This keeps `test-phase-0` in pure-JS land.)
  - The 3 fixtures are read via static JSON imports so static export works without runtime `fetch`.
- **Acceptance**:
  - Loading `/continuity/` renders 3 EmailCards with green / yellow / red TrafficLights respectively.
  - Clicking a red badge opens the popover listing all reasons; click-outside closes it.
  - The body of the high-risk fixture shows underlined "Proposal" + "Deal" tokens inline.
  - `pnpm test:unit` fixture-contract test ensures edits to the fixture body can't silently change the verdict.

### 6.4 `ToneGuardPaste` component at `app/(main)/continuity/ToneGuardPaste.tsx`

- **Files**: `app/(main)/continuity/ToneGuardPaste.tsx`, `app/(main)/continuity/ReasonPopover.tsx` (reused inline), `app/(main)/continuity/HighlightedBody.tsx` (reused).
- **Depends on**: 6.1, 5.4, 5.7, 5.8, 5.9. Phase 1 `<TrafficLight/>`, `<Toast/>`.
- **Behaviour**: per §5.8. VP pastes → clicks Validate → sees TrafficLight + reasons + underlined matches in the original pasted text.
- **Correctness callouts**:
  - No React state persistence — refresh clears the textarea (intended).
  - No async, no streaming — `validate()` is sync, result renders in the same tick.
  - `maxLength=20000` on the textarea + server-less → no DoS concern beyond memory; content-owner authored emails are <3k chars.
- **Acceptance**:
  - Paste the §2.8 high-risk exemplar body → Validate → red light + reasons visible in <100 ms (no measurable latency to the user).
  - Paste nothing → Validate → Toast "paste an email body first" + no result card.
  - Paste a body the validator rates differently from any fixture (e.g. VP invents a variant) → verdict + reasons update; underlines reposition correctly.

---

## 7. Risk callouts

### 7.1 Tag whitelist drift vs `lib/override/dims.ts`

Phase 2B's `STRATEGY_WHEEL_DIMS` labels were placeholder-mirrored from the prototype per the TODO banner. Phase 2C is the reconciliation point. **Risk**: if the seed list in §3.3.1 diverges from the Phase 2B labels (e.g. content owner renames "Strategic Transformation Concept" → "Transformation Concept"), `dims.ts` becomes stale and the diagnostic wheel labels mismatch Tone Guard's canonical vocabulary → the wheel dim name would trigger `unknown_methodology_tag` when echoed in an email. **Mitigation**: `tags.test.ts` invariant (§5.1.1) asserts every `STRATEGY_WHEEL_DIMS[i].short` is a canonical in `METHODOLOGY_TAGS` with `category === 'strategy_wheel'`. Drift = test failure = loud. Content owner must update both files in the same commit.

### 7.2 Regex catastrophic backtracking

Seed patterns §3.4.1 all use word-boundary anchors, bounded character classes (`[\s\-_]*` over a single-char span), and never use nested quantifiers (`(a+)+` or `.*.*`) or alternations of overlapping prefixes. **Risk**: if a content-owner-added pattern uses an unbounded `.*` against a 20k-char paste, an adversarial input could freeze the browser. **Mitigation**: `sales-blacklist.test.ts` includes a perf sanity test — run every pattern against a 20k-char worst-case string (`"a".repeat(10000) + "Proposal" + "a".repeat(10000)"`); assert each pattern completes in <5ms via `performance.now()`. The test fails if any contributed pattern breaks the bound.

### 7.3 Popover positioning in Tauri webview

`<ReasonPopover/>` uses absolute positioning relative to the clicked badge. **Risk**: the Tauri main window is resizable and the popover could clip at the right edge. **Mitigation**: popover uses `position: absolute; max-width: 320px; right: auto; left: 0; top: 100%` by default with `transform: translateY(4px)`; an `IntersectionObserver`-based edge detector (or simpler: read `getBoundingClientRect()` once on open) flips to `right: 0; left: auto` if the popover's right edge would exceed `window.innerWidth`. Tauri webview fires `resize` events like normal browser, so this is routine HTML — no Tauri-specific API needed.

### 7.4 Paste performance on large text

Textarea cap at 20k chars (§5.8). Validator does 15 regex `/g` sweeps + 3 substring searches + 1 alternation regex with ~20 entries. Back-of-envelope: ~40 passes over 20k chars ≈ 800k char-comparisons ≈ <5ms on modern hardware. **Risk**: none at current scope. If content owner extends the blacklist to 100+ patterns, consider compiling into a single alternation. Deferred until needed; not a Phase 2C task.

### 7.5 Unicode apostrophe drift in "What We're Seeing"

Some Markdown / email renderers smart-quote `'` → `'` (U+2019). Header check must tolerate both forms (§4.2). **Risk**: a human-edited fixture that saved under a different encoding could slip past the check. **Mitigation**: T10 in the test matrix pins both forms; fixture schema validator warns if the body contains mixed quote styles in the section headers (advisory — not a blocker).

### 7.6 `no_methodology_tag` on short emails

A very short email (e.g. "Will send the brief next week, D.") could miss all canonical tags and be flagged `borderline` even if otherwise clean. **Risk**: Phase 2C labels this `borderline` per tech-design §2.1 ("通篇无方法论标签 → borderline") — behaviour is correct by spec. **Mitigation**: the `borderline` verdict is a *review signal*, not a gate (PRD §6.5 decision 1). Demo narrative absorbs it.

### 7.7 Content-owner fixture gap

Phase 2C ships skeletal `pass.json` / `borderline.json` / `high-risk.json` bodies that pass the `expected_verdict` contract by construction. Content owner replaces bodies with real Acme content (§2.8) before demo. **Acceptable**: the fixture-contract test in §6.3 prevents body edits from drifting the verdict without updating `expected_verdict`. Implementer must NOT block on content.

---

## 8. Order of implementation (numbered DAG)

1. **Write `lib/toneguard/types.ts`** — `Verdict`, `RuleId`, `Reason`, `ValidateResult`. Pure types, no deps.
2. **Write `lib/methodology/tags.ts`** with seeded §3.3.1 content + `isCanonicalTag` / `findCanonicalTag` / `allCanonicalPhrases` helpers.
3. **Write `lib/methodology/sales-blacklist.ts`** with seeded §3.4.1 15 patterns.
4. **Write `lib/methodology/tags.test.ts`** — seed invariants + §5.1.1 reconciliation check against `STRATEGY_WHEEL_DIMS`.
5. **Write `lib/methodology/sales-blacklist.test.ts`** — pattern compile + §7.2 perf sanity on each entry.
6. **Write `lib/toneguard/validate.ts`** + inline doc comment; pin ~50-line budget.
7. **Write `lib/toneguard/validate.test.ts`** — all 12 T-cases from §6.2 table.
8. **Write `lib/toneguard/highlight.ts`** — region merger.
9. **Write `lib/toneguard/highlight.test.ts`** — H1/H2/H3.
10. **Write `fixtures/continuity_fixtures/email-fixture.schema.json`** + extend `scripts/test-phase-0.js` to validate `pass.json` / `borderline.json` / `high-risk.json` against it.
11. **Write skeletal `fixtures/continuity_fixtures/{pass,borderline,high-risk}.json`** body + `expected_verdict` per §6.3 seed.
12. **Write `tests/unit/fixtures.test.ts`** — asserts `validate(body).verdict === expected_verdict` for each fixture.
13. **Build `app/(main)/continuity/HighlightedBody.tsx`** — presentational, no state.
14. **Build `app/(main)/continuity/ReasonPopover.tsx`** — `popover` | `inline` layout variants.
15. **Build `app/(main)/continuity/EmailCard.tsx`** — runs `validate()` at render; renders TrafficLight + popover.
16. **Build `app/(main)/continuity/ToneGuardPaste.tsx`** — paste surface.
17. **Rewrite `app/(main)/continuity/page.tsx` → `ContinuityPage.tsx`** — mounts the 3 cards + paste component; ports E1/E4/E5 placeholders.
18. **Add CSS rules to `app/globals.css`** under `/* §2C tone guard */` banner — popover layout, highlight underlines, TrafficLight badge sizing in the email card.
19. **Clear the TODO banner in `lib/override/dims.ts`** with a pointer comment referencing `lib/methodology/tags.ts`.
20. **Write `scripts/test-phase-2c.js`** mirroring Phase 2B's pattern — file existence + export presence + schema validity smoke.
21. **Manual smoke in Tauri** — exit-gate §10 checklist.

Items 1–3 are pure data. 4–5 gate the data correctness. 6 depends on 1–3. 7 depends on 6 + 11 (for fixture round-trip). 8–9 depend on 1. 10–12 gate fixture correctness. 13–17 build the UI. 18 is pure CSS. 19 is a one-line comment change. 20 is the smoke-script. 21 is human verification.

Items 1–9 are backend/logic and can run in parallel with the UI ports 13–14. Items 10–12 unblock 15–17.

---

## 9. Test strategy

### 9.1 Unit tests (Vitest)

| Layer | File | What it asserts |
|---|---|---|
| **Unit** | `lib/methodology/tags.test.ts` | METHODOLOGY_TAGS has ≥10 entries (seed set); no duplicate canonicals; all 7 STRATEGY_WHEEL_DIMS shorts appear as canonicals in category `strategy_wheel` (§5.1.1 reconciliation); `isCanonicalTag` is case-insensitive; alias lookup works |
| **Unit** | `lib/methodology/sales-blacklist.test.ts` | SALES_BLACKLIST has ≥15 entries; each `pattern` compiles; each runs against a 20k-char worst-case string in <5ms (§7.2); severity field well-formed |
| **Unit** | `lib/toneguard/validate.test.ts` | T1–T12 from §6.2 table; verdict composition rule from §4.3; `reasons` preserve spans for blacklist hits |
| **Unit** | `lib/toneguard/highlight.test.ts` | H1 merge overlap; H2 drop spanless reasons; H3 sort + non-overlap invariant |
| **Unit** | `tests/unit/fixtures.test.ts` | `validate(body).verdict === expected_verdict` for all 3 fixtures |

### 9.2 Integration tests

**Decision: Phase 2C DOES allow integration tests via jsdom** (a small step beyond Phase 2B which added `DiagnosticPage.test.tsx`). Scope:

| File | What it asserts |
|---|---|
| `tests/unit/ContinuityPage.test.tsx` | renders 3 EmailCards; each with correct TrafficLight color; clicking a badge reveals the popover; popover lists reasons |
| `tests/unit/ToneGuardPaste.test.tsx` | typing body + clicking Validate renders a result card; empty body + click shows a Toast; underline appears over blacklist words in the pasted body |

### 9.3 E2E (Playwright)

**Decision: Phase 2C prohibits E2E.** Rationale: impl-plan §测试策略 pins "**不做 E2E 自动化**" globally; Phase 2B did ship a `phase-2a.spec.ts` spec file earlier but kept it minimal. Phase 2C keeps to unit + jsdom integration. The exit-gate manual smoke in §10 covers the Tauri-webview-specific interactions (popover positioning, Toast). This matches Phase 2B's test posture and avoids adding Playwright scope to a phase whose subject (a sync validator) has no async surface worth automating.

### 9.4 Phase-0 / phase-2c smoke scripts

- `scripts/test-phase-0.js` extended to ajv-validate the three fixture files against `email-fixture.schema.json`.
- `scripts/test-phase-2c.js` created mirroring `test-phase-2b.js` structure: asserts all new files exist, `METHODOLOGY_TAGS` exported, `SALES_BLACKLIST` exported, `validate` exported, fixtures present + schema-valid. Runs via `pnpm test:phase-2c` (added to package.json alongside `test:phase-2a` / `test:phase-2b`).

---

## 10. Exit gate

Phase 2C is done when **every** box below is checked:

- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm build` still produces `out/continuity/index.html`.
- [ ] `pnpm test:unit` passes; all of: `tags.test.ts`, `sales-blacklist.test.ts`, `validate.test.ts` (T1–T12), `highlight.test.ts` (H1–H3), `fixtures.test.ts`, `ContinuityPage.test.tsx`, `ToneGuardPaste.test.tsx` green.
- [ ] `pnpm test:phase-0` validates `fixtures/continuity_fixtures/{pass,borderline,high-risk}.json` against `email-fixture.schema.json`.
- [ ] `pnpm test:phase-2c` (new) exits 0.
- [ ] `METHODOLOGY_TAGS` contains at least the 10 seed entries (§3.3.1); all 7 `STRATEGY_WHEEL_DIMS` shorts reconcile as canonicals.
- [ ] `SALES_BLACKLIST` contains ≥15 seed entries (§3.4.1); every pattern passes the 5ms worst-case perf sanity.
- [ ] `lib/toneguard/validate.ts` ≤ ~80 lines including JSDoc (tight target is 50 lines of logic; allow JSDoc overhead).
- [ ] `/continuity/` renders three EmailCards with green / yellow / red `<TrafficLight/>` badges matching the fixtures' `expected_verdict`.
- [ ] Clicking a red or yellow badge opens `<ReasonPopover/>` with reasons listed; click-outside and Esc close it.
- [ ] High-risk fixture body shows underlined sales-speak tokens inline (`<HighlightedBody/>` working against the rendered email body).
- [ ] `<ToneGuardPaste/>` smoke in Tauri:
  - [ ] Paste §2.8 high-risk exemplar → red light + ≥3 high-severity reasons.
  - [ ] Paste §2.8 borderline exemplar → yellow light + reasons listing missing section + soft sales hit.
  - [ ] Paste a fully clean email → green light + empty reasons list.
  - [ ] Click Validate with empty textarea → `<Toast variant="info">` appears, no result card.
  - [ ] Underline spans match the positions of matched tokens in the pasted body.
- [ ] Popover positioning survives a Tauri main-window resize (manual: resize window, re-click badge, popover does not clip right edge).
- [ ] `lib/override/dims.ts` TODO banner cleared; replaced with pointer comment to `lib/methodology/tags.ts`.
- [ ] This plan `docs/phase-plans/phase-2c-plan.md` committed.
- [ ] Content-owner fixture work (real Acme email bodies in §2.8 shape) flagged as **out-of-scope for Phase 2C** per impl-plan §3.A — reminders sent to content owner; no block on merge.
- [ ] Content-owner vocabulary work (METHODOLOGY_TAGS beyond the 10-seed canonical set; SALES_BLACKLIST beyond the 15-seed receipts) flagged as **additive and non-breaking** — may land anytime post-Phase-2C without re-running tests.

When all boxes are green: **Phase 2C ships → Phase 2D (Tauri shell cleanup) and Phase 3 (fixture gen scripts) may start**. Phase 2C establishes `lib/methodology/tags.ts` as the methodology vocabulary source of truth for all subsequent phases; any new surface that displays methodology labels (Phase 4.1 Dashboard, Phase 4.2 Diagnostic finalization, Phase 4.4 Data Hub) imports from it rather than hardcoding names.
