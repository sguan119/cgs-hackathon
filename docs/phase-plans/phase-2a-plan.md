# Phase 2A Implementation Plan — Real-Time Recall

## 1. Overview

Phase 2A turns the empty `/recall-panel/` placeholder shipped in Phase 1 into the **hero Real-Time Recall surface** that PRD §3.6.2 locks as `real (半脚本)`: a Fellow-only floating webview that accepts a query (via cmd-K summon or `meeting:start` auto-show), runs the **query → embed → cosine top-3 → Claude streaming → tagged-stream parser → incremental card** chain end-to-end, supports multi-turn deep-dive with prompt-cache reuse (Phase 1 Seg 1–3 warm paths), and degrades cleanly through a retry → offline-cache → no-anchor fallback ladder. It wires the panel lifecycle (`meeting:start` auto-show / `meeting:end` hide / `×` dismiss with cmd-K re-summon) to the real behaviour, ports `MeetingLaptopView` + `RecallSidebar` UX conventions into App Router components, and delivers the six-seed-test unit coverage on `lib/llm/stream-parser.ts` that Phase 0.2 declared non-negotiable. Phase 2A ships the **code paths**; content owners still owe ~10 scripted queries with embeddings (`fixtures/scripted_queries.json`), the matching pre-rendered offline cache (`fixtures/offline_cache.json`), and the ~15-entry precedent library (`fixtures/precedents.json`) — this plan specifies the **shapes** those files must satisfy and leaves the content fill for impl-plan §3.A.

---

## 2. Directory deltas (new files only)

```
app/
  (floating)/
    recall-panel/
      page.tsx                            # rewritten: renders <RecallPanel/>; registers lifecycle listeners
      RecallPanel.tsx                     # container: owns session state, query dispatch, turn feed
      RecallChrome.tsx                    # header strip (LIVE · timer · client tag) + close button
      ContextStrip.tsx                    # 1TB panorama (320K / 15 / 247 / 9) constant
      QueryInput.tsx                      # textarea + autocomplete dropdown; keyboard nav
      AutocompleteList.tsx                # prefix-match dropdown with ↑↓/Tab/Enter/Esc
      RecallCard.tsx                      # per-turn card: year/client/scene/tags/quotes/source_id
      FellowVoiceColumn.tsx               # optional right-column rewrite (cuttable at §5.10)
      NoAnchorCard.tsx                    # "suggest 24h Memo" fallback card
      ToastRail.tsx                       # wraps <Toast variant="loading"> for retry banners
      hooks/
        useRecallSession.ts               # turn list + submit + follow-up context state
        useAutocomplete.ts                # prefix-match + keyboard nav state
        useRecallLifecycle.ts             # meeting:start / meeting:end / manual × handling
fixtures/
  scripted_queries.json                   # CONTENT-OWNER DELIVERABLE (shape locked below)
  offline_cache.json                      # CONTENT-OWNER DELIVERABLE (shape locked below)
  precedents.json                         # content-owner fills; schema already locked in Phase 0.1
lib/
  llm/
    stream-parser.ts                      # tagged-stream parser per docs/recall-stream-grammar.md
    stream-parser.test.ts                 # 6 seed tests — gating Phase 2A merge
    recall-chain.ts                       # orchestrates embed → cosine → stream → parse
    followup.ts                           # multi-turn context window (last 3 verbatim, older summarized)
    retry.ts                              # retry (2× expo backoff) + offline-cache + no-anchor fallback
    no-anchor.ts                          # locally-synthesized <no_anchor/><done/> stream
    recall-chain.test.ts                  # integration: mocked Claude stream → parser → events
    followup.test.ts                      # truncation heuristic
    retry.test.ts                         # retry + offline-cache + no-anchor branch selection
  retrieval/
    embed.ts                              # OpenAI runtime embed + tokenized keyword fallback
    autocomplete.ts                       # prefix match against scripted_queries.json
    precedents-loader.ts                  # lazy-load precedents.json + scripted_queries.json
    embed.test.ts                         # keyword-fallback correctness
    autocomplete.test.ts                  # prefix-match edge cases
    scripted-queries.schema.json          # JSON Schema for fixtures/scripted_queries.json
    offline-cache.schema.json             # JSON Schema for fixtures/offline_cache.json
  shortcuts.ts                            # MODIFIED (not new): see §5.8 for focus-window behaviour tweak
```

No new Rust / Tauri capability JSON changes. No new `.env.local` keys (`OPENAI_API_KEY` and `OPENAI_EMBED_MODEL` already present from Phase 0.3). No changes to `src-tauri/tauri.conf.json`.

---

## 3. Data shapes

### 3.1 `ScriptedQuery` — entries in `fixtures/scripted_queries.json`

```ts
export type ScriptedQuery = {
  id: string;                        // stable slug, e.g. "q-cdo-reporting-line"
  query: string;                     // exact string the VP types; autocomplete prefix-matches against this
  embedding: number[];               // length 1536 (text-embedding-3-small); empty until Phase 3.1 gen script
  expected_precedent_ids?: string[]; // authoring hint; NOT a runtime filter
  category: 'first-hit' | 'follow-up' | 'fallback-trigger' | 'safety-net';
  notes?: string;                    // content-owner notes (not rendered)
};
```

The top-level shape is `ScriptedQuery[]`. Validated at dev time by `scripts/test-phase-0.js` extension (add `scripted_queries.schema.json` to the existing ajv sweep — no new test runner).

### 3.2 `OfflineCacheEntry` — entries in `fixtures/offline_cache.json`

Keyed by the **exact** scripted-query string (not id — matches the retry-chain lookup in §5.9).

```ts
export type OfflineCacheEntry = {
  query: string;                     // must exactly match a ScriptedQuery.query (lookup key)
  tagged_stream: string;             // pre-rendered Claude output; will be sliced into synthetic chunks + piped through the real parser
  precedent_id: string;              // same id that would have been surfaced by the live path (for recall_history writeback)
};

export type OfflineCache = {
  entries: OfflineCacheEntry[];
};
```

Lookup helper: `findOfflineEntry(query)` performs a case-sensitive exact match on `entries[].query`. No prefix tolerance — if the VP types free-text and autocomplete never fired, we intentionally miss (documented at §5.9 / §6.3).

### 3.3 `ParserEvent` — re-cite from grammar doc

Per `docs/recall-stream-grammar.md` §3.2 (locked Phase 0.2 contract — this plan does **not** redefine it):

```ts
type TagName =
  | 'year' | 'client' | 'scene' | 'tag' | 'quote'
  | 'source_id' | 'fellow_voice' | 'no_anchor' | 'done';

type ParserEvent = {
  field: TagName;
  value: string | boolean;   // string for content tags; true for self-closing
  isComplete: boolean;       // false = partial (fade-in); true = closed
};

class RecallStreamParser {
  push(chunk: string): ParserEvent[];
  end(): ParserEvent[];  // Phase 2A discretion per grammar §3.2 note
}
```

### 3.4 Recall UI state — what React owns (not persisted to store)

```ts
export type RecallTurnId = string;   // nanoid / crypto.randomUUID()

export type RecallTurnStatus =
  | 'pending'      // user submitted; embed in flight
  | 'retrieving'   // cosine done; Claude stream opening
  | 'streaming'    // parser has emitted at least one event
  | 'retrying'     // one of the two auto-retry attempts in flight
  | 'offline'      // served from offline_cache
  | 'no_anchor'    // synthesized locally
  | 'complete'     // <done/> received OR offline/no-anchor finished
  | 'failed';      // all fallbacks exhausted

export type RecallCardFields = {
  year: string | null;
  client: string | null;
  scene: string | null;
  tags: string[];
  quotes: string[];
  source_id: string | null;
  fellow_voice: string | null;
  no_anchor: boolean;
  partial: Partial<Record<'year' | 'client' | 'scene' | 'fellow_voice', string>>;
};

export type RecallTurn = {
  id: RecallTurnId;
  query: string;
  status: RecallTurnStatus;
  latencyMs: number | null;
  source: 'scripted' | 'free-text' | 'follow-up';
  card: RecallCardFields;
  error?: string;
};

export type RecallSession = {
  turns: RecallTurn[];
  activeTurnId: RecallTurnId | null;
  isPanelVisible: boolean;
  userDismissed: boolean;    // true when user clicked × — blocks meeting:start auto-reshow
};
```

The `turns` array is the follow-up context source. `SessionStore.recall_history` (Phase 1) captures `{query, precedent_id, ts}` on each completed turn for cross-window observability; the richer `RecallSession` lives only in React state (resets on panel remount — acceptable for demo scope).

---

## 4. Module design

### 4.1 `lib/llm/stream-parser.ts`

- **Responsibilities**: pure tag extractor implementing the state machine in grammar §3. No semantic validation (whitelist checks belong one layer up in `recall-chain.ts`). Never throws — protocol violations degrade to ERROR_RECOVERY per §2.4.
- **Public API**: `new RecallStreamParser()` → `.push(chunk): ParserEvent[]` and `.end(): ParserEvent[]`.
- **Phase 1 deps**: none. This is a zero-dependency utility.
- **Dependencies added by 2A**: none downstream of Phase 1; `recall-chain.ts` and the offline/no-anchor paths pipe through this.

### 4.2 `lib/llm/recall-chain.ts`

- **Responsibilities**: single entry point `runRecallTurn(options) → AsyncIterable<ParserEvent> + RecallChainResult`. Sequence:
  1. Resolve query → embedding (scripted path → pre-baked; free-text → `embed.ts`; on OpenAI fail → tokenized keyword fallback returns a sparse cosine-compatible vector space — see §4.5).
  2. `cosineTopK(embedding, precedents, 3)` (Phase 1 `lib/retrieval/cosine.ts`).
  3. If top-1 `score < THRESHOLD` (proposed `0.25` for unit-normalized embeddings; configurable constant at the top of the module), **do not call Claude** — fall through to `no-anchor.ts` synthesizer and pipe its output through the same parser.
  4. Otherwise build follow-up context via `followup.ts`, wrap through `retry.ts`, call `streamCompletion` (Phase 1 `lib/llm/client.ts`), feed each `onDelta(chunk)` into `parser.push(chunk)`, forward events to the async iterator.
  5. On `<done/>` or stream finalization, resolve `RecallChainResult { precedent_id, latencyMs, source }` and emit `recall:query_complete` (Phase 1 `lib/events.ts`).
- **Public API**:
  ```ts
  type RecallChainOptions = {
    query: string;
    source: 'scripted' | 'free-text' | 'follow-up';
    priorTurns: RecallTurn[];          // for follow-up context
    clientId: string | null;           // threaded to Seg 3 gating
    signal?: AbortSignal;
  };
  type RecallChainResult = {
    precedentId: string | null;         // null on no-anchor
    latencyMs: number;
    path: 'live' | 'offline' | 'no-anchor';
  };
  export function runRecallTurn(opts: RecallChainOptions): {
    events: AsyncIterable<ParserEvent>;
    done: Promise<RecallChainResult>;
  };
  ```
- **Dependencies**: `lib/retrieval/{cosine,embed,autocomplete,precedents-loader}`, `lib/llm/{client,segments,stream-parser,followup,retry,no-anchor}`, `lib/events`.

### 4.3 `lib/llm/followup.ts`

- **Responsibilities**: produce a **Seg 4 prefix string** that carries the running conversation into the next Claude call without blowing up Seg 3's cache-prefix discipline. Heuristic (specified per team-lead constraint):
  - Keep the **last 3 QA pairs verbatim** — `Q: ...\nA: year=..., client=..., scene=..., quote="..."` (extracted from previous `RecallTurn.card`, not the raw tagged stream).
  - Pairs older than index 3 get collapsed into a single summary line `Earlier turns (${n}): precedent ${ids.join(', ')} — themes: ${themes.join(', ')}`. Themes are derived from `RecallCardFields.tags` (first tag per turn).
  - Truncation happens client-side before the `streamCompletion` call; Seg 1/2/3 are untouched (cache hits preserved).
- **Public API**: `buildFollowupContext(priorTurns: RecallTurn[]): string` — returns a prefix that `recall-chain.ts` prepends to the user's current query inside Seg 4's dynamic payload.
- **Dependencies**: no runtime deps; pure string manipulation over `RecallCardFields`.

### 4.4 `lib/llm/retry.ts`

- **Responsibilities**: retry + degrade ladder per architecture §5.2.
  1. Attempt 1 → on Anthropic 5xx / timeout / network error → wait 2s → attempt 2 → on same error → wait 6s → attempt 3 → on same error → **degrade**.
  2. During waits, surface a `<Toast variant="loading">` via a callback passed down from `RecallPanel`.
  3. Degrade step: look up `findOfflineEntry(query)` — hit path only when `source === 'scripted'` (free-text can't have a stable cache key; architecture §5.2 note). If offline hit, synthesize chunks from the pre-recorded `tagged_stream` (split on 40-char boundaries to exercise the real chunk-boundary parser) and push through the same parser path.
  4. Offline miss → synthesize `<no_anchor/><done/>` via `no-anchor.ts` and render the same "suggest 24h Memo" card the `<NoAnchorCard/>` component would show from a genuine no-anchor cosine miss. UI-identical (grammar doc §6).
- **Public API**:
  ```ts
  type RetryCallbacks = {
    onAttempt: (attempt: 1 | 2 | 3) => void;
    onDegrade: (reason: 'offline' | 'no-anchor') => void;
  };
  export async function withRetry<T>(
    task: (attempt: number) => Promise<T>,
    cb: RetryCallbacks,
    isTransient: (err: unknown) => boolean
  ): Promise<T>;
  ```
- **Dependencies**: `lib/llm/no-anchor.ts`; consumer (`recall-chain.ts`) wires the offline-cache lookup.

### 4.5 `lib/retrieval/embed.ts`

- **Responsibilities**: get an embedding for a free-text query.
  1. **Primary**: `fetch('https://api.openai.com/v1/embeddings', { model: OPENAI_EMBED_MODEL, input })` with 5s timeout. Returns 1536-d vector.
  2. **Fallback** (OpenAI failure / timeout / no key): **tokenized keyword cosine** — lowercase + tokenize query on `/[^a-z0-9]+/`; for each precedent, emit a bag-of-words vector *over the shared token vocabulary* (union of query tokens + each precedent's `summary + scene + key_quotes.join(' ')`). The fallback short-circuits `recall-chain.ts` — instead of producing a query embedding and re-running `cosineTopK` against the 1536-d precedent embeddings, `embed.ts` exposes a second function `cosineByKeyword(query, precedents, k)` that returns the same `ScoredPrecedent[]` shape. `recall-chain.ts` picks which path to use based on whether the primary embed succeeded.
- **Public API**:
  ```ts
  export async function embedQuery(query: string, signal?: AbortSignal): Promise<number[]>;  // throws on failure
  export function cosineByKeyword(query: string, precedents: Precedent[], k?: number): ScoredPrecedent[];
  ```
- **Dependencies**: `lib/retrieval/cosine.ts` for signature re-use (not invocation); `Precedent` type from `lib/retrieval/types.ts`.

### 4.6 `lib/retrieval/autocomplete.ts`

- **Responsibilities**: prefix-match the typed query (≥2 chars) against `scripted_queries.json`. Case-insensitive. Return max 5 matches in declaration order.
- **Public API**:
  ```ts
  export function matchPrefix(input: string, pool: ScriptedQuery[]): ScriptedQuery[];
  ```
- **Dependencies**: `lib/retrieval/precedents-loader.ts` for lazy load of `scripted_queries.json`. The loader caches the parsed array in-module (safe — the panel is client-side only).

### 4.7 `app/(floating)/recall-panel/` UI split

| Component | Owns | Consumes from Phase 1 |
|---|---|---|
| `RecallPanel.tsx` | `useRecallSession` + `useRecallLifecycle`; mounts children; renders Toast rail | `lib/events`, `lib/store`, `lib/components/ErrorBoundary` |
| `RecallChrome.tsx` | chrome strip (LIVE · timer · client · `×`) | `lib/store` (reads `current_client`) |
| `ContextStrip.tsx` | 1TB panorama constants (320K / 15 / 247 / 9 per tech-design §2.9) — hardcoded; no store read | — |
| `QueryInput.tsx` | controlled `<textarea>`; fires `onSubmit(query, source)` | — |
| `AutocompleteList.tsx` | dropdown + keyboard nav; closes on Esc/blur | `lib/retrieval/autocomplete` |
| `RecallCard.tsx` | reads `RecallCardFields`; applies fade-in via CSS `@keyframes` (reuses Phase 1 `globals.css` animations) | — |
| `FellowVoiceColumn.tsx` | renders right column when `fellow_voice` non-null; hidden when absent | — |
| `NoAnchorCard.tsx` | "suggest 24h Memo" card | — |
| `ToastRail.tsx` | stacks `<Toast variant="loading">` banners for retry attempts | `lib/components/Toast` |

The container `RecallPanel.tsx` wires its `onSubmit` handler to `runRecallTurn` in `recall-chain.ts`, iterating the emitted `ParserEvent`s to reduce into `RecallCardFields`. Follow-up queries inside the same panel session auto-set `source: 'follow-up'` and pass `priorTurns`.

---

## 5. Per-item plans (the 11 items from the task brief)

### 5.1 Port `MeetingLaptopView` + `RecallSidebar` → `/recall-panel` surface

- **Files**: `RecallPanel.tsx`, `RecallChrome.tsx`, `RecallCard.tsx`, `FellowVoiceColumn.tsx`, `NoAnchorCard.tsx`.
- **Dependencies**: none inside Phase 2A (first to land).
- **Architectural translation**: The prototype `MeetingLaptopView` composites the **full laptop environment** (Chrome, Zoom PIP, dock bar) on top of a floating `RecallOverlay`. In Tauri the laptop chrome is **not** rendered — the OS is the laptop. `/recall-panel` renders **only** the `RecallOverlay` equivalent: chrome header + query input + feed + footer. The dark-glass surface (`rgba(15,27,45,0.96)` + backdrop-blur) becomes a full-window style on `body.recall-panel` in `app/(floating)/recall-panel/layout.tsx` (already Phase 1 chrome-less); on Windows the solid semi-opaque fallback from Phase 1.2 gotcha applies.
- **Correctness callouts**:
  - Port uses `className` + `app/globals.css` rules, not the prototype's inline styles. Add new CSS rules to `globals.css` under a `/* §2A recall panel */` banner using the existing token palette (`--navy`, `--paper`, `--gold`, `--crimson`) — do NOT introduce new tokens.
  - CGS term highlight helper (`highlightCgsTerms` in `RecallSidebar.jsx`) ports as a pure function in `RecallCard.tsx` that consumes `lib/methodology/tags.ts` when Phase 2C lands; Phase 2A ships with a **hardcoded `CGS_TERMS` list** mirroring the prototype (10 terms) and a TODO pointing at Phase 2C. Document the temporary duplication in a comment.
- **Acceptance**: loading `/recall-panel/` in the Tauri recall window renders the ported chrome + empty feed + query input identical in structure to the prototype (read-the-CSS, do not screenshot per `cgs-ui-design/README.md`).

### 5.2 1TB context strip constantly visible

- **Files**: `ContextStrip.tsx`.
- **Dependencies**: 5.1 (lives inside `RecallChrome`).
- **Content**: exactly the four numbers in tech-design §2.9 — `320K files / 15 years / 247 engagements / 9 frameworks`. Hardcoded constants; **do not parameterize**. PRD §3.5.2 allows mock.
- **Correctness callouts**:
  - Always visible — not gated on panel state. Renders even when turn feed is empty.
  - Uses `var(--mono)` fontFamily + `var(--gold)` numbers per prototype `CorpusPanorama`. Prototype's values (`18,432 / 2008–26 / 214 / 7`) are **replaced** with the tech-design numbers — the prototype copy drifted.
- **Acceptance**: strip renders with correct four values; unit smoke verifies no store / fixture read occurs for the strip (it's fully static).

### 5.3 Autocomplete on query input

- **Files**: `QueryInput.tsx`, `AutocompleteList.tsx`, `hooks/useAutocomplete.ts`, `lib/retrieval/autocomplete.ts`, `lib/retrieval/precedents-loader.ts`.
- **Dependencies**: 5.1 (input lives inside the panel).
- **Behaviour**:
  - Trigger when `input.length >= 2`.
  - Prefix-match case-insensitive via `matchPrefix`.
  - Keyboard: ↑/↓ moves `activeIndex`; Tab or Enter on an active item fills the textarea and closes the list, cursor at end; Esc clears `activeIndex` and closes the list (does not clear input).
  - Free-text Enter (no active autocomplete selection) calls `onSubmit(query, 'free-text')`.
- **Correctness callouts**:
  - **Selected-item submission path**: when the user picks a `ScriptedQuery`, the handler stores its `id` in a ref so `recall-chain.ts` can skip OpenAI embed and use the pre-baked vector directly. Free-text path skips this and calls `embedQuery` at runtime.
  - **Tauri focus vs cmd-K**: see §5.8 for the global-shortcut adjustment that prevents Ctrl+K from stealing keystrokes inside this textarea.
  - Dropdown must not live inside a `<form>` — pressing Enter in a form submits the form and would trigger a full-window reload on static export.
- **Acceptance**:
  - Typing `"what"` with a scripted query `"what's the closest analogue..."` shows that query at index 0.
  - ↓ then Enter fills the textarea; the subsequent `onSubmit` is called with `source: 'scripted'` and the matched `ScriptedQuery.id`.
  - Esc closes the dropdown and leaves the textarea content intact.

### 5.4 Retrieval → LLM chain (core)

- **Files**: `lib/llm/recall-chain.ts`, `lib/retrieval/embed.ts`, `lib/retrieval/precedents-loader.ts`.
- **Dependencies**: 5.3 (query + embedding decision), 5.5 (parser feed), 5.7 (follow-up context builder).
- **Chain**:
  1. Resolve embedding. Scripted path reads `ScriptedQuery.embedding`; free-text path calls `embedQuery`; on failure the chain swaps to `cosineByKeyword`.
  2. `cosineTopK` returns `[{precedent, score}]`. Check `top-1 score < THRESHOLD` → route to §5.11 no-anchor.
  3. Concat precedent IDs into a line for Seg 4 (`recall context: ${ids.join(', ')}`) and pass `precedentIds` into `streamCompletion`. The `Precedent.summary + scene + key_quotes` content is already in Seg 2 (Phase 1); Phase 2A does NOT re-inline it into Seg 4 (would invalidate cache).
  4. Wire `onDelta` → `parser.push(delta)` → async-iterator emission.
  5. On final message: write `recall_history` via Phase 1 `set('recall_history', ...)` (append-only) and emit `recall:query_complete`.
- **Correctness callouts**:
  - **Seg 3 cache prefix**: `clientId` comes from `get('current_client')` at chain-start time; DO NOT read it inside each `streamCompletion` call (would race with a client-change). Phase 1 `warmAcmeContextOnce` is triggered from `BootEffects.tsx` on `current_client` flip; 2A only *consumes* the already-warm state.
  - Threshold constant lives at the top of `recall-chain.ts` with a comment citing the proposed `0.25` value — this is a demo-tuning knob; prefer a single named constant over scattering.
  - When `source === 'follow-up'`, prepend `buildFollowupContext(priorTurns)` to the Seg 4 user text (Seg 1–3 untouched).
- **Acceptance**:
  - Scripted query dispatches top-3 IDs into `streamCompletion` without invoking OpenAI.
  - Free-text with valid `OPENAI_API_KEY` calls OpenAI once, then cosine, then Claude.
  - With `OPENAI_API_KEY` removed in `.env.local`, free-text falls back to keyword cosine and still produces a top-3 (albeit coarse) result — no thrown error at the UI layer.

### 5.5 Tagged-stream parser

- **Files**: `lib/llm/stream-parser.ts`, `lib/llm/stream-parser.test.ts`.
- **Dependencies**: none — implement before 5.4 so the chain can wire it.
- **Contract**: implement **exactly** per `docs/recall-stream-grammar.md` — all five states, the chunk-boundary buffering rules of §3.3, and the partial-emission batching of §3.4. No semantic validation here; `recall-chain.ts` optionally checks `<source_id>` against the loaded precedent list but that is not a parser responsibility.
- **Correctness callouts**:
  - **Chunk-boundary invariant** (grammar §4 worked example): after a chunk ending mid-open-tag `<cli`, the buffer must retain `<cli` literally and parser state must be `IN_OPEN_TAG`. After an open tag is committed (e.g. `<scene>`), the open-tag bytes leave the buffer — state carries tag identity. Test 2 (3-chunk split) is the canary for this.
  - **ERROR_RECOVERY never throws** — test 6 asserts `<year>2018<done/>` still emits the `done` event even though `<year>` is malformed.
  - **Partial-emission batching** is optional but recommended — emitting one partial per character is spec-legal and would make the UI flicker; coalesce per `push` call (one partial at most per `IN_CONTENT` run per `push`).
  - **`isComplete: true` always fires** — final emission is mandatory regardless of how many partials preceded it.
- **Acceptance**: all six grammar §5 seed tests pass in Vitest. CI `pnpm test:unit` goes green; these tests gate the Phase 2A merge.

### 5.6 Streaming card with per-field fade-in

- **Files**: `RecallCard.tsx`, `FellowVoiceColumn.tsx`.
- **Dependencies**: 5.5 (parser events feed), 5.4 (chain plumbs events into React state).
- **Behaviour**: `RecallPanel.tsx` reduces `ParserEvent[]` into `RecallCardFields` and passes it down. Each field applies a CSS fade-in class when its value first transitions from null/empty to non-empty. `isComplete: false` partial updates the `partial.<field>` slot (rendered with reduced opacity); `isComplete: true` promotes to the committed slot.
- **Correctness callouts**:
  - Tags and quotes append; do not dedupe (Claude is under tight prompt instructions; dedup here hides protocol drift).
  - Fellow voice is an **opt-in column**: absent → single-column layout; present → `grid-template-columns: 1fr 1fr` without remounting the left column (avoid fade-flash).
  - Use CSS `@keyframes` already in `globals.css`; do NOT introduce a CSS-in-JS dep.
- **Acceptance**: feeding a hand-crafted tagged stream into `RecallPanel.tsx` via a storybook-style route (gated under `?harness=1` query param, not a real route) renders the six content fields in the canonical order with visible fade-in transitions.

### 5.7 Multi-turn deep-dive

- **Files**: `lib/llm/followup.ts`, `hooks/useRecallSession.ts`.
- **Dependencies**: 5.4 (chain consumes `buildFollowupContext`), 5.5 (parser drives per-turn card completion before follow-up can fire).
- **Truncation heuristic** (per team-lead constraint):
  - Keep the last 3 completed QA pairs verbatim.
  - Older pairs → single summary line `Earlier turns (${n}): precedent(s) ${unique_ids} — themes: ${first_tag_per_turn}`.
  - Reconstruction from `RecallCardFields` (not raw tagged stream) — avoids re-parsing and keeps Seg 4 small.
- **Correctness callouts**:
  - Follow-up keeps Seg 3 unchanged — `clientId` must match the turn-1 `clientId`. If the user somehow changes `current_client` mid-panel (demo flow doesn't, but UI doesn't prevent), start a fresh session to avoid a cache-prefix switch mid-conversation.
  - Append a system-prompt-style header at the top of the follow-up user message: `"Follow-up — same precedent if still relevant; say so if it's a different case."` so Claude knows to either deepen the same card or pivot.
- **Acceptance**: a synthesized 4-turn scenario produces a Seg 4 payload with 3 verbatim QA pairs + 1 summary line for turn 1. Snapshot test over `buildFollowupContext` output.

### 5.8 Recall panel lifecycle

- **Files**: `hooks/useRecallLifecycle.ts`, `app/(floating)/recall-panel/page.tsx` (rewrite), `lib/shortcuts.ts` (modification).
- **Dependencies**: 5.1 (panel exists); Phase 1 `lib/events`, `lib/window`, `lib/shortcuts`.
- **Behaviour**:
  - `meeting:start` → `show()` + `repositionToMainRight()` + clear `userDismissed`.
  - `meeting:end` → `hide()`. **Do not clear** `RecallSession.turns` — preserve so the demo can scroll back after the meeting ends. Store (`recall_history`) also untouched.
  - User `×` close → `hide()` + set `userDismissed = true` inside React state (in-memory; not persisted). The `×` control lives in `RecallChrome.tsx`; clicks call `getCurrentWindow().hide()`.
  - cmd-K while panel hidden → `show()` and reset `userDismissed`. cmd-K while visible → focus the query textarea.
- **Tauri focus tweak**: Phase 1 `lib/shortcuts.ts` currently calls `recall.setFocus()` unconditionally. 2A changes the branch so that **when the panel is already visible, focus is delegated to the query textarea via a `window.postMessage('focus-query-input')` that `QueryInput.tsx` listens for** — the shortcut itself does not refocus the window chrome (prevents Ctrl+K eating the next keystroke). If we kept the current behaviour the textarea would lose focus every time the user hit Ctrl+K.
- **Correctness callouts**:
  - `userDismissed` must NOT block cmd-K re-summon — it only blocks `meeting:start` auto-show bypassing explicit dismissal. `meeting:start` increments a counter so a *fresh* meeting:start clears it. Simpler rule: `meeting:start` always resets `userDismissed = false` + shows; user `×` sets `true` + hides; cmd-K always shows + resets. (Adopt the simpler rule — documented inline.)
  - Verify `BootEffects.tsx` already calls `warmAcmeContextOnce()` on `current_client` flip (confirmed in `app/boot-effects.tsx` lines 44–49) — 2A does not touch heartbeat or warm logic.
- **Acceptance**:
  - Navigate main → `/meeting`: recall window appears with panel filled.
  - Navigate away: recall window hides; turns preserved if re-shown.
  - Press `×` on panel → hides; cmd-K re-shows.
  - With panel visible, cmd-K focuses the textarea without flashing or re-positioning.

### 5.9 Retry + fallback chain

- **Files**: `lib/llm/retry.ts`, `lib/llm/no-anchor.ts`, `lib/components/Toast.tsx` (reuse — no changes).
- **Dependencies**: 5.4 (chain is the retry client), 5.5 (offline synthetic chunks pipe through parser).
- **Behaviour**: architecture §5.2 ladder implemented as `withRetry(...)` wrapping `streamCompletion`. Transient predicate matches Anthropic 5xx, 408/429, and `AbortError` from timeout. Two retries (attempts 2 and 3) with 2s/6s waits; toasts issued on each retry via `onAttempt`.
- **Offline cache hit path**: only `source === 'scripted'` can hit. Keyed by exact `query` string. On hit, retrieve `tagged_stream`, slice into 40-char chunks, `setTimeout(push, 60ms * i)` to exercise the chunk-boundary parser (the 60ms interval approximates real Claude streaming cadence and is a demo-feel knob). Emits the same `ParserEvent` stream → UI renders identically to a live hit but `latencyMs` is set to `null` + `path: 'offline'` (visually flagged as a small `offline` pill inside the card footer).
- **No-anchor synthesizer** (`no-anchor.ts`): returns `<no_anchor/><done/>` as a single synthetic chunk. Pipes through parser per grammar §6 — `<NoAnchorCard/>` component watches `card.no_anchor === true`.
- **Correctness callouts**:
  - **Cache key collision**: two `ScriptedQuery.query` strings that differ only in capitalization or trailing whitespace would silently collide on lookup. Loader step normalizes via `trim()` only (lowercase WOULD cause VP-visible capitalization to not match — intentionally preserve case). Enforce uniqueness with a dev-time invariant in `scripts/test-phase-0.js`: all `ScriptedQuery.query` strings must be unique after `trim()`.
  - **Cache TTL under slow Claude**: the 2+6 = 8s backoff plus each attempt's real latency can push total-turn latency above the PRD §3.6.2 budget (first-hit <15s). Document this in risk §6.1 — the demo assumes at most one retry before the audience notices; second-retry + offline-cache path should only fire in a genuinely degraded run.
  - **Retry scope**: wrap only the Claude stream call, not the embed step. An OpenAI embed failure falls immediately to the keyword fallback — no 2×6s detour before the user sees any UI.
- **Acceptance**:
  - Inject a 503 on the first Claude call (vitest mock) → second attempt succeeds → `Toast variant="loading"` renders once, then dismisses when stream starts.
  - Inject 503 three times with a matching offline entry → offline card renders with `path: 'offline'`.
  - Same as above without offline entry → no-anchor card renders.

### 5.10 Fellow-voice double column (CUTTABLE)

- **Files**: `FellowVoiceColumn.tsx`, usage in `RecallCard.tsx`.
- **Dependencies**: 5.6.
- **Behaviour**: when parser emits `fellow_voice`, right column appears; otherwise card stays single-column.
- **Cut point** (per team-lead constraint): **if Phase 2A slips**, drop `FellowVoiceColumn.tsx` and route `fellow_voice` events into a `<div class="fellow-rewrite-inline">` below the main quote inside `RecallCard.tsx`. Parser and chain are untouched — only the layout component disappears. impl-plan §2A lists this as the canonical cuttable. Flag to implementer: **the grammar keeps `<fellow_voice>` optional (cardinality 0 or 1)**, so content owners may also elide it in scripted queries if we want to reduce LLM token cost.
- **Acceptance**: toggle at build time by swapping the component — no parser, chain, or fixture change required. If cut, one inline-rewrite visual covers both forms.

### 5.11 No-anchor fallback (cosine threshold path)

- **Files**: `lib/llm/no-anchor.ts`, `NoAnchorCard.tsx`.
- **Dependencies**: 5.4 (chain picks this branch), 5.5 (parser handles `<no_anchor/>`).
- **Behaviour**: when `cosineTopK` top-1 `score < 0.25` (constant at top of `recall-chain.ts`), chain **skips Claude entirely** and feeds the synthetic `<no_anchor/><done/>` chunk into the parser. Parser emits `{field: 'no_anchor', value: true, isComplete: true}` + `{field: 'done', value: true, isComplete: true}`. `RecallPanel` switches to `<NoAnchorCard/>` which renders the "No high-confidence precedent — suggest 24h Memo" text per PRD §3.6.2 触发组二.
- **Correctness callouts**:
  - Render path is **identical** for cosine-miss no-anchor vs offline-miss no-anchor per grammar doc §6 — do not fork the UI.
  - Do NOT write `recall_history` with `precedent_id: null` — Phase 1 `RecallHistoryEntry.precedent_id` allows `null`, so the write is typesafe, but the **demo explicitly shows `recall_history` later**: skip the write if `precedentId === null` so the history looks clean. Document this in a comment.
- **Acceptance**: injecting an embedding orthogonal to the precedent library triggers the no-anchor card without an Anthropic call (verified via mock that throws if called).

---

## 6. Risk callouts

### 6.1 Cache TTL under slow Claude
Anthropic ephemeral cache is ~5 min. If the retry ladder fires (2s + 6s + second-attempt latency), a follow-up that assumed a warm cache can cross the boundary. Mitigation: Phase 1 keep-alive heartbeat (4.5 min) covers steady-state; during a burst of retries the second follow-up may eat a cold re-read. **Do not** try to extend TTL — accept the one-in-a-hundred cold re-read as acceptable demo risk.

### 6.2 Parser error-recovery visibility
`ERROR_RECOVERY` is silent — the UI would see the turn fail to progress with no log. Mitigation: when parser enters ERROR_RECOVERY, it emits **no event** per grammar §3.2, which is correct, but `recall-chain.ts` should log a `console.warn('[recall] protocol violation dropped')` at the point it detects no new events arriving within a 3s sliding window while the stream is still open. Add a minimal watchdog; do not escalate to the UI.

### 6.3 Offline cache key collision
Cache is keyed by exact (trimmed) `query` string. If two scripted queries share a trimmed prefix, `findOfflineEntry` will return the first match and the second query will render a wrong precedent card. Mitigation: `scripts/test-phase-0.js` extension checks `scripted_queries[].query` uniqueness after trim (see §5.9 correctness callout). Also: offline lookup only fires when `source === 'scripted'` — free-text bypasses the table entirely.

### 6.4 Autocomplete keyboard UX in Tauri webview
`tauri-plugin-global-shortcut` registration of Ctrl+K interferes with text input focus. Phase 1 unregisters the shortcut when the recall panel is visible (`shortcuts.ts` gotchas comment). 2A needs to verify this path survives the lifecycle changes in §5.8. Risk: if the user opens, types, closes panel — shortcut must re-register. Validation: manual smoke test in the exit gate — summon / type "wh" / see autocomplete / Esc / close × / cmd-K re-summons → type works.

### 6.5 Free-text OpenAI path over a static-export boundary
Hitting `api.openai.com` from a static export means the browser-shipped bundle carries `OPENAI_API_KEY`. This is already documented as an accepted trade-off in `lib/llm/client.ts` (Tauri single-host). The risk is a developer accidentally running `pnpm dev` in a browser outside Tauri and leaking the key in devtools network panel during testing. Mitigation: `.env.local` lives outside git (Phase 0.3); Phase 2A does not re-expose any key. Document inline in `embed.ts`.

### 6.6 Content-owner fixture gap
Phase 2A ships empty / skeletal `scripted_queries.json`, `offline_cache.json`, and `precedents.json` (beyond the Phase 0 example). The chain works with zero entries — autocomplete shows nothing, scripted path never fires, free-text + keyword fallback is the only live path. This is **acceptable**: Phase 2A is code; impl-plan §3.A content arrives separately and impl-plan §3.1/3.4 scripts backfill embeddings/offline cache deterministically from committed text. Implementer must NOT block on content.

---

## 7. Order of implementation (numbered DAG)

1. **Write `lib/llm/stream-parser.ts` + 6 seed tests** first. No deps; establishes the contract everything downstream consumes.
2. **Write `lib/llm/no-anchor.ts`** — trivial synthetic stream builder; needed by retry + no-anchor branches.
3. **Write `lib/retrieval/precedents-loader.ts`** — lazy loaders for `precedents.json` and `scripted_queries.json`. Stub shapes if files empty.
4. **Write `lib/retrieval/autocomplete.ts` + test** — pure prefix match.
5. **Write `lib/retrieval/embed.ts` + test** — OpenAI fetch + tokenized keyword fallback (`cosineByKeyword`).
6. **Write `lib/llm/followup.ts` + test** — pure truncation heuristic; no async.
7. **Write `lib/llm/retry.ts` + test** — mock `streamCompletion`-shaped task; assert attempt counts, backoff delays, degrade callbacks.
8. **Write `lib/llm/recall-chain.ts` + integration test** — compose 1–7; mock `streamCompletion` and `cosineTopK`.
9. **Write `fixtures/*.schema.json` + extend `scripts/test-phase-0.js`** to validate `scripted_queries.json` / `offline_cache.json` / `precedents.json` when they appear. Validates zero entries too.
10. **Port `RecallChrome.tsx` + `ContextStrip.tsx`** — pure presentational.
11. **Port `QueryInput.tsx` + `AutocompleteList.tsx` + `useAutocomplete.ts`** — keyboard UX isolated in this step so we can manually test before chain wiring.
12. **Port `RecallCard.tsx` + `FellowVoiceColumn.tsx` + `NoAnchorCard.tsx`** — presentational; consumes `RecallCardFields`.
13. **Build `hooks/useRecallSession.ts`** — reduces `ParserEvent[]` into `RecallTurn.card`; manages `turns` array.
14. **Build `hooks/useRecallLifecycle.ts` + modify `lib/shortcuts.ts`** — per §5.8.
15. **Rewrite `app/(floating)/recall-panel/page.tsx`** to mount `RecallPanel.tsx`; smoke the full chain in Tauri.

---

## 8. Test strategy

| Layer | Files | What it asserts |
|---|---|---|
| **Unit** | `lib/llm/stream-parser.test.ts` | all 6 grammar seed cases (MERGE GATE) |
| **Unit** | `lib/llm/followup.test.ts` | truncation heuristic: ≤3 → verbatim; >3 → last 3 verbatim + 1 summary line |
| **Unit** | `lib/llm/retry.test.ts` | 2 transient failures → success on 3rd; 3 transient + offline hit → offline path; 3 transient + offline miss → no-anchor path; toast callbacks fire at each attempt |
| **Unit** | `lib/retrieval/autocomplete.test.ts` | prefix match case-insensitive; empty input → empty; <2 chars → empty; >5 matches → truncated to 5 |
| **Unit** | `lib/retrieval/embed.test.ts` | `cosineByKeyword` correctness over hand-built precedents; `embedQuery` throws on missing key |
| **Integration** | `lib/llm/recall-chain.test.ts` | scripted path skips embed; free-text calls embed; threshold miss skips Claude; follow-up prepends context to user message |
| **Manual smoke (Tauri)** | exit-gate checklist §9 | lifecycle, keyboard UX, retry Toast, offline render, no-anchor render |

No E2E (Playwright) in Phase 2A — impl-plan §测试策略 prohibits it; manual checklist covers the UI paths. The Phase 0 `test:phase-0` script is extended in step 9 of §7 to validate new fixture schemas — free.

**Grammar §5 seed tests are non-negotiable for Phase 2A merge** (impl-plan risk R2 + phase-0-plan §Risks). If any of the 6 fails, merge is blocked.

---

## 9. Exit gate

Phase 2A is done when **every** box below is checked:

- [ ] `pnpm test:unit` passes; all 6 grammar §5 seed tests green in `stream-parser.test.ts`.
- [ ] `pnpm test:unit` runs include new `followup.test.ts`, `retry.test.ts`, `autocomplete.test.ts`, `embed.test.ts`, `recall-chain.test.ts` all green.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm build` still produces `out/recall-panel/index.html`.
- [ ] `pnpm test:phase-0` validates `fixtures/scripted_queries.json` and `fixtures/offline_cache.json` against new schemas (even when empty-entries valid).
- [ ] Recall panel lifecycle observed via manual smoke:
  - Navigate main → `/meeting` → recall panel shows at main-right+8, panel renders chrome/context strip/query input.
  - Navigate away → recall hides; turn feed preserved on re-show.
  - Press `×` on panel → hides; cmd-K re-shows.
  - cmd-K with panel visible → textarea gains focus, no chrome flash.
- [ ] Autocomplete UX smoke:
  - Typing `"wh"` (assuming a `"what..."` scripted query exists) → dropdown appears with match.
  - ↑/↓ changes highlight; Tab/Enter fills textarea; Esc closes dropdown.
  - Free-text Enter dispatches `source: 'free-text'`.
- [ ] Scripted-query live path:
  - With valid `.env.local`, autocomplete → Enter → card streams fields in grammar-canonical order with visible fade-in.
  - `recall_history` store gains one entry with the correct `precedent_id`.
  - `recall:query_complete` event observed on main window listener (console log smoke).
- [ ] Free-text path:
  - Without autocomplete match, Enter → OpenAI embed → cosine → Claude stream → card renders.
- [ ] Keyword fallback path:
  - Remove `OPENAI_API_KEY` from `.env.local`; restart; free-text Enter still produces a card (coarse match OK; no UI error).
- [ ] Retry chain fires and Toast shows:
  - Simulate Anthropic 503 via `ANTHROPIC_MODEL=invalid-model` or environment kill — Toast loading banner appears during backoff; eventual fallback to offline card (if scripted) or no-anchor card (if free-text).
- [ ] No-anchor fallback path:
  - Construct a query whose embedding is orthogonal to all precedents → no-anchor card renders without any Anthropic call (verified via `cache_creation_input_tokens + cache_read_input_tokens === 0` increment — heartbeat's prior increments still visible but no NEW cost).
- [ ] Offline fallback path:
  - With Claude killed and a matching `offline_cache.json` entry, the same card as live renders (annotated with `offline` pill).
- [ ] Multi-turn deep-dive:
  - After turn 1 completes, type a follow-up → `buildFollowupContext` includes the prior QA; new card renders; Seg 1–3 cache still hits (`cacheReadInputTokens > 0` logged).
- [ ] Fellow-voice column:
  - A scripted query that emits `<fellow_voice>` shows the right column; a scripted query without `<fellow_voice>` keeps single column.
- [ ] Parser protocol-violation smoke:
  - Hand-craft a malformed tagged stream in the `?harness=1` test route → card renders whatever was valid + `<done/>`; no uncaught exception.
- [ ] This plan `docs/phase-plans/phase-2a-plan.md` committed.
- [ ] Content-owner fixture work (real `scripted_queries.json` / `offline_cache.json` / `precedents.json` bodies) flagged as **out-of-scope for Phase 2A** per §3.A — reminders sent to content owner; no block on merge.

When all boxes are green: **Phase 2A ships → Phase 2B (Fellow Override) may start** (impl-plan §2B prereqs 1.2 / 1.3 / 1.7 / 1.8 / 1.9 / 1.12 all satisfied; 2B reuses the stream parser and retry/toast ladder from 2A).
