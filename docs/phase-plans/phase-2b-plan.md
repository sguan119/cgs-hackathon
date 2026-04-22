# Phase 2B Implementation Plan — Fellow Override

## 1. Overview

Phase 2B turns the Phase 1 `/diagnostic/` placeholder into the **F6 Fellow Override** demo high-point that `tech-design.md` §1.1–§1.2 locks as `real`: a ported `StrategyWheel` + `DiagnosticPage` where the VP clicks one of the 7 CGS Strategy Wheel sectors, types a new 1–7 score, and sees the downstream Inertia-hypothesis card diff in under 45 s — cache-hit in <2 s, cache-miss streaming via the same Claude pipeline + tagged-stream parser Phase 2A shipped. The flow pays off PRD §2.2.4 / §3 ("agent 现场重生成下游 Inertia + 干预建议") and lets the VP live-test any dimension × score combo without pre-canned rigidity. Phase 2B ships the **code paths** end-to-end (wheel click → store write → cache lookup → miss-path streaming → diff render → Toast fallback); content owners still owe the override-cache body (Phase 3.3 `gen-override-cache.ts` → `fixtures/override_cache.json`) and the canonical CGS Strategy-Wheel dim names (Phase 2C `lib/methodology/tags.ts`). This plan specifies the temporary dim-source-of-truth (`lib/override/dims.ts` const), the cache shape, the per-override tag grammar, and the scope of infrastructure reuse from Phase 2A (stream parser, `withRetry`, Toast, cosine retrieval is **not** reused — Override skips cosine entirely).

---

## 2. Directory deltas (new files only)

```
app/
  (main)/
    diagnostic/
      page.tsx                              # rewritten: renders <DiagnosticPage/>
      DiagnosticPage.tsx                    # container; owns override session + sub-pane layout
      StrategyWheel.tsx                     # ported SVG wheel (variant A — radial-pie)
      WheelSector.tsx                       # per-sector click-to-edit + keyboard/ARIA
      ScoreEditor.tsx                       # popover/inline numeric 1–7 editor
      HypothesisCard.tsx                    # old/new diff view (supersede + streaming fade-in)
      EvidenceHealthRail.tsx                # ported evidence bars (read-only; port from prototype)
      DiagnosticDocs.tsx                    # ported 3 fixture doc panels (memo / org / call)
      hooks/
        useOverrideSession.ts               # turns list + dispatch + abort controller
        useWheelScores.ts                   # store subscription + optimistic updates
fixtures/
  override_cache.json                       # CONTENT-OWNER DELIVERABLE (shape locked below)
  override_cache.schema.json                # JSON Schema validated in scripts/test-phase-0.js
  diagnostic_fixtures/
    initial_hypotheses.json                 # static starting hypotheses (Phase 3.2 placeholder)
lib/
  override/
    dims.ts                                 # STRATEGY_WHEEL_DIMS const + bucket helper + types
    cache-loader.ts                         # override_cache.json lazy-load + lookup by {dim,bucket}
    override-chain.ts                       # dispatch → cache lookup → Claude stream → parser
    override-parser.ts                      # Override-specific tag grammar (per-dim delta stream)
    diff.ts                                 # old→new hypothesis diff state machine
    override-chain.test.ts                  # cache-hit / miss routing; abort / concurrent overrides
    cache-loader.test.ts                    # bucket boundaries + key collision
    override-parser.test.ts                 # 5 seed tests for the override grammar
    diff.test.ts                            # supersede state transitions
  components/
    SupersededCard.tsx                      # shared old-card 50% + strikethrough wrapper
```

No new Rust / Tauri capability JSON changes. No new `.env.local` keys. No changes to `src-tauri/tauri.conf.json`. Phase 2A `lib/llm/stream-parser.ts` is **not** reused directly — see §4 rationale.

---

## 3. Data shapes

### 3.1 `StrategyDimension` — entries in `STRATEGY_WHEEL_DIMS`

```ts
export type StrategyDimensionId =
  | 'external_sensing'
  | 'internal_sensing'
  | 'strategy_formulation'
  | 'transformation_concept'
  | 'strategic_transformation'
  | 'strategic_innovation'
  | 'strategy_governance';

export type StrategyDimension = {
  id: StrategyDimensionId;
  // TODO (Phase 2C): align with lib/methodology/tags.ts canonical name.
  short: string;         // UI label e.g. "Strategic Innovation"
  abbr: string;          // 3-letter code for the inner wedge label (e.g. "INV")
  angle: number;         // UI position angle in degrees (0 = top, clockwise)
  desc: string;          // tooltip blurb
};

// Temporary source of truth — Phase 2C reconciles with methodology/tags.ts.
export const STRATEGY_WHEEL_DIMS: readonly [
  StrategyDimension, StrategyDimension, StrategyDimension, StrategyDimension,
  StrategyDimension, StrategyDimension, StrategyDimension,
] = Object.freeze([
  { id: 'external_sensing',       short: 'External Sensing',              abbr: 'EXT', angle:   0, desc: 'Market, competitor, regulatory signal detection' },
  { id: 'internal_sensing',       short: 'Internal Sensing',              abbr: 'INT', angle:  51, desc: 'Org health, culture & capability introspection' },
  { id: 'strategy_formulation',   short: 'Strategy Formulation',          abbr: 'FRM', angle: 103, desc: 'Choice architecture & positioning' },
  { id: 'transformation_concept', short: 'Strategic Transformation Concept', abbr: 'TCN', angle: 154, desc: 'Designing the change model' },
  { id: 'strategic_transformation', short: 'Strategic Transformation',    abbr: 'TRX', angle: 206, desc: 'Execution of large-scale change' },
  { id: 'strategic_innovation',   short: 'Strategic Innovation',          abbr: 'INV', angle: 257, desc: 'Horizon-2 / 3 capability building' },
  { id: 'strategy_governance',    short: 'Strategy Governance & Comms',   abbr: 'GOV', angle: 309, desc: 'Board, cadence, narrative discipline' },
]) as readonly [
  StrategyDimension, StrategyDimension, StrategyDimension, StrategyDimension,
  StrategyDimension, StrategyDimension, StrategyDimension,
];
```

Names above are **placeholders mirrored from `cgs-ui-design/project/fixtures.js` `CGS_DIMENSIONS`** — flagged as TODO for Phase 2C reconciliation against the CGS-official label list. CLAUDE.md calls methodology misuse a demo red line, so the Phase 2B implementer must NOT ship with any renamed label that isn't already in the prototype; only Phase 2C is allowed to rename.

### 3.2 `WheelScores` — store shape expansion

Phase 1 shipped `wheel_scores: Record<string, WheelScore>` where `WheelScore = 1..7`. Phase 2B does **not** change `lib/store.ts` — the 7-key map is already expressible. Runtime discipline:

```ts
export type WheelScore = 1 | 2 | 3 | 4 | 5 | 6 | 7;   // unchanged from Phase 1
export type WheelScores = Partial<Record<StrategyDimensionId, WheelScore>>;

// Seed values used when the store is empty (first visit to /diagnostic).
export const DEFAULT_WHEEL_SCORES: Readonly<WheelScores> = Object.freeze({
  external_sensing: 4,
  internal_sensing: 3,
  strategy_formulation: 5,
  transformation_concept: 3,
  strategic_transformation: 3,
  strategic_innovation: 2,   // The structural-mismatch hero cell per architecture §4.3
  strategy_governance: 5,
});
```

The store is the single source of truth — `useWheelScores` reads via `get('wheel_scores')`, seeds defaults ONLY on first mount when the returned object is empty (`Object.keys(x).length === 0`), and writes via `set('wheel_scores', next)` on each edit. Page refresh preserves state because Phase 1 `store.save()` is auto-called after every `set`.

### 3.3 `OverrideBucket` + cache key

```ts
export type OverrideBucket = 'low' | 'mid' | 'high';

// 1–7 → low(1-2) / mid(3-4) / high(5-7).
export function toBucket(score: WheelScore): OverrideBucket {
  if (score <= 2) return 'low';
  if (score <= 4) return 'mid';
  return 'high';
}

// Canonical serialized cache key.
export function overrideCacheKey(dim: StrategyDimensionId, bucket: OverrideBucket): string {
  return `${dim}:${bucket}`;
}
```

Bucket boundaries are **closed-inclusive at the top edge**: score 2 is `low`, score 3 is `mid`, score 4 is `mid`, score 5 is `high`. Tests in §9 pin this explicitly.

### 3.4 `OverrideCacheEntry` — shape for `fixtures/override_cache.json`

Per `tech-design.md` §2.3 but normalized to the `{dim, bucket}` lookup key with a flat array so JSON-Schema validation and uniqueness checks are trivial:

```ts
export type InertiaKind = 'dominant_logic' | 'structural';

export type InertiaHypothesis = {
  id: string;                  // stable slug (e.g. "sli-1")
  kind: InertiaKind;
  label: string;               // one-line hypothesis title
  statement: string;           // 2-3 sentence body
  confidence: number;          // 0..1
  evidence: { source_id: string; quote: string }[];
  intervention_ids: string[];  // references fixtures/interventions.json (Phase 3.2 owner)
};

export type OverrideCacheEntry = {
  dimension: StrategyDimensionId;
  bucket: OverrideBucket;
  hypotheses: InertiaHypothesis[];     // complete replacement for downstream card list
  rationale: string;                   // one-line prose shown in Override banner ("why the diff")
  baked_at: string;                    // ISO8601 — written by Phase 3.3 gen script
};

export type OverrideCache = {
  version: 1;
  entries: OverrideCacheEntry[];       // uniqueness invariant: (dimension, bucket) unique
};
```

Default minimum set (per team-lead constraint + `architecture.md` §4.3): only `strategic_innovation × {low, mid, high}` gets baked before the demo; all other `(dim, bucket)` combos go to the live-streaming path until impl-plan rehearsal says otherwise.

### 3.5 `OverrideStreamEvent` — per-override tag grammar

Override's grammar is **strictly different** from Recall's. Recall returns one `<year>/<client>/<scene>/<quote>/...` precedent card; Override returns a **list of new inertia hypotheses + one rationale line** and needs to stream those into the diff card slot-by-slot. Reusing the Recall tag set would force us to overload `<quote>` and `<scene>` semantically — a brittle shortcut that would hide protocol drift during the VP Q&A.

```ts
export type OverrideTagName =
  | 'rationale'          // exactly 1 — the override-banner sentence
  | 'hypothesis_start'   // opens a hypothesis block; content = hypothesis id (slug)
  | 'kind'               // exactly 1 per hypothesis — 'dominant_logic' | 'structural'
  | 'label'              // exactly 1 per hypothesis — one-line title
  | 'statement'          // exactly 1 per hypothesis — 2-3 sentence body
  | 'confidence'         // exactly 1 per hypothesis — "0.72" string, parsed to number
  | 'evidence_quote'     // 1..N per hypothesis — verbatim quote
  | 'evidence_source'    // 1..N per hypothesis — matching `fixtures/precedents.json` source_id
  | 'intervention_id'    // 1..N per hypothesis — matching `fixtures/interventions.json` id
  | 'hypothesis_end'     // self-closing — closes the current hypothesis
  | 'done';              // self-closing — closes the turn

export type OverrideStreamEvent = {
  field: OverrideTagName;
  value: string | boolean;      // string for content tags; true for self-closing
  isComplete: boolean;          // false = partial (fade-in); true = closed
  hypothesisId: string | null;  // stamped by the parser from the current <hypothesis_start> block
};
```

**Nesting discipline**: `hypothesis_start ... hypothesis_end` brackets a block; per-hypothesis tags (`kind`, `label`, `statement`, etc.) are siblings INSIDE the bracket, not nested. This keeps the parser state machine the same as Recall's (OUTSIDE / IN_OPEN_TAG / IN_CONTENT / IN_CLOSE_TAG / ERROR_RECOVERY) plus a single scalar `currentHypothesisId` field set on `hypothesis_start` and cleared on `hypothesis_end`.

**ERROR_RECOVERY**: identical to Recall grammar §2.4 — on any nesting violation (another `<` inside an open content run) or unknown tag name, drop the malformed buffer, reset to OUTSIDE, emit no event. Never throws. `<done/>` must always be emitted even if preceding malformed tags dropped. Seed tests pin this.

### 3.6 `OverrideTurn` — session state on DiagnosticPage

```ts
export type OverrideTurnId = string;   // crypto.randomUUID()

export type OverrideTurnStatus =
  | 'pending'       // dispatched; cache lookup in flight
  | 'hit'           // cache hit → rendered instantly (terminal)
  | 'streaming'     // miss-path Claude stream opened
  | 'retrying'      // retry.withRetry attempt 2 or 3 in flight
  | 'superseded'    // this turn was replaced by a later turn on the same dim
  | 'aborted'       // user switched to a different dim mid-stream
  | 'complete'      // <done/> received OR hit terminal
  | 'failed';       // all fallbacks exhausted, no downstream card

export type OverrideTurn = {
  id: OverrideTurnId;
  dimension: StrategyDimensionId;
  prevScore: WheelScore;
  nextScore: WheelScore;
  bucket: OverrideBucket;
  status: OverrideTurnStatus;
  path: 'cache' | 'stream' | null;
  latencyMs: number | null;
  startedAt: number;                    // performance.now()
  hypotheses: InertiaHypothesis[];      // grown incrementally from ParserEvent stream
  partial: {
    rationale: string | null;
    activeHypothesis: Partial<InertiaHypothesis> | null;
  };
  abortController: AbortController | null;
  error?: string;
};

export type OverrideSession = {
  turns: OverrideTurn[];
  activeTurnId: OverrideTurnId | null;        // most recent non-superseded turn per dim
  baselineHypotheses: InertiaHypothesis[];    // loaded from diagnostic_fixtures/initial_hypotheses.json on mount
  editingDim: StrategyDimensionId | null;     // which sector's ScoreEditor is open
};
```

`OverrideSession` is React state only (matches Phase 2A `RecallSession` discipline). Persistence across page refresh covers `wheel_scores` only; the turn log is ephemeral. If the user refreshes, they see the current wheel state with the baseline hypotheses — no stale streaming — which is the intended demo reset path.

---

## 4. Override tag grammar — pin

### 4.1 Why not reuse Recall's parser directly

Recall's `RecallStreamParser` emits 9 fixed tags and has no notion of hierarchical blocks. Override needs **N hypotheses per turn**, each with its own sub-fields; forcing that through Recall's tag set would require overloading `<quote>` to mean "evidence quote of hypothesis #k" and context-tracking which hypothesis the model is inside. That couples Recall grammar evolution to Override semantics.

**Decision**: create a *sibling* parser `lib/override/override-parser.ts` that copies the Phase 2A state-machine skeleton (OUTSIDE / IN_OPEN_TAG / IN_CONTENT / IN_CLOSE_TAG / ERROR_RECOVERY + chunk-boundary buffering + partial-emission coalescing) and swaps only the tag whitelist and per-event `hypothesisId` stamp. The state machine is tiny (~200 lines) and already spec'd in grammar doc §3; duplicating is cheaper than generalizing Phase 2A's parser and risking a regression on the locked Recall contract. The duplication is documented with a pointer comment in both files.

### 4.2 Public contract

```ts
class OverrideStreamParser {
  push(chunk: string): OverrideStreamEvent[];
  end(): OverrideStreamEvent[];   // Phase 2B discretion, same as Phase 2A
}
```

Invariants:
- Pure over `(priorBuffer + chunk)` — identity cursor behaviour from Phase 2A.
- Never throws; protocol violations emit no event and transition to ERROR_RECOVERY.
- One partial per `push` per content run (coalesced) + one mandatory `isComplete: true` per content tag + one event per self-closing tag.
- `hypothesisId` field stamped on every event — `null` before any `<hypothesis_start>`, the committed value while inside a block, `null` again after `<hypothesis_end/>` or on `<done/>`.

### 4.3 Canonical message shape

```
<rationale>Strategic Innovation at bucket high rewrites the structural inertia around ops-owned innovation.</rationale>
<hypothesis_start>sli-1</hypothesis_start>
  <kind>structural</kind>
  <label>Innovation reports into Operations — execution bandwidth starves horizon-2.</label>
  <statement>…</statement>
  <confidence>0.72</confidence>
  <evidence_quote>The Strategic Innovation function reports into Operations to drive execution pace.</evidence_quote>
  <evidence_source>acme-memo-p2-p1</evidence_source>
  <intervention_id>int-d</intervention_id>
<hypothesis_end/>
…(more hypothesis blocks)…
<done/>
```

### 4.4 ERROR_RECOVERY expectations

Same contract as Recall grammar §2.4 — violations (nesting, unknown tag, mismatched close) drop the offending bytes, preserve already-committed hypotheses, and always allow `<done/>` to close the turn cleanly. If `<done/>` arrives mid-hypothesis (i.e. without a `<hypothesis_end/>`), that hypothesis is **discarded** (we refuse to render a half-built card) but all prior fully-closed hypotheses remain. Seed test §9 item O5 pins this.

### 4.5 Prompt contract (pointer, not content)

The Claude prompt built inside `override-chain.ts` instructs the model to:
1. Emit tags in the order above.
2. Only emit tags from the whitelist — no Markdown, no commentary outside tags.
3. Close every opened content tag before emitting `<hypothesis_end/>`.
4. Keep scope **tight**: only re-emit inertia hypotheses and interventions that change because of the dim-score diff. Do NOT regenerate the full wheel or touch unrelated dims. (This is the `architecture.md` §4.3 "only recompute affected downstream" pin.)

Actual prompt string lives with the code, not here; plan only pins the shape.

---

## 5. Module design

### 5.1 `lib/override/dims.ts`

- **Responsibilities**: export `STRATEGY_WHEEL_DIMS`, `StrategyDimension`, `StrategyDimensionId`, `OverrideBucket`, `toBucket`, `overrideCacheKey`, `DEFAULT_WHEEL_SCORES`. Pure data + pure helpers; no React, no async.
- **Public API**: above constants + `toBucket(score): OverrideBucket` + `overrideCacheKey(dim, bucket): string` + `findDim(id): StrategyDimension | undefined`.
- **Dependencies**: none. Phase 2C will import this and rename dims in place.

### 5.2 `lib/override/cache-loader.ts`

- **Responsibilities**: lazy-load `fixtures/override_cache.json` once (static import `with { type: 'json' }` via the same pattern Phase 2A's `precedents-loader` uses). Build an in-memory `Map<string, OverrideCacheEntry>` keyed by `overrideCacheKey(dim, bucket)` on first call. Validate at load-time that all entries' `(dimension, bucket)` pairs are unique — throw a dev-error if not (fatal at startup is better than silent cache shadowing during the demo).
- **Public API**:
  ```ts
  export async function loadOverrideCache(): Promise<OverrideCache>;
  export async function lookupOverride(dim: StrategyDimensionId, bucket: OverrideBucket): Promise<OverrideCacheEntry | null>;
  ```
- **Dependencies**: `lib/override/dims.ts`; mirrors Phase 2A's `lib/retrieval/precedents-loader.ts` loader pattern (lazy cache + error-once).

### 5.3 `lib/override/override-parser.ts`

- **Responsibilities**: pure syntactic extractor for the grammar in §4. State machine copies Phase 2A `RecallStreamParser` structurally; known-tags whitelist swapped; added scalar `currentHypothesisId` managed on `<hypothesis_start>` / `<hypothesis_end/>` / `<done/>`.
- **Public API**: `class OverrideStreamParser { push(chunk: string): OverrideStreamEvent[]; end(): OverrideStreamEvent[]; }` + re-export of `OverrideTagName`, `OverrideStreamEvent`.
- **Dependencies**: none.

### 5.4 `lib/override/override-chain.ts`

- **Responsibilities**: single entry point `runOverrideTurn(opts) → { events: AsyncIterable<OverrideStreamEvent>; done: Promise<OverrideChainResult> }`. Sequence:
  1. Compute `bucket = toBucket(nextScore)`.
  2. `lookupOverride(dim, bucket)` — **hit**: synthesize a synthetic event stream that flows the cached `OverrideCacheEntry` through `OverrideStreamParser` (same slice-into-chunks technique Phase 2A §5.9 uses for offline cache — 40-char slices, 40 ms intervals) so UI code has one path to follow. `path = 'cache'`, `latencyMs = performance.now() - startedAt`.
  3. **Miss**: build Seg 4 payload (`"Override ${dim.short}: ${prevScore} → ${nextScore}. Only recompute affected downstream hypotheses + interventions."`) + recall Phase 1 `streamCompletion`, wrapped in `withRetry` from Phase 2A `lib/llm/retry.ts`. `path = 'stream'`.
  4. Feed each `onDelta(chunk)` into `parser.push(chunk)`; forward events to the async iterator.
  5. Cache reuses Phase 1 Seg 1/2/3 prompt-cache prefix — no code change needed; this inherits cache-prefix discipline for free because Phase 2B does NOT build its own system blocks.
  6. If retry ladder exhausts → **no offline fallback path** (Override has no pre-recorded stream for unbaked buckets); emit one final `Toast variant="error"` and set `status: 'failed'`. The `baselineHypotheses` stay visible (no diff applied). Document this explicitly — Phase 2A's offline path does not transfer.
- **Public API**:
  ```ts
  export type OverrideChainOptions = {
    dimension: StrategyDimensionId;
    prevScore: WheelScore;
    nextScore: WheelScore;
    clientId: string | null;
    signal?: AbortSignal;
    onAttempt?: (attempt: 1 | 2 | 3) => void;
    onRetryWait?: (attempt: 2 | 3, waitMs: number) => void;
  };
  export type OverrideChainResult = {
    path: 'cache' | 'stream';
    latencyMs: number;
    rationale: string | null;
    hypotheses: InertiaHypothesis[];
  };
  export function runOverrideTurn(opts: OverrideChainOptions): {
    events: AsyncIterable<OverrideStreamEvent>;
    done: Promise<OverrideChainResult>;
  };
  ```
- **Dependencies**: `lib/override/{cache-loader, override-parser, dims}`, `lib/llm/{client, retry}` (reused), `lib/store` (read `current_client` once at chain start — identical Seg 3 discipline to Phase 2A §5.4).

### 5.5 `lib/override/diff.ts`

- **Responsibilities**: pure state machine that folds a stream of `OverrideStreamEvent` into a render-ready `{ superseded: InertiaHypothesis[]; incoming: Partial<InertiaHypothesis>[]; rationale: string }`. Tracks per-hypothesis assembly as events arrive; promotes `activeHypothesis` into `incoming[]` on `<hypothesis_end/>`; on `<done/>` promotes the whole `incoming[]` into the new render list and emits a `DiffCommit` event so `DiagnosticPage` can kick off the crossfade.
- **Public API**:
  ```ts
  export type DiffState = {
    rationale: string | null;
    incoming: Partial<InertiaHypothesis>[];
    active: Partial<InertiaHypothesis> | null;
    done: boolean;
  };
  export function reduceDiff(state: DiffState, ev: OverrideStreamEvent): DiffState;
  export const INITIAL_DIFF_STATE: Readonly<DiffState>;
  ```
- **Dependencies**: `lib/override/dims.ts` (for `InertiaKind`, `InertiaHypothesis`).

### 5.6 `app/(main)/diagnostic/` UI split

| Component | Owns | Consumes from earlier phases |
|---|---|---|
| `DiagnosticPage.tsx` | `useOverrideSession` + `useWheelScores`; mounts children; owns Toast rail | `lib/store`, `lib/components/{ErrorBoundary, Toast}`, `lib/override/*` |
| `StrategyWheel.tsx` | SVG wheel; reads `scores` + `editingDim`; delegates per-sector events to `WheelSector` | — (imports `STRATEGY_WHEEL_DIMS`) |
| `WheelSector.tsx` | wedge path + ARIA `role="spinbutton"`; keyboard + click handlers | `lib/override/dims` |
| `ScoreEditor.tsx` | numeric input 1–7; Enter commits, Esc cancels | `lib/override/dims` |
| `HypothesisCard.tsx` | render single (old or new) hypothesis; controls fade / supersede class | — |
| `EvidenceHealthRail.tsx` | static port of the right-column evidence bars | reads `STRATEGY_WHEEL_DIMS` |
| `DiagnosticDocs.tsx` | ported 3 fixture doc panels | reads `diagnostic_fixtures/*` (Phase 3.2 placeholder file shipped by 2B) |
| `SupersededCard.tsx` | shared wrapper: applies 50% opacity + strikethrough (`lib/components/` for reuse with future Thesis Memory diffs) | — |

`DiagnosticPage.tsx` wires its `onScoreCommit(dim, nextScore)` handler into `useOverrideSession.dispatch`, which calls `runOverrideTurn` and iterates `OverrideStreamEvent`s through `reduceDiff` to maintain the card-diff render state. `useWheelScores` owns the store subscription (identical pattern to Phase 1 `recall_history` reads) and applies optimistic updates BEFORE dispatch — so the wheel re-color animation fires immediately regardless of cache vs stream path (see §6.9 correctness callout).

---

## 6. Per-item plans (the 9 scope items from the task brief)

### 6.1 Port `StrategyWheel` + `DiagnosticPage` from prototype

- **Files**: `StrategyWheel.tsx`, `WheelSector.tsx`, `DiagnosticPage.tsx`, `EvidenceHealthRail.tsx`, `DiagnosticDocs.tsx`, `HypothesisCard.tsx`.
- **Phase dependency**: Phase 1 `app/(main)/layout.tsx` shell + `app/globals.css` tokens; no new tokens introduced.
- **Architectural translation**: prototype `DiagnosticPage.jsx` uses inline styles and the `window.CGS_DIMENSIONS` / `window.DOC_MEMO` / `window.INERTIA_HYPOTHESES` globals. The port swaps to `className` + `globals.css` rules under a `/* §2B diagnostic */` banner, and replaces `window.*` globals with:
  - `STRATEGY_WHEEL_DIMS` from `lib/override/dims.ts`.
  - `diagnostic_fixtures/initial_hypotheses.json` (Phase 2B ships the skeleton; Phase 3.2 fills content).
  - `diagnostic_fixtures/memo.json`, `org.json`, `call.json` placeholders (Phase 2B ships empty docs; Phase 3.2 fills from `acme_fixtures/*`).
- **Correctness callouts**:
  - Wheel variant A (radial-pie) only. Variant B (concentric-ring) is a prototype sketch; Phase 2B does not port it.
  - Prototype used 0–5 score scale; Phase 2B uses 1–7 per impl-plan §2B. All color-threshold math updates accordingly (`toBucket` replaces the prototype's four-step `scoreColor` for state purposes, but rendering still interpolates colors on the 1–7 scale — see §6.9 animation note).
  - Prototype's `describeWedge` helper ports verbatim into `StrategyWheel.tsx` as a pure function (no `Object.assign(window, …)`).
- **Acceptance**: loading `/diagnostic/` renders wheel + docs column + hypothesis cards + evidence rail, visually coherent with prototype when read against the CSS (do not screenshot per `cgs-ui-design/README.md`).

### 6.2 Wheel = 7 sectors click-to-edit with 1–7 integer input

- **Files**: `WheelSector.tsx`, `ScoreEditor.tsx`, `hooks/useWheelScores.ts`.
- **Phase dependency**: 6.1.
- **Behaviour**:
  - Click a sector → `editingDim = dim.id` → `ScoreEditor` renders as an inline popover adjacent to the wedge.
  - Editor accepts 1–7 integer; clamps outside range; Enter commits, Esc cancels, click-outside cancels.
  - Commit path → `useWheelScores.setScore(dim, nextScore)` → store write → returns immediately (no wait for async store.save).
- **Correctness callouts**:
  - Re-entry: if user clicks same dim again mid-stream, `ScoreEditor` opens pre-filled with the optimistic value. Committing the same value is a **no-op** (short-circuit before dispatch) to avoid ghost turns in the session log.
  - Keyboard: see §6.9.
- **Acceptance**: click sector, type `5`, press Enter → store shows `wheel_scores.strategic_innovation = 5`; refresh page → value persists.

### 6.3 Wheel-score state stored in `lib/store.ts`

- **Files**: `hooks/useWheelScores.ts`.
- **Phase dependency**: Phase 1 `lib/store.ts`.
- **Behaviour**:
  1. On mount, `get('wheel_scores')`; if empty object, seed with `DEFAULT_WHEEL_SCORES` via `set('wheel_scores', DEFAULT_WHEEL_SCORES)`.
  2. `subscribe('wheel_scores', cb)` to react to cross-window updates (future-proof — Phase 2B has no second window writing, but the plumbing is free).
  3. `setScore(dim, score)` writes `{ ...current, [dim]: score }`.
- **Correctness callouts**:
  - SSR / hydration rule from `lib/store.ts`: all reads inside `useEffect`, initial state falls back to `DEFAULT_WHEEL_SCORES` frozen constant — not an empty object — so the first paint matches the post-hydration paint (no visual flip).
  - Optimistic UI: `setScore` updates local React state BEFORE the `await set(...)` resolves, so the wheel animation fires without waiting for the plugin-store IO.
- **Acceptance**: keyboard-commit on a dim triggers a re-render within one frame; page refresh shows the same value.

### 6.4 Trigger flow: click → store write → dispatch → cache lookup → hit instant / miss stream

- **Files**: `hooks/useOverrideSession.ts`, `lib/override/override-chain.ts`, `lib/override/cache-loader.ts`.
- **Phase dependency**: 6.2, 6.3, 6.5 (cache schema must exist); Phase 1 `lib/llm/client.ts`; Phase 2A `lib/llm/retry.ts`.
- **Behaviour**:
  1. `ScoreEditor` commit → `useWheelScores.setScore(dim, next)` → `useOverrideSession.dispatch({ dim, prev, next })`.
  2. Dispatch constructs `OverrideTurn { status: 'pending' }`, appends to `turns`, creates `AbortController`.
  3. Calls `runOverrideTurn` — immediately races cache lookup vs stream open.
  4. Cache hit: parser emits synthetic events → `reduceDiff` folds → card diff renders within <2 s target (50 ms per chunk × expected ~30 chunks ≈ 1.5 s feel).
  5. Cache miss: Claude stream opens; first event within ~5 s target (network + Seg 4 build + Claude first token); full completion within 45 s budget.
- **Correctness callouts**:
  - Phase 2A cache-prefix discipline: Seg 3 (`current_client`) is read once at chain start via `get('current_client')` — not re-read per chunk. Override reuses the Seg 1/2/3 warm state from Phase 2A; no new heartbeat needed.
  - Concurrent overrides: see §7.3 and §6.7 below — newer dispatch on same dim aborts the in-flight turn before re-dispatching.
- **Acceptance**:
  - Strategic Innovation × high (score 5/6/7) → cache hit path proven via mock cache entry; hypothesis diff renders within <2 s.
  - Strategy Governance × high (not baked) → cache miss, stream path fires; first hypothesis card appears before 8 s; full diff before 45 s.
  - Cache miss with Claude killed → all three retries fire → final `Toast variant="error"` → baseline hypotheses still visible.

### 6.5 `fixtures/override_cache.json` lookup by `{dimension, bucket}` key

- **Files**: `fixtures/override_cache.json`, `fixtures/override_cache.schema.json`, `lib/override/cache-loader.ts`.
- **Phase dependency**: 3.4 data shape.
- **Behaviour**:
  - Schema validates `version === 1`, `entries[].dimension ∈ StrategyDimensionId`, `entries[].bucket ∈ {'low','mid','high'}`, `entries[].hypotheses` length ≥ 1, `entries[].rationale` non-empty, `entries[].baked_at` ISO8601.
  - Uniqueness invariant on `(dimension, bucket)` enforced at load-time AND in `scripts/test-phase-0.js` (extend existing ajv sweep — no new test runner).
  - `lookupOverride(dim, bucket)` is O(1) after first-call hydration; returns `null` on miss — chain treats null as "go live".
- **Correctness callouts**:
  - **Cache prefix discipline**: the cache is a **fixture**, not a runtime-generated store. Phase 3.3 `gen-override-cache.ts` regenerates the file manually; no runtime writes. The word "cache" here is a product-level fixture-cache, not an LRU.
  - **Key serialization**: `overrideCacheKey` produces `"${dim}:${bucket}"`. Both sides (loader + lookup) use this one helper. Do NOT inline the `:` character elsewhere.
  - Phase 2B ships an **empty entries array**; content owner fills via Phase 3.3. Empty cache is schema-valid — every dispatch goes live until content arrives. Implementer must NOT block on content.
- **Acceptance**:
  - Empty cache → every dispatch routes to stream path.
  - Hand-seeded cache entry for `strategic_innovation × high` → dispatch with score 7 hits; dispatch with score 4 (bucket `mid`) misses if only `high` is baked.
  - Malformed JSON → schema validator reports error in `pnpm test:phase-0`.

### 6.6 Miss path → streaming Claude, prompt pins "only recompute affected downstream"

- **Files**: `lib/override/override-chain.ts`, `lib/override/override-parser.ts`.
- **Phase dependency**: 6.5 (routing), Phase 1 `lib/llm/client.ts` (reused verbatim — no changes), Phase 2A `lib/llm/retry.ts` (reused).
- **Prompt pin**: Seg 4 dynamic text includes the literal phrase `"only recompute affected downstream Inertia + interventions. Do not regenerate other wheel dims."` per `architecture.md` §4.3. Additionally, the system-prompt Seg 1 (Framework) already scopes the framework to CGS; the override grammar spec (§4.3 above) is included INLINE in the Seg 4 user text — not in Seg 1, so it doesn't invalidate Seg 1's cache when the grammar evolves between Phase 2B and Phase 3.
- **Parser grammar**: OverrideStreamParser from §5.3.
- **Correctness callouts**:
  - **Chunk-boundary invariant**: inherits Phase 2A grammar §3.3 — "advance cursor only past committed content". Any partial tail like `<hypothesis_s` is retained across pushes.
  - **45 s budget enforcement**: `runOverrideTurn` accepts `signal: AbortSignal`; `useOverrideSession` creates a 45-s timeout that aborts if not complete. On abort mid-stream, already-emitted hypotheses stay in the diff; the turn transitions to `status: 'failed'` with a Toast `"Override exceeded 45s budget — showing partial result"`.
- **Acceptance**:
  - `override_cache.json` empty, `.env.local` valid → dispatch Strategy Formulation × mid (score 3→4) → stream opens within ~5 s → at least one `<hypothesis_start>...<hypothesis_end/>` block arrives → `<done/>` closes the turn within 45 s.
  - Forced 45 s timeout via `vi.useFakeTimers` → turn transitions to `failed` with the expected Toast.

### 6.7 Diff display: old 50% + strikethrough; new streaming fade-in

- **Files**: `HypothesisCard.tsx`, `SupersededCard.tsx`, `app/globals.css` (additions).
- **Phase dependency**: 6.1 (HypothesisCard ported), 6.4 (stream events wired).
- **Behaviour**:
  - On dispatch, `DiagnosticPage` snapshots the current `baselineHypotheses` into `supersededHypotheses`, wraps each in `<SupersededCard>` (adds `opacity: 0.5` + `text-decoration: line-through` + tooltip `"superseded by override"`).
  - Incoming hypothesis cards render with a `fade-in` CSS class; each field (`label` / `statement` / `evidence_*`) applies a per-field fade-in on first non-null transition, identical to Phase 2A `RecallCard` partial-to-complete transition.
  - On `reduceDiff` commit (i.e. `<done/>` received), `DiagnosticPage` calls `setBaselineHypotheses(incoming)` — the superseded layer fades out (CSS `opacity: 0` transition over 400 ms) and is removed from the DOM.
- **Correctness callouts**:
  - **UI artboard A3** pointer: `cgs-ui-design/project/components/NewArtboards.jsx` Part 8 · A3 is the reference for the crossfade; the port uses the same visual layering (new-on-top, old-behind-dimmed) but implemented via CSS grid stacking, not absolute positioning, so layout reflows cleanly when the incoming list has a different count than the old list.
  - **Race with concurrent override**: if turn B starts while turn A is streaming on the **same dim**, turn A is aborted AND its partial hypotheses discarded — the supersede layer stays pointing at the pre-A baseline. See §6.9 for the concurrent-on-different-dim case.
- **Acceptance**:
  - Cache-hit dispatch: old cards fade to 50% + strikethrough; new cards fade in; after 400 ms transition the old cards are gone from DOM.
  - Mid-stream dispatch on same dim: old cards never snap back; streaming incoming cards are discarded and replaced with the second dispatch's stream.

### 6.8 Streaming failure → Toast retry chain (reuse Phase 2A)

- **Files**: `DiagnosticPage.tsx`, `hooks/useOverrideSession.ts`.
- **Phase dependency**: Phase 2A `lib/llm/retry.ts` (imported verbatim, no changes), `lib/components/Toast.tsx` (imported verbatim).
- **Behaviour**:
  - `runOverrideTurn` passes `onAttempt` + `onRetryWait` callbacks into `withRetry`. `useOverrideSession` maps these to a Toast-rail state (identical signature to Phase 2A `RecallPanel`). The session owns a small array of active toast banners — one per in-flight turn; a completed turn clears its banner.
  - Retry delays inherit `RETRY_DELAYS_MS = [2000, 6000]` from Phase 2A — don't redeclare.
  - On exhaustion: single `Toast variant="error"` `"Override failed — keeping prior assessment."`, `OverrideTurn.status = 'failed'`.
- **Correctness callouts**:
  - **Budget math**: 2 s + 6 s = 8 s of backoff + per-attempt latency. If 45-s abort fires mid-backoff, the in-flight retry is cancelled via `signal`. Architecture §5.2 accepts this — the demo falls back to baseline with a visible Toast.
  - **Toast dedup**: a second retry attempt updates the existing banner (same turn id) rather than stacking a new one. Identical to Phase 2A ToastRail pattern — borrow the component behaviour directly.
- **Acceptance**:
  - Mock 503 twice → third attempt succeeds → single Toast loading banner appears + dismisses.
  - Mock 503 three times → Toast error banner + baseline stays.

### 6.9 Wheel re-color animation: changed dim crimson; other dims fade gracefully

- **Files**: `StrategyWheel.tsx`, `WheelSector.tsx`, `app/globals.css` (transition rules).
- **Phase dependency**: 6.1 (wheel rendered), 6.2 (commit fires animation trigger).
- **Behaviour**:
  - On `setScore` commit, the changed sector gets an `.is-editing` class for 1.2 s that layers a crimson dashed-stroke border (matches prototype `editingDim === d.id` path).
  - The fill color interpolates from the prev-score color to the new-score color over 600 ms (CSS `transition: fill 600ms ease-out`).
  - Other sectors get a `.is-peer-fade` class for 300 ms that dips opacity 1 → 0.88 → 1 (visual cue that the whole wheel recomputed).
- **Correctness callouts**:
  - **Animation vs React re-render**: the `is-editing` class must outlive the React re-render that commits the new score. Strategy: the class is applied via a local ref-tracked set cleared by `setTimeout(..., 1200)`, not a state field — avoids re-renders restarting the CSS transition mid-flight. Document the rationale inline.
  - **Concurrent-on-different-dim**: if the user edits dim B while dim A is still streaming, dim B runs its animation IMMEDIATELY + dispatches its own turn, dim A's streaming cards continue to arrive and render in parallel. Both turns write to the same `OverrideSession.turns`; `DiagnosticPage` renders the **most recent turn's** hypothesis card list — so dim A's stream still completes but its result is visually hidden once dim B commits. Dim A's `turn.status` becomes `'superseded'`; cleanup runs on completion without affecting UI.
  - Acceptability: concurrent overrides are a VP-Q&A path ("what about this dim too?") and we prioritize "latest dim wins on card list" over "merge both diffs" — merging is combinatorially messy and not in scope.
- **Accessibility**:
  - Each `WheelSector` is keyboard-reachable: `role="spinbutton"`, `tabIndex={0}`, `aria-valuemin={1}`, `aria-valuemax={7}`, `aria-valuenow={score}`, `aria-valuetext={"${dim.short}: ${score}"}`.
  - Tab cycles through the 7 sectors in wheel-index order (0 through 6).
  - Enter on a focused sector opens `ScoreEditor`.
  - ↑/↓ on a focused sector (NOT inside ScoreEditor) is a direct increment/decrement that commits without opening the editor (fast-path for keyboard power users).
  - Esc inside ScoreEditor cancels (editor only); Esc on a focused sector is a no-op.
- **Acceptance**:
  - Commit score change → changed sector pulses crimson for ~1.2 s, fill transitions in 600 ms.
  - Keyboard: Tab to a sector → Enter → editor opens focused; type → Enter commits.
  - Fast path: Tab to a sector → ↑ increments and fires dispatch (editor never opens).

---

## 7. Risk callouts

### 7.1 Cache miss during VP live test burns 45 s
The default minimum bake is only Strategic Innovation × {low,mid,high}. If the VP picks a different dim (likely — VP will probe), the 45 s stream budget is in play on a live connection. Mitigation (from `architecture.md` §4.3): streaming renders incrementally so 10+ s of streaming still *feels* responsive; hypotheses appear one-by-one; Phase 3.3 rehearsal can add more buckets if VP-path patterns emerge. **Do not widen the default bake before rehearsal** — over-baking also burns 3.3 $ budget unnecessarily. Content owner owns the extension decision; implementer's only job is to make the shape support fast extension (flat array, unique-key invariant, no coupling to dim count).

### 7.2 Wheel click-to-edit keyboard accessibility
Tab-cycle through 7 sectors is non-obvious in SVG — custom `role="spinbutton"` + `tabIndex={0}` on each wedge. If any wedge fails to receive focus, the VP cannot keyboard-test the path. Mitigation: manual smoke (item in exit gate §10); unit test asserts `focus()` is reachable on each `WheelSector` element via `getByRole('spinbutton', { name: /external sensing/i })`. **Do not** rely on `<button>` — the SVG wedge shapes can't be buttons without breaking the fill animation.

### 7.3 Overlapping overrides (user changes dim B while dim A still streaming)
Two concurrent Claude streams cost double tokens and create a race on the hypothesis card list. Policy pinned in §6.9: **latest dim commits wins the visible card list**; earlier turn still completes but marked `'superseded'`. The abort signal from dispatch B cascades ONLY on same-dim dispatches; different-dim concurrent is allowed. Worst-case cost: 2× Claude calls in flight simultaneously. Accepted — VP is unlikely to click 3+ dims in 45 s, and the prompt-cache discipline means the per-call input cost is ~0.

### 7.4 Wheel animation vs React re-render race
A naive `is-editing` class managed as React state would re-trigger the CSS keyframe on every parent re-render (every new ParserEvent arrival = ~30-60 re-renders / s during streaming). Mitigation in §6.9: apply the `is-editing` class via a ref-tracked set cleared by `setTimeout`, not by parent state. The fill-color transition lives on the DOM element's current fill attribute and does not restart on re-render because the attribute value doesn't thrash — it transitions from prev-color to next-color exactly once.

### 7.5 Override parser divergence from Recall parser
Duplicating Phase 2A state-machine logic in `override-parser.ts` is cheaper than a generic parser today but risks drift: a bug-fix in the Recall chunk-boundary logic might not be ported to Override. Mitigation: both files include a banner comment pointing at the other; Phase 2B test suite includes 5 parser seed tests that mirror Phase 2A grammar §5 seeds (same inputs, different tag whitelist). CI runs both suites; any regression in the shared state-machine behaviour will fail both.

### 7.6 Content-owner fixture gap
Phase 2B ships empty `override_cache.json` + skeletal `diagnostic_fixtures/*.json`. The chain works with zero cache entries — every dispatch goes live. Static docs render placeholder text until Phase 3.2 fills them. **Acceptable**: Phase 2B is code; impl-plan §3.A content arrives separately. Implementer must NOT block on content.

---

## 8. Order of implementation (numbered DAG)

1. **Write `lib/override/dims.ts`** — pure data + helpers. No deps.
2. **Write `lib/override/override-parser.ts` + 5 seed tests** — mirror Phase 2A grammar §5 discipline (split-across-chunks, hypothesis-block ordering, ERROR_RECOVERY, `<done/>` always emits, nested-tag rejection). Gates the merge.
3. **Write `lib/override/diff.ts` + test** — pure reducer over OverrideStreamEvent; folds partial into incoming list; handles `<hypothesis_end/>` promotion.
4. **Write `fixtures/override_cache.schema.json` + empty `override_cache.json`**; extend `scripts/test-phase-0.js` ajv sweep to validate.
5. **Write `lib/override/cache-loader.ts` + test** — lazy load, uniqueness invariant, bucket boundary tests.
6. **Write `lib/override/override-chain.ts` + integration test** — compose 1-5; mock `streamCompletion` + `withRetry`; assert cache-hit routing, miss routing, abort-signal propagation, 45 s timeout, retry exhaustion.
7. **Port `StrategyWheel.tsx` + `WheelSector.tsx`** — presentational; reads from `STRATEGY_WHEEL_DIMS`; no store writes yet.
8. **Port `HypothesisCard.tsx` + `SupersededCard.tsx` + `EvidenceHealthRail.tsx` + `DiagnosticDocs.tsx`** — presentational.
9. **Write `hooks/useWheelScores.ts`** — store subscribe + seed defaults.
10. **Write `ScoreEditor.tsx`** — inline popover input with keyboard commit/cancel.
11. **Write `hooks/useOverrideSession.ts`** — turn list + dispatch + abort controllers + 45 s timeout + supersede bookkeeping.
12. **Rewrite `app/(main)/diagnostic/page.tsx` → `DiagnosticPage.tsx`** — mount everything; wire Toast rail; smoke the full chain in Tauri.
13. **Add CSS rules to `app/globals.css`** under `/* §2B diagnostic */` — wheel transition, supersede classes, hypothesis fade-in.
14. **Manual smoke in Tauri** — exit-gate §10 checklist.

Items 1–6 are backend/logic; items 7–13 are UI. 1 is a hard prerequisite for 2; 2 for 3 and 6; 5 for 6; 7 for 8; 9–11 for 12. Items 2–3 and 5–6 can interleave with 7–9 for parallel implementers.

---

## 9. Test strategy

| Layer | Files | What it asserts |
|---|---|---|
| **Unit** | `lib/override/override-parser.test.ts` | 5 seed cases: O1 tag split across chunks; O2 hypothesis-block ordering (`<hypothesis_start>...</hypothesis_end/>` emits hypothesisId stamp); O3 ERROR_RECOVERY on nested `<`; O4 `<done/>` after malformed tag still emits; O5 `<done/>` mid-hypothesis drops the open block, keeps prior hypotheses |
| **Unit** | `lib/override/cache-loader.test.ts` | O6 bucket boundary: `toBucket(2) === 'low'`, `toBucket(3) === 'mid'`, `toBucket(4) === 'mid'`, `toBucket(5) === 'high'`; O7 lookup by `{dim,bucket}` returns cached entry; O8 uniqueness invariant — load rejects duplicate `(dim,bucket)`; O9 empty cache → always `null` |
| **Unit** | `lib/override/diff.test.ts` | O10 rationale-only event updates rationale field; O11 `<hypothesis_end/>` promotes active into incoming[]; O12 `<done/>` sets `done: true`; O13 malformed partial (missing `kind`) is still promoted but marked incomplete |
| **Integration** | `tests/unit/override-chain.test.ts` | O14 cache-hit routing: `strategic_innovation × high` hits, `latencyMs < 2000`, `path === 'cache'`; O15 cache-miss routing: `strategy_governance × high` (no bake) falls to stream; O17 45 s timeout: fake-timers advance → turn status transitions to `'failed'`; O18 retry exhaustion: 3× 503 → final Toast error + baseline stays |
| **Integration** | `tests/unit/useOverrideSession.test.tsx` (jsdom) | O16 concurrent abort: dispatch same dim twice — first AbortController is aborted, only second completes. (Moved here from override-chain.test.ts — the policy lives in the hook, not the chain.) |
| **Integration** | `tests/unit/DiagnosticPage.test.tsx` (jsdom) | O19 keyboard: Tab through 7 sectors, Enter opens editor, ↑ on focused sector commits without opening editor; O20 superseded class applied to old cards during streaming; O21 refresh preserves `wheel_scores` |
| **Manual smoke (Tauri)** | exit-gate checklist §10 | wheel animation, cache-hit feel, stream feel, Toast rail behaviour, 45 s timeout UX |

No E2E (Playwright) in Phase 2B — impl-plan §测试策略 prohibits it.

**The 5 override-parser seed tests + the 3 concurrency-and-routing integration tests (O14, O15, O16) are non-negotiable for Phase 2B merge.**

---

## 10. Exit gate

Phase 2B is done when **every** box below is checked:

- [ ] `pnpm test:unit` passes; all 5 override-parser seed tests (O1–O5) green.
- [ ] `pnpm test:unit` includes `cache-loader.test.ts`, `diff.test.ts`, `override-chain.test.ts`, `DiagnosticPage.test.tsx` all green.
- [ ] `pnpm typecheck` exits 0 — including `STRATEGY_WHEEL_DIMS` typed as 7-tuple and `WheelScore` compatibility with existing `lib/store.ts`.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm build` still produces `out/diagnostic/index.html`.
- [ ] `pnpm test:phase-0` validates `fixtures/override_cache.json` against `override_cache.schema.json` (empty entries valid).
- [ ] `/diagnostic/` renders wheel + docs + hypothesis cards + evidence rail; manual read-against-CSS matches prototype structure.
- [ ] Wheel click-to-edit smoke:
  - [ ] Click a sector → `ScoreEditor` opens; type 5, Enter → wheel re-colors; store shows new score.
  - [ ] Page refresh → wheel retains new score.
  - [ ] Tab through all 7 sectors reachable via keyboard; ↑/↓ on focused sector commits.
- [ ] Cache-hit smoke (Strategic Innovation × high):
  - [ ] Seed `override_cache.json` with one entry → change dim to 6 → hypothesis diff renders within <2 s with supersede animation.
- [ ] Cache-miss smoke (unbaked dim, live Claude):
  - [ ] Change Strategy Governance to 5 → Claude stream opens → first hypothesis card appears before 8 s → full diff before 45 s.
- [ ] Retry + Toast smoke:
  - [ ] Kill Anthropic key → change a dim → Toast error appears; baseline hypotheses stay on screen.
- [ ] 45 s timeout smoke:
  - [ ] Hand-patched 60 s artificial delay in `streamCompletion` → turn transitions to `'failed'` at 45 s; partial cards remain if any, Toast appears.
- [ ] Concurrent-override smoke:
  - [ ] Same dim twice in 3 s → first turn aborted, second completes; card list matches second turn only.
  - [ ] Different dim while first streaming → both streams in flight; final card list matches the last-committed dim.
- [ ] Diff display smoke:
  - [ ] Superseded cards render at 50% opacity + strikethrough during streaming; fade out within 400 ms after `<done/>`.
  - [ ] New cards fade in field-by-field as parser emits partials.
- [ ] `wheel_scores` store inspection:
  - [ ] Open browser devtools on `/diagnostic/`; `get('wheel_scores')` returns 7-key object matching UI.
- [ ] This plan `docs/phase-plans/phase-2b-plan.md` committed.
- [ ] Content-owner fixture work (real `override_cache.json` body + `diagnostic_fixtures/*.json`) flagged as **out-of-scope for Phase 2B** per §3.A — reminders sent to content owner; no block on merge.
- [ ] Phase 2C prereq note: `lib/override/dims.ts` has TODO banner pointing at Phase 2C `lib/methodology/tags.ts` reconciliation.

When all boxes are green: **Phase 2B ships → Phase 2C (Tone Guard) may start**.
