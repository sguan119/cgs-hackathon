# Phase 3 Implementation Plan — Fixture Generation Scripts

## 1. Overview

Phase 3 delivers the **four manual, one-shot `pnpm gen:*` scripts** that backfill the derived fields in committed fixtures (embeddings, diagnostic F1-F5 outputs, override-cache entries, offline Recall stream cache) plus a **non-blocking CI mtime check** that warns when a source file has drifted past its derived artifact. Every script is engineering-only: it reads committed source fixtures + calls Anthropic / OpenAI with the keys in `.env.local`, writes its output back into the same `fixtures/` tree, and is re-run **manually** by the engineer after content owner edits — outputs commit into the repo. Nothing in Phase 3 runs at app boot, at `pnpm build`, in CI auto-fix, or inside the Tauri shell; impl-plan §Phase 3 is explicit that these are operator-triggered. Content fills (§3.A — real Acme memos, Globex drilldown, scripted query final text, email bodies) remain **out of Phase 3 scope** per impl-plan; this plan locks the **shapes, CLI contracts, prompt strategies, idempotency rules, and mtime-check format** so content-arrival immediately unblocks each gen script. Reuse is strict: `lib/llm/client.ts` (Claude streaming + 4-seg cache), `lib/llm/retry.ts` (withRetry ladder), `lib/retrieval/embed.ts` (OpenAI embed path), `lib/override/cache-loader.ts` types (OverrideCache shape), `lib/toneguard/validate.ts` (post-write verdict round-trip assertion on diagnostic F3 outputs), and the five fixture JSON Schemas (`precedents.schema.json`, `scripted_queries.schema.json`, `offline_cache.schema.json`, `override_cache.schema.json`, `continuity_fixtures/email-fixture.schema.json`). No library code changes; all new surface lives under `scripts/` + one `lib/gen/` shared helper dir for prompt builders and the schema-validator shim.

---

## 2. Directory deltas (new files only)

```
scripts/
  gen-precedent-embeddings.ts               # 3.1 — OpenAI batch embed for fixtures/precedents.json
  gen-scripted-query-embeddings.ts          # 3.1b — sibling script for fixtures/scripted_queries.json (same embed path)
  gen-diagnostic-fixtures.ts                # 3.2 — Claude pre-runs §2 F1-F5, writes fixtures/diagnostic_fixtures/*.json
  gen-override-cache.ts                     # 3.3 — Claude bakes Strategic Innovation × {low,mid,high} → override_cache.json
  gen-offline-cache.ts                      # 3.4 — Claude pre-runs Recall per scripted query → offline_cache.json
  gen-shared/
    env.ts                                  # load .env.local + assert required keys; shared across all gen scripts
    args.ts                                 # tiny CLI arg parser (--dry-run / --confirm / --only / --verbose)
    logger.ts                               # structured stdout: [gen:xxx] INFO / WARN / ERROR prefixes
    schema.ts                               # ajv compile + validate helper (loads schema from fixtures/*.schema.json)
    diff.ts                                 # JSON diff summary for --dry-run output (path + before/after lengths)
    mtime.ts                                # shared helper between 3.5 check and gen scripts (timestamp compare)
    openai-embed.ts                         # batched OpenAI /v1/embeddings caller (reuses logic from lib/retrieval/embed.ts)
    claude-call.ts                          # non-streaming wrapper around lib/llm/client.ts (collects fullText via onDelta)
    tags-prompt.ts                          # shared snippet: "emit tags in this grammar; do not paraphrase" — imported by 3.3 + 3.4
  check-fixture-mtimes.ts                   # 3.5 — non-blocking stale warning runner
fixtures/
  diagnostic_fixtures/
    f1.json                                 # NEW — emitted by 3.2; F1 "external pressure" panel
    f2.json                                 # NEW — emitted by 3.2; F2 wheel-coloring map
    f3.json                                 # NEW — emitted by 3.2; F3 inertia hypotheses (superset of initial_hypotheses.json)
    f4.json                                 # NEW — emitted by 3.2; F4 intervention candidates
    f5.json                                 # NEW — emitted by 3.2; F5 interview-question menu
    diagnostic-fixture.schema.json          # NEW — locks shape of f1-f5 outputs; validated by 3.2 post-write + test-phase-0
  acme_fixtures/                            # NEW DIRECTORY — content-owner sources (read by 3.2)
    memo.md                                 # CEO memo body (content-owner deliverable; stub committed with TODO)
    org.md                                  # Org-chart text (content-owner deliverable; stub with TODO)
    call.md                                 # Q3 earnings-call transcript (content-owner deliverable; stub with TODO)
    .gitkeep                                # ensures dir exists pre-content delivery
.gitignore additions (see §10):
  scripts/.gen-cache/                       # gen-script intermediate state (checksums, partial outputs on retry)
  scripts/.gen-cache/*.json
```

No changes to `package.json` deps unless §6.2 flags a gap. `tsx` is **already transitively available** via `@vitejs/plugin-react` → no new top-level dep expected (see §6.3 for verification). No Rust / Tauri / capability changes. No new `.env.local` keys (scripts reuse `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OPENAI_API_KEY`, `OPENAI_EMBED_MODEL` from Phase 0.3).

---

## 3. Data shapes

### 3.1 `CliArgs` — shared across all gen scripts (`scripts/gen-shared/args.ts`)

```ts
export type GenCliArgs = {
  dryRun: boolean;       // --dry-run: compute outputs, print diff summary, DO NOT write
  confirm: boolean;      // --confirm: required to overwrite a non-empty derived artifact (opt-in safety)
  only?: string;         // --only=<id>: limit to a single entry (precedent id, scripted_query id, etc.)
  verbose: boolean;      // --verbose: per-entry log line + raw Claude output echoed
  help: boolean;         // --help: print usage
};
```

**Defaults**: all flags false / undefined. `--dry-run` wins over `--confirm` when both present (dry-run never writes). `--only` is a single-value string; no list form — chain multiple invocations if needed. `--help` prints the script's doc block and exits 0.

### 3.2 Shared LLM call result (`scripts/gen-shared/claude-call.ts`)

```ts
export type ClaudeCallResult = {
  fullText: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
  latencyMs: number;
  model: string;
};
```

Wraps `streamCompletion` from `lib/llm/client.ts`: collects all `onDelta` chunks into `fullText`, awaits `onComplete`, returns. **Scripts never display streaming output** — they need the final artifact to JSON-serialize. Errors propagate to `withRetry`.

### 3.3 Diagnostic fixture outputs (`fixtures/diagnostic_fixtures/*.json`)

Each of F1-F5 has its own tightly-scoped shape. Phase 2B already ships `initial_hypotheses.json` with the baseline inertia hypotheses the Diagnostic page reads on mount; F3 is a **superset** (adds authored rationale per hypothesis + per-evidence span metadata the Claude pre-run produces) and is written to a distinct `f3.json` file so 2B's skeletal file is not clobbered by 3.2 on first run. The `initial_hypotheses.json` → `f3.json` migration path is documented in the script output.

```ts
// fixtures/diagnostic_fixtures/f1.json — external-pressure panel (tech-design §2.5 F1)
export type DiagnosticF1 = {
  headline: string;              // one-line summary ("Market moved while thesis didn't")
  signals: Array<{
    source_id: string;           // must match a precedents[].source_id OR acme_fixtures source tag
    quote: string;               // verbatim
    observed_at: string;         // "Q3 2025" — free-form but non-empty
  }>;
  generated_at: string;          // ISO8601
  model: string;                 // e.g. "claude-sonnet-4-5"
};

// fixtures/diagnostic_fixtures/f2.json — wheel re-color map (tech-design §2.5 F2)
export type DiagnosticF2 = {
  scores: Record<StrategyDimensionId, 1|2|3|4|5|6|7>;  // 7-key map; StrategyDimensionId from lib/override/dims.ts
  color_sequence: StrategyDimensionId[];               // animation order the Diagnostic page replays on mount
  generated_at: string;
  model: string;
};

// fixtures/diagnostic_fixtures/f3.json — authored inertia hypotheses (tech-design §2.5 F3)
export type DiagnosticF3 = {
  hypotheses: InertiaHypothesis[];   // reuses the Phase 2B type from lib/override/dims.ts
  rationale: string;                 // overall "why these hypotheses, in this order"
  generated_at: string;
  model: string;
};

// fixtures/diagnostic_fixtures/f4.json — intervention candidates
export type DiagnosticF4 = {
  interventions: Array<{
    id: string;                  // stable slug, matches InertiaHypothesis.intervention_ids references
    label: string;
    body: string;
    linked_hypotheses: string[]; // InertiaHypothesis.id[]
    horizon: 'first-mile' | 'horizon-2' | 'horizon-3';
  }>;
  generated_at: string;
  model: string;
};

// fixtures/diagnostic_fixtures/f5.json — interview question menu
export type DiagnosticF5 = {
  questions: Array<{
    id: string;
    prompt: string;
    target_stakeholder: 'ceo' | 'cfo' | 'coo' | 'cio' | 'board';
    links_to_hypothesis: string | null;   // InertiaHypothesis.id or null
  }>;
  generated_at: string;
  model: string;
};
```

All five shapes share the `generated_at` + `model` trailer so mtime-check §3.5 can cross-reference script-reported provenance against file mtime.

**Schema location**: `fixtures/diagnostic_fixtures/diagnostic-fixture.schema.json` — a single schema file with five `definitions` entries (`F1`, `F2`, `F3`, `F4`, `F5`). The script validates each output against its corresponding definition before writing.

### 3.4 Mtime-check report (`scripts/check-fixture-mtimes.ts`)

```ts
export type MtimePair = {
  source: string;                // absolute path or repo-relative
  derived: string;
  sourceMtimeMs: number;
  derivedMtimeMs: number | null; // null when derived file missing entirely
  stale: boolean;                // sourceMtimeMs > derivedMtimeMs (or derived missing)
  genCommand: string;            // "pnpm gen:precedent-embeddings" — suggested re-run
  reason: 'missing' | 'newer-source' | 'ok';
};

export type MtimeReport = {
  pairs: MtimePair[];
  stalePairs: MtimePair[];
  ok: boolean;                   // true iff no stale pairs
  generatedAt: string;           // ISO8601
};
```

Stdout format (human-friendly, one line per pair when `--verbose`; else summary + stale-only table). Exit code: **always 0** — this is a non-blocking warning (impl-plan §3.5 "不 block — 只提醒"). Machine-readable JSON emitted with `--json` for CI integration.

### 3.5 OpenAI embed batch response (`scripts/gen-shared/openai-embed.ts`)

```ts
export type EmbedBatchInput = {
  items: Array<{ key: string; text: string }>;  // key = precedent.id or scripted_query.id
};

export type EmbedBatchResult = {
  embeddings: Array<{ key: string; vector: number[] }>;
  usage: { promptTokens: number; totalTokens: number };
  model: string;                 // echoed from OPENAI_EMBED_MODEL
};
```

Single HTTP call: `POST /v1/embeddings` with `{ model, input: items.map(i => i.text) }`. OpenAI returns vectors in the same order as `input[]`; the helper re-zips with `items[].key` to produce the result. One HTTP call serves up to 2048 inputs (OpenAI limit) which comfortably covers 15 precedents + 10 scripted queries.

---

## 4. Script design — per-script detail

### 4.1 `scripts/gen-precedent-embeddings.ts` (impl-plan §3.1)

**CLI invocation**
```
pnpm gen:precedent-embeddings [--dry-run] [--confirm] [--only <id>] [--verbose]
```

**Input**
- Read `fixtures/precedents.json` (array of `Precedent`).
- Validate against `fixtures/precedents.schema.json` before touching embeddings — fail-fast if shape drift.

**Output**
- Write back to `fixtures/precedents.json` with each entry's `embedding` field replaced by the 1536-d vector from OpenAI. All other fields untouched (byte-stable JSON ordering preserved via 2-space indent + trailing newline — matches existing fixture style).

**LLM prompt construction**
- `text` per entry = `concatFields(p)`:
  ```
  ${p.client_name} ${p.year} — ${p.scene}
  ${p.summary}
  Tags: ${p.cgs_tags.join(', ')}
  ${p.key_quotes.join(' / ')}
  ${p.drilldown_layers.flatMap(l => l.quotes).join(' / ')}
  ```
  — deterministic concat: changing `client_name` casing changes the vector, so content stability is preserved end-to-end.
- Single OpenAI batch call: `embedBatch({ items: precedents.map(p => ({ key: p.id, text: concatFields(p) })) })`.
- Model pinned to `process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small'`. Logged to console.

**Retry / error handling**
- Wrap the OpenAI call in `withRetry(openaiEmbed, { onAttempt, onRetryWait })` (reuse `lib/llm/retry.ts`). `isTransientError` already classifies 5xx / 408 / 429 / network.
- On non-transient (401 invalid key, 400 bad input) → log clear error + exit 1.
- Fail-fast if `OPENAI_API_KEY` missing: `"OPENAI_API_KEY missing — set in .env.local. See .env.local.example."`.

**Idempotency**
- Deterministic given the same `concatFields(p)` + same model + OpenAI API stability. Re-running without any source change should produce byte-identical vectors (OpenAI `text-embedding-3-small` is deterministic per their docs; the script does not set a seed — if drift appears, log a warning with the first-diverging dimension).
- `--only <id>` overwrites only that entry's embedding; other entries untouched (both bytes and mtime stay stable in the unchanged slots — re-serialize the full file but preserve existing embeddings verbatim, so the file mtime bump is the only side effect on non-targeted entries).

**Rate limiting / batching**
- One HTTP call total (OpenAI batch). No per-entry loop, no per-entry retry.
- If `precedents.length > 2048` (never expected) → chunk into batches of 2048; back-off 1s between batches.

**Safety**
- `--dry-run`: compute new embeddings, print per-entry `"[precedent globex-2018-cdo] embedding: old=0-d new=1536-d Δ=+1536"` and exit 0 without writing.
- `--confirm` **not required** for embeddings script (embeddings are pure derived data; accidental re-runs are harmless — no human-authored state is overwritten). Documented inline.

**Exit criteria (self-asserted by script)**
- All precedent entries have `embedding.length === 1536`.
- Output revalidates against `precedents.schema.json`.
- Log summary: N entries, model, OpenAI usage, wall time, file bytes before/after.

### 4.1b `scripts/gen-scripted-query-embeddings.ts` (supplementary)

**Rationale**: impl-plan §3.1 text says "precedents.json" but Phase 2A §3.1 `ScriptedQuery.embedding` is identical-shape (1536-d from the same OpenAI model). Bundling into 4.1 risks a diff that touches unrelated files; splitting into a sibling script keeps each `gen:*` command one-purpose. Both reuse `scripts/gen-shared/openai-embed.ts`.

**CLI**: `pnpm gen:scripted-query-embeddings [flags]` — same flags as 4.1.

**Input/output**: `fixtures/scripted_queries.json` in, same file out. Embed text = `ScriptedQuery.query` (verbatim).

Everything else mirrors 4.1. Note: **`gen:embeddings` top-level alias** (see §6) runs 4.1 + 4.1b sequentially for engineer convenience.

### 4.2 `scripts/gen-diagnostic-fixtures.ts` (impl-plan §3.2)

**CLI**
```
pnpm gen:diagnostic-fixtures [--dry-run] [--confirm] [--only f1|f2|f3|f4|f5] [--verbose]
```

**Input**
- `fixtures/acme_fixtures/memo.md` + `org.md` + `call.md` — text bodies (content-owner deliverable).
- `fixtures/precedents.json` — for provenance cross-references in F1 `signals[].source_id`.
- `lib/override/dims.ts` — for `StrategyDimensionId` enum in F2.
- Existing `fixtures/diagnostic_fixtures/initial_hypotheses.json` is **not consumed** by this script; the Claude-authored `f3.json` replaces it conceptually but both coexist (Phase 4.2 chooses which to render — Phase 3 only generates).

**Output**
- Five files: `fixtures/diagnostic_fixtures/{f1,f2,f3,f4,f5}.json`. Validated against `diagnostic-fixture.schema.json` before write.
- Script reports per-file "written" / "unchanged" (byte-hash comparison to skip no-op writes → preserve mtime).

**LLM prompt construction**
- Five sequential Claude calls, one per F. Cannot parallelize because F3 consumes F1+F2 (builds hypotheses grounded in F1 signals + F2 lowest-score dim), F4 consumes F3, F5 consumes F3+F4.
- Seg 1/2 reuse the app's `buildSeg1Framework()` + `buildSeg2Precedents()` via `scripts/gen-shared/claude-call.ts` → `lib/llm/client.ts` — **same cache prefix as runtime**, so each gen-run warms the same cache the app uses in production. Cache-prefix discipline from Phase 1 segments.ts inherits verbatim.
- Seg 3 = `buildSeg3AcmeContext('acme')` — gen scripts ALWAYS run in Acme context; content-owner sources are Acme.
- Seg 4 = per-F prompt template (authored inline in `gen-diagnostic-fixtures.ts` — not exported; not a library surface). Each template ends with:
  ```
  Return ONLY valid JSON matching the schema for ${targetFile} (see diagnostic-fixture.schema.json §definitions.${targetDef}).
  Do not wrap in markdown fences. Do not add commentary.
  ```
- Example F1 Seg 4:
  ```
  Using only the attached Acme materials:
    - memo.md
    - org.md
    - call.md
  and the precedent library from Seg 2, produce F1 external-pressure signals.
  Extract 3–5 verbatim quotes attributable to specific source_ids.
  Do not invent signals not grounded in the source text.
  Return JSON: { headline: string, signals: [{source_id, quote, observed_at}], ... }
  ```
- **Parser strategy**: extract the JSON object from `fullText` (tolerate leading/trailing whitespace + optional markdown code fence). Use a narrow sanitizer: strip ```` ```json ```` / ```` ``` ```` if present, then `JSON.parse`. If parse fails, log the raw response to `scripts/.gen-cache/<F>-raw.txt` and exit 1 with a pointer. No retry on parse failure — it's a Claude determinism issue, engineer reviews.

**Retry / error handling**
- Each Claude call wrapped in `withRetry` with default delays (2s / 6s / fail) — reuse `lib/llm/retry.ts`.
- `max_tokens: 4096` ceiling per call (diagnostic fixtures are 1–3 KB JSON; headroom included for F3 narrative rationale).
- `signal`: a single 60s timeout AbortController per call. Time budget for the whole script is ~5 × 45s = 225s worst case.
- Schema-validate the parsed JSON; if `validate(parsed) === false`, log ajv errors with line numbers and exit 1 (no retry — model compliance issue, human review).

**Idempotency**
- Claude is non-deterministic even at `temperature: 0`; script is **explicitly not idempotent**. Document this prominently in script header + output:
  ```
  NOTE: Claude outputs are non-deterministic. Re-running this script will
  produce semantically similar but textually different fixtures. Do not
  re-run casually; commit the output and treat the committed JSON as the
  source of truth for Phase 4.2 rendering.
  ```
- `--confirm` flag **required** when any of the five target files already exists and `--dry-run` is false. Prevents accidental clobber of a content-reviewed fixture. Flag is self-documenting via `--help`.
- `--only f3`: regenerate just F3, keep F1/F2/F4/F5 files on disk unchanged. Dependency check: if `--only f3` but F1 or F2 file missing, abort with a message telling the engineer to generate upstream first or add them to the invocation.

**Rate limiting / batching**
- Sequential — no concurrency. 5 Claude calls with cache hits on Seg 1+2+3 after the first call means only Seg 4 + output tokens scale.
- Between calls: no sleep required (Anthropic rate limits are far above 5 cpm).

**Exit criteria**
- All five files either written (fresh or with diff summary) or reported unchanged.
- Each file validates against its schema definition.
- Optional post-write check: if F4 `intervention_ids` references an F3 hypothesis id that does not exist, log a warning (script does not fail — cross-file consistency is a review signal, not a gate — but surfaces the drift).

### 4.3 `scripts/gen-override-cache.ts` (impl-plan §3.3)

**CLI**
```
pnpm gen:override-cache [--dry-run] [--confirm] [--only low|mid|high] [--verbose]
```

**Input**
- `fixtures/override_cache.json` (current state — to preserve entries outside the "default minimum set" being regenerated).
- `lib/override/dims.ts` for dim/bucket enums.
- `fixtures/precedents.json` (for evidence `source_id` references).
- Phase 2B's Phase-1-sourced Seg 3 (Acme context) — same as 4.2.

**Output**
- Write back `fixtures/override_cache.json`. **Merge semantics**: regenerate only the Strategic Innovation × {low, mid, high} entries per the default minimum set (tech-design §1 + architecture.md §4.3). Entries outside that set are preserved verbatim (including their `baked_at` timestamps). This lets a future "widen the bake" decision (impl-plan §7.1 risk) extend the script without orphaning existing entries.

**LLM prompt construction**
- Three sequential Claude calls, one per bucket. Each emits a single `OverrideCacheEntry` (minus the `baked_at` field — script fills that post-parse with `new Date().toISOString()`).
- Seg 1/2/3 from `lib/llm/segments.ts`; Seg 4 inline prompt:
  ```
  Simulate an override: wheel dimension "strategic_innovation" set to bucket=${bucket}
  (low|mid|high). Produce the replacement InertiaHypothesis[] + rationale.

  Scope discipline:
    - Only hypotheses AFFECTED by this score change. Do not regenerate the
      entire diagnostic — this is a DELTA.
    - Each hypothesis must cite evidence via source_id + quote from the
      precedent library (Seg 2) or Acme context (Seg 3).
    - Reference intervention ids from the canonical intervention catalog
      (prefix int-<slug>).

  Return ONLY JSON matching the OverrideCacheEntry schema
  (fixtures/override_cache.schema.json §definitions.OverrideCacheEntry).
  Exclude the `baked_at` field — the build script fills it.
  ```
- Parser: same JSON-extract strategy as 4.2. Schema-validate each entry against `override_cache.schema.json` (build a single-entry sub-schema from `definitions.OverrideCacheEntry` — ajv compile once, reuse across the three buckets).

**Retry / error handling**
- Per-bucket: `withRetry` with defaults. `max_tokens: 4096`. 60s timeout.
- On parse failure: raw output → `scripts/.gen-cache/override-${bucket}-raw.txt`; exit 1. No silent retry on malformed JSON.

**Idempotency**
- Non-deterministic (Claude). `--confirm` required when any of the 3 target entries already exists in `override_cache.json`. On dry-run, show side-by-side `rationale` + hypothesis-count diff.
- `--only <bucket>`: regenerate just that bucket.

**Rate limiting / batching**
- 3 sequential calls. Sub-second-scale beyond first-call Seg-1+2+3 cache warm-up.
- Total estimated cost (per rehearsal run): ~3 × (output tokens, ~800) — trivial.

**Exit criteria**
- `fixtures/override_cache.json` validates against schema.
- Uniqueness invariant on (dimension, bucket) holds (script's own merge path cannot produce dupes, but ajv-driven check per Phase 2B §6.5 is cheap insurance).
- Log per-bucket cost + latency.

### 4.4 `scripts/gen-offline-cache.ts` (impl-plan §3.4)

**CLI**
```
pnpm gen:offline-cache [--dry-run] [--confirm] [--only <scripted-query-id>] [--verbose]
```

**Input**
- `fixtures/scripted_queries.json` (must have non-empty embeddings — script fails fast if any `scripted_queries[i].embedding.length === 0`; instructs engineer to run `pnpm gen:scripted-query-embeddings` first).
- `fixtures/precedents.json` (embeddings must be populated — same check as above, instructs `gen:precedent-embeddings`).
- `fixtures/offline_cache.json` (current state — for merge semantics per §4.4.4).

**Output**
- Write `fixtures/offline_cache.json` with one `OfflineCacheEntry` per scripted query. Each entry:
  - `query`: scripted query string (exact, trimmed).
  - `tagged_stream`: Claude-generated tagged output per `docs/recall-stream-grammar.md`.
  - `precedent_id`: the top-1 cosine match (script computes this in-process using `cosineTopK` from `lib/retrieval/cosine.ts`).

**LLM prompt construction**
- Per scripted query:
  1. In-process: `cosineTopK(query.embedding, precedents, 3)` → top-3 precedent ids. Threshold the Phase 2A `recall-chain.ts` uses (0.25) is **not** applied at gen time — even a weak match generates an offline stream; the app's live path threshold is what decides no-anchor behavior at runtime.
  2. Call Claude via `lib/llm/client.ts` using the SAME arguments Phase 2A `recall-chain.ts` passes: `mode: 'recall'`, `clientId: 'acme'`, `precedentIds: top3Ids`, `query: query.text`. **This is critical**: Seg 1/2/3/4 bytes are identical to what the live app sends → the baked stream matches what Claude would produce at demo time for that scripted query. The grammar emitted is `docs/recall-stream-grammar.md`'s tagged-stream format; the script captures the RAW text (no parse).
- Post-call: sanity-check the raw text contains `<done/>` (grammar terminal). If not, warn but still write — grammar `<done/>` is enforced at render-time by the stream parser's `end()`.

**Retry / error handling**
- `withRetry` per query. `max_tokens: 2048` (Recall card payload is ~1 KB text).
- Per-query timeout 45s (matches Phase 2A PRD §3.6.2 budget — if Claude can't finish in that window during gen, it won't during demo either, and the offline cache is useless anyway).
- On any non-transient error → log query id + raw error + exit 1 (partial write allowed via `--only` restart).

**Idempotency**
- Non-deterministic (Claude). **Merge policy**: default behavior preserves existing entries for queries NOT passed via `--only`; re-running without `--only` replaces ALL entries. `--confirm` required when the resulting write would overwrite an existing entry. Dry-run shows `{ added: [...], replaced: [...], unchanged: [...] }` summary.

**Rate limiting / batching**
- Sequential calls — Anthropic prompt cache benefits from serialization (each call warms for the next via Seg 1+2+3 stable bytes).
- Estimated cost: ~10 scripted queries × (Seg 4 + output ~1 KB) = small Claude bill. First call pays Seg-1+2+3 creation tokens; subsequent calls pay only read tokens.
- **Cost warning banner** (impl-plan §3.4 explicit): script logs at start:
  ```
  [gen:offline-cache] WARNING: ~10 Claude calls with full Seg 1+2+3 context.
  Expected token usage: ~50K write tokens (first call), ~5K read tokens/subsequent call + ~1K output each.
  Do not re-run frequently. Lock scripted_queries.json before baking.
  ```
  Engineer explicitly proceeds by pressing Enter (non-interactive in CI — add `--yes` flag if CI ever runs it; §9 tests).

**Exit criteria**
- `fixtures/offline_cache.json` validates against `offline_cache.schema.json`.
- Every entry's `query` matches some `scripted_queries[i].query` after trim (pre-existing Phase 0.9 cross-check).
- Log per-query latency + cache hit/miss (from `usage.cacheReadInputTokens`).

### 4.5 `scripts/check-fixture-mtimes.ts` (impl-plan §3.5)

**CLI**
```
pnpm check:fixture-mtimes [--verbose] [--json]
```

**Behavior**
- Compare mtime of each source file against its derived artifact. A source that is newer than (or whose derived artifact is missing) → emit `stale: true` pair + `genCommand` to re-run. Always exit 0 — this is a reminder, not a gate (impl-plan §3.5 pin).
- When `--json`, print one-shot `MtimeReport` JSON to stdout; no colored summary. Suitable for CI artifact parsing.

**Source → derived pairs** (hardcoded in script; add entries as new fixtures appear)

| Source | Derived | Gen command |
|---|---|---|
| `fixtures/precedents.json` (as source for `embedding` field) | itself (embedded field present) | `pnpm gen:precedent-embeddings` |
| `fixtures/scripted_queries.json` (as source for `embedding` field) | itself | `pnpm gen:scripted-query-embeddings` |
| `fixtures/acme_fixtures/memo.md`, `org.md`, `call.md` (any newer than F-files) | `fixtures/diagnostic_fixtures/f1..f5.json` | `pnpm gen:diagnostic-fixtures` |
| `fixtures/precedents.json`, `lib/override/dims.ts` | `fixtures/override_cache.json` (Strategic-Innovation entries only) | `pnpm gen:override-cache` |
| `fixtures/scripted_queries.json`, `fixtures/precedents.json` | `fixtures/offline_cache.json` | `pnpm gen:offline-cache` |

**Special cases**
- Embeddings live **inside** the source file (no separate derived artifact). The mtime check for those pairs reads the file, parses JSON, and inspects whether any entry has `embedding.length === 0`. If yes, emit `stale: true` with `reason: 'missing'`.
- `fixtures/override_cache.json` with zero entries in the Strategic-Innovation bucket set → `stale: true` with `reason: 'missing'`.
- `acme_fixtures/*.md` missing entirely → `stale: true` with `reason: 'missing'` and a hint that content-owner delivery is pending (§3.A).

**Output format (default)**

```
[check:fixture-mtimes] 3 of 5 derived artifacts are stale:

  fixtures/precedents.json
    → embeddings missing (0 of 15 entries have 1536-d vectors)
    → run: pnpm gen:precedent-embeddings

  fixtures/diagnostic_fixtures/f1.json
    → source memo.md modified 2026-04-20 14:22:10 (f1.json: 2026-04-18 11:03:00)
    → run: pnpm gen:diagnostic-fixtures --only f1

  fixtures/offline_cache.json
    → missing entirely
    → run: pnpm gen:offline-cache

Exit code: 0 (warnings only; re-run manually).
```

**Integration with existing `package.json`**
- Add to `package.json` `scripts`: `"check:fixture-mtimes": "tsx scripts/check-fixture-mtimes.ts"`.
- Optional CI hook: `"pretest:phase-0": "pnpm check:fixture-mtimes || true"` — prints warnings before running phase-0 tests, never blocks. Plan suggests **not** adding as a pretest hook by default — noisy output distracts from real test failures. Engineer runs on demand; CI surfaces via a separate "Fixture Drift" job that echoes the same script's output into the PR description.

---

## 5. Shared helpers (`scripts/gen-shared/`)

### 5.1 `env.ts`
- Loads `.env.local` via plain `fs.readFileSync` + minimal parser (no `dotenv` dep — keep weight down; parser handles `KEY=value` and `#` comments, trims surrounding quotes).
- Exports `requireEnv(name: string): string` — throws `"${name} missing — set in .env.local. See .env.local.example."` if unset.
- Exports `loadEnv(): void` — idempotent; mutates `process.env`.

### 5.2 `args.ts`
- Tiny arg parser (~40 lines). No `commander` / `yargs` dep. Supports `--flag`, `--key value`, `--key=value`. Positionals ignored.
- Returns `GenCliArgs`.
- `--help` handler prints a per-script doc string passed in as argument and exits 0.

### 5.3 `logger.ts`
- Structured prefixed stdout: `[gen:precedent-embeddings] INFO ...` / `WARN` / `ERROR`. No color codes by default (preserves CI log readability); `NO_COLOR=1` respected.
- Levels gated by `--verbose`.

### 5.4 `schema.ts`
- Thin wrapper around `ajv` (already a devDep) that loads a schema file and returns `{ validate, definitions }`. Each gen script calls `validateOrThrow(data, schemaPath)`; on failure, dumps ajv error list with path breadcrumbs.

### 5.5 `diff.ts`
- Given `{ before: unknown, after: unknown }`, returns a compact diff string for `--dry-run` output: per-top-level-key `before.type/length → after.type/length`. For embeddings, reports `Δ=±N floats`. No deep diff for large JSON — first-level summary is enough for the dry-run signal.

### 5.6 `mtime.ts`
- Exports `getMtime(path): number | null`, `isNewerThan(source, derived): boolean`, `sourceNewerPairs(pairs): MtimePair[]`. Used by both 4.5 (reporter) and per-gen scripts (which print a `[gen:X] WARN source fixtures/Y is older than derived Z — consider running gen:Y first` heads-up if running out of order).

### 5.7 `openai-embed.ts`
- `embedBatch(items, signal?)` → single POST to `/v1/embeddings`, 60s timeout.
- Reuses the fetch + `Authorization` header pattern from `lib/retrieval/embed.ts` but with array input. Does **not** re-call `lib/retrieval/embed.ts` directly because that file's `embedQuery` is single-input and uses `AbortController` differently; extracting a shared `embedRaw(input: string | string[])` in `lib/retrieval/embed.ts` is in scope IF the gen script lands cleanly and refactor is low-risk (§7 risk note).

### 5.8 `claude-call.ts`
- `callClaudeOnce({ mode, clientId, precedentIds, query, maxTokens, signal })` — wraps `streamCompletion` from `lib/llm/client.ts`. Collects `onDelta` into `fullText`; returns `ClaudeCallResult`. Handles timeout (default 60s per-call) via local `AbortController.abort()`.

### 5.9 `tags-prompt.ts`
- Exports shared prompt fragments used by 3.3 + 3.4:
  - `GRAMMAR_REMINDER`: "Emit tags in the Recall stream grammar (docs/recall-stream-grammar.md). Do not paraphrase — quote verbatim."
  - `JSON_ONLY_REMINDER`: "Return ONLY valid JSON. No markdown. No commentary."

---

## 6. `package.json` scripts

### 6.1 New entries

```jsonc
{
  "scripts": {
    // Existing (unchanged) ...

    // Phase 3 gen scripts — manual one-shot, output committed to repo.
    "gen:precedent-embeddings": "tsx scripts/gen-precedent-embeddings.ts",
    "gen:scripted-query-embeddings": "tsx scripts/gen-scripted-query-embeddings.ts",
    "gen:embeddings": "pnpm gen:precedent-embeddings && pnpm gen:scripted-query-embeddings",
    "gen:diagnostic-fixtures": "tsx scripts/gen-diagnostic-fixtures.ts",
    "gen:override-cache": "tsx scripts/gen-override-cache.ts",
    "gen:offline-cache": "tsx scripts/gen-offline-cache.ts",
    "gen:all": "pnpm gen:embeddings && pnpm gen:diagnostic-fixtures && pnpm gen:override-cache && pnpm gen:offline-cache",
    "check:fixture-mtimes": "tsx scripts/check-fixture-mtimes.ts"
  }
}
```

- `gen:embeddings` and `gen:all` are **convenience aliases**. `gen:all` is **not** recommended for casual re-runs (hits the offline-cache cost warning banner); it exists for a clean post-content-delivery rebake.
- Each `gen:*` script respects `GenCliArgs` via pass-through: `pnpm gen:diagnostic-fixtures -- --dry-run --only f3` works because npm/pnpm forwards `--` suffix args.

### 6.2 New deps

- **`tsx`**: required to run `.ts` scripts directly. **Not currently in `package.json`**; existing Phase 0-2D scripts are `.js`. Phase 3 scripts are `.ts` because they import from `lib/llm/client.ts` + `lib/retrieval/cosine.ts` (runtime TS). Two options:
  1. **Add `tsx` as a devDependency.** Weight: ~20 MB install, zero runtime. Chosen.
  2. Port everything to `.js` via `node --experimental-strip-types` — fragile; Phase 2D didn't adopt it.
- Add: `"tsx": "^4.19.0"` in `devDependencies`. No other new deps.
- **Justification note**: `ajv` already a devDep (Phase 0). `@anthropic-ai/sdk` and OpenAI-via-`fetch` already a runtime dep. Re-using them from scripts adds no surface.

### 6.3 Dep-graph verification
- Before landing, `pnpm install` to confirm `tsx` pulls in without breaking existing install. One-time install check during implementation; not a plan concern.

---

## 7. Risks

### 7.1 Content-owner fixture drift mid-flight

Gen scripts depend on `fixtures/acme_fixtures/*.md` + the final scripted-query bodies in `fixtures/scripted_queries.json`. If content owner ships partial content, running `gen:diagnostic-fixtures` produces half-useful F-files that engineer may commit accidentally. **Mitigation**: 3.2 script fails fast when any acme_fixtures/*.md contains a `TODO:` sentinel (script greps for `TODO:` marker; content-owner stubs have it by convention). 3.4 script fails fast when any scripted_query's `query` string contains `TODO` or empty `embedding`. Dry-run is safe; actual write requires `--confirm`.

### 7.2 Quota exhaustion mid-batch

3.2 + 3.3 + 3.4 together run ~18 Claude calls on a single `gen:all` invocation. If rate-limited mid-way, `withRetry` absorbs transient 429s; a hard quota block (401-style) causes exit 1. **Mitigation**: scripts are **resumable** via `--only`: re-run only the failed F / bucket / scripted-query id. 3.4 additionally preserves existing entries on partial run (§4.4 merge semantics) — engineer re-runs `--only q-cdo-reporting-line` for the one that failed.

### 7.3 Malformed Claude output breaks parser

Claude occasionally emits a preamble before `{` or wraps in ```` ```json ````. 3.2 + 3.3 sanitize these two cases (§4.2 parser strategy); anything else (trailing commentary, mid-JSON line breaks) falls through to `JSON.parse` failure → raw dump → exit 1. **Mitigation**: dedicated raw-dump directory `scripts/.gen-cache/` lets engineer diff + decide; no retry (model non-determinism is the real bug, not transient). Prompt includes "Return ONLY JSON" clause + schema reference to narrow the failure surface.

### 7.4 Re-gen overwrites manual edits silently

If a content reviewer hand-edited `fixtures/diagnostic_fixtures/f3.json` after a gen run (e.g. polished a rationale sentence), re-running `gen:diagnostic-fixtures` without `--confirm` would be rejected. **Mitigation**: `--confirm` flag on 3.2, 3.3, 3.4 when target file exists + has content. Dry-run always safe. Additionally: `--only f3` narrows blast radius; an engineer re-running to regenerate F1 won't touch an edited F3.

### 7.5 Prompt cache invalidation between script and runtime app

Gen scripts reuse `buildSeg1Framework()` / `buildSeg2Precedents()` / `buildSeg3AcmeContext('acme')` from `lib/llm/segments.ts`. If script and runtime app differ in ANY byte of Seg 1/2/3, cache misses on demo-day. **Mitigation**: scripts MUST import from `lib/llm/segments.ts` (not inline copies). The `scripts/gen-shared/claude-call.ts` wrapper enforces this — it does NOT accept custom `system` blocks; it delegates to `streamCompletion` which builds system blocks identically to the app.

### 7.6 Mtime check false positives from formatting

If the engineer runs `prettier --write .` on `fixtures/*.json`, every fixture's mtime bumps even though content didn't change. `check:fixture-mtimes` would report all derived artifacts stale. **Mitigation**: the check uses mtime only — this is an inherent imprecision. Add a "sanity" step: when mtime bumped but content hash unchanged, emit `stale: false, reason: 'ok', warning: 'mtime bumped but content hash stable'`. Requires a content-hash footer in each derived file (the `generated_at` + `model` trailer). Engineer understands: running `gen:*` after prettier is optional; check is a warning.

### 7.7 Windows path handling in scripts

Working directory `E:\cursor_project\gsc advisor project` has a space. Scripts use Node's `path.resolve(__dirname, '..')` + forward slashes — works on Windows without quoting. Fixture paths should NOT be hardcoded with backslashes. **Mitigation**: all scripts use `path.join` / `path.resolve`; integration test on Windows runner.

### 7.8 `tsx` adoption vs existing `.js` test scripts

Phase 0-2D scripts are plain Node `.js`. Adding `tsx` + `.ts` gen scripts splits the script tooling in two. **Mitigation**: document the split in the repo's top-level README or `scripts/README.md` — `.js` scripts = test smoke; `.ts` scripts = generators importing from `lib/`. Not a code risk; a discoverability one.

### 7.9 OpenAI model drift changes embeddings

OpenAI occasionally updates underlying model weights. If `text-embedding-3-small` silently shifts, baked precedent/query vectors may diverge from freshly-computed ones → cosine top-3 changes → offline cache `precedent_id` stale. **Mitigation**: low-risk at demo horizon (OpenAI pins versioned models; `text-embedding-3-small` is stable). Script logs model + usage per run; drift is detectable via repeated dry-runs reporting unexpected vector changes. Not worth defending against with per-dim hash stamps at this scope.

### 7.10 Concurrent `gen:*` invocations

Two engineers / one automation running two gen scripts simultaneously could race on the fixture file. **Mitigation**: gen scripts write atomically (write to `fixture.json.tmp` + rename). No lock files. Docs warn engineer to coordinate. No CI runs these scripts, so automation risk is low.

---

## 8. Order of implementation (DAG)

Items 1-3 are setup; 4-5 are the embed scripts (cheap + no Claude); 6-9 are Claude scripts; 10 is the mtime check; 11-12 are docs + CI.

1. **Write `scripts/gen-shared/env.ts` + `args.ts` + `logger.ts`** — zero deps beyond `fs` / `path`.
2. **Write `scripts/gen-shared/schema.ts`** (ajv wrapper) + `diff.ts` (dry-run summary) + `mtime.ts` (timestamp compare).
3. **Add `tsx` to `devDependencies`**; run `pnpm install`; verify `pnpm tsx scripts/gen-shared/env.ts --help` exits clean (sanity check).
4. **Write `scripts/gen-shared/openai-embed.ts`** — single-call batch helper. Unit test with mocked fetch.
5. **Write `scripts/gen-precedent-embeddings.ts` + `gen-scripted-query-embeddings.ts`** — consume shared helpers; wrap with `withRetry`. Dry-run + real run against a test precedent.
6. **Write `scripts/gen-shared/claude-call.ts` + `tags-prompt.ts`** — Claude wrapper.
7. **Write `fixtures/diagnostic_fixtures/diagnostic-fixture.schema.json`** — five-definition schema. Extend `scripts/test-phase-0.js` to validate F1-F5 outputs against it (when files present; skip when missing — no failure on missing files since content-owner gates them).
8. **Write `scripts/gen-diagnostic-fixtures.ts`** — sequential F1 → F2 → F3 → F4 → F5 pipeline. Stub `acme_fixtures/*.md` with `TODO:` sentinels so the `gen-shared/env.ts`-sentinel check exercises. Add `.gitkeep` to the new dir.
9. **Write `scripts/gen-override-cache.ts`** — reuses the Claude wrapper.
10. **Write `scripts/gen-offline-cache.ts`** — reuses Claude wrapper + `lib/retrieval/cosine.ts` for in-process top-3.
11. **Write `scripts/check-fixture-mtimes.ts`** — read-only; no API calls; safe to land early but semantically fits last.
12. **Update `package.json` `scripts` section** per §6.1.
13. **Update `.gitignore`** per §10.
14. **Add per-script `--help` doc block** so `pnpm gen:X -- --help` prints usage.
15. **Update `scripts/test-phase-0.js`** to validate `diagnostic-fixture.schema.json` (once shipped) without requiring F1-F5 files to exist (skip-when-missing pattern already in the file per lines 180-230).
16. **Optional (post-merge): extract `embedRaw(input: string | string[])` helper into `lib/retrieval/embed.ts`** — only if refactor stays small. Else scripts/gen-shared/openai-embed.ts carries duplicate fetch logic. Prefer duplication on this phase to keep library API surface stable.

---

## 9. Test strategy

### 9.1 Unit tests (Vitest)

| File | What it asserts |
|---|---|
| `scripts/gen-shared/args.test.ts` | flag parsing: `--dry-run`, `--confirm`, `--only x`, `--only=x`, unknown flag → rejected; `--help` exits 0 |
| `scripts/gen-shared/schema.test.ts` | `validateOrThrow` passes for valid data; throws with path-annotated error for invalid |
| `scripts/gen-shared/mtime.test.ts` | `isNewerThan` respects ms precision; missing file returns null; `sourceNewerPairs` filters correctly |
| `scripts/gen-shared/diff.test.ts` | embed Δ summary; nested-object top-level-key summary; handles undefined |
| `scripts/gen-shared/openai-embed.test.ts` | mocked fetch returns vectors in input order; 401 throws clear error; timeout aborts |
| `scripts/gen-shared/claude-call.test.ts` | mocked `streamCompletion`; collects deltas into `fullText`; propagates usage; honors abort |
| `scripts/gen-precedent-embeddings.test.ts` | given a stub `precedents.json` + mocked `embedBatch`, script writes back 1536-d vectors per entry; re-validates schema; dry-run produces diff summary; `--only id` touches only that entry |
| `scripts/gen-diagnostic-fixtures.test.ts` | mocked Claude returns valid JSON per F → files written + schema-validated; TODO sentinel in memo.md → script exits 1 with clear message |
| `scripts/gen-override-cache.test.ts` | mocked Claude returns OverrideCacheEntry JSON → merged into existing cache preserving non-Strategic-Innovation entries; dup (dim,bucket) rejected |
| `scripts/gen-offline-cache.test.ts` | mocked cosineTopK + mocked Claude → each scripted query produces an entry with matching `query` + `precedent_id`; `--only <id>` preserves other entries |
| `scripts/check-fixture-mtimes.test.ts` | stale when source newer; stale when derived missing; `--json` flag produces parseable `MtimeReport`; exit always 0 |

### 9.2 Smoke / acceptance tests

Extend `scripts/test-phase-0.js` to validate:
- If `fixtures/diagnostic_fixtures/f1..f5.json` present → validate against `diagnostic-fixture.schema.json`.
- Skip when files missing (pre-content-delivery state).

Add **new** `scripts/test-phase-3.js` smoke runner mirroring `test-phase-2c.js` pattern:
- All `scripts/gen-*.ts` files exist.
- All `scripts/gen-shared/*.ts` helpers exist.
- `package.json` contains every `gen:*` script listed in §6.1.
- `.gitignore` covers `scripts/.gen-cache/`.
- `diagnostic-fixture.schema.json` exists + is valid JSON + compiles under ajv.
- Each `gen:*` script exits 0 on `--help`.

### 9.3 E2E / real API tests

**None.** Scripts hit real external APIs, tests mock them. Integration signal comes from engineer running `pnpm gen:*` manually against `.env.local` keys during rehearsal; this is intentional per impl-plan §测试策略 ("不做 E2E 自动化").

### 9.4 Dry-run-first protocol

Every gen script's test suite exercises `--dry-run` as a primary path, actual write as secondary. This catches diff-format regressions cheaply without spending tokens.

---

## 10. `.gitignore` additions

```
# Phase 3 gen scripts — intermediate state
scripts/.gen-cache/
scripts/.gen-cache/*.json
scripts/.gen-cache/*.txt
```

- `.gen-cache/` holds raw Claude outputs from failed parse attempts (§4.2 / §4.3 / §4.4) and incremental state for resumable `--only` runs. Never committed.
- `fixtures/*.json` is **always committed** — this is the whole point of Phase 3.
- `fixtures/acme_fixtures/*.md` is committed (content-owner deliverable lands in repo).

---

## 11. Exit gate

Phase 3 is done when **every** box below is checked:

- [ ] `pnpm typecheck` exits 0 (includes all new `.ts` files under `scripts/`).
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm test:unit` green; all new `scripts/**/*.test.ts` suites pass with mocked external calls.
- [ ] `pnpm test:phase-0` green; validates `diagnostic-fixture.schema.json` shape + skips F1-F5 files when absent.
- [ ] `pnpm test:phase-3` (new) exits 0 — file-existence + help-flag + schema compile smoke.
- [ ] Each `gen:*` script has a `--dry-run` mode verified to not touch any fixture file.
- [ ] Each `gen:*` script fails with a clear, actionable error message when the required API key is missing (`"ANTHROPIC_API_KEY missing — set in .env.local"`).
- [ ] Each `gen:*` script fails with a clear error when source fixtures contain `TODO:` sentinel markers (content-owner incomplete).
- [ ] `gen:precedent-embeddings` + `gen:scripted-query-embeddings` run end-to-end against real OpenAI API during rehearsal; all embeddings are length 1536; output revalidates against schemas.
- [ ] `gen:diagnostic-fixtures` runs end-to-end when acme_fixtures content is delivered; F1-F5 files validate against `diagnostic-fixture.schema.json`; manual review of 1 fixture against source memo shows fidelity.
- [ ] `gen:override-cache` bakes Strategic Innovation × {low, mid, high}; resulting `override_cache.json` validates against schema; Phase 2B Diagnostic page cache-hit path renders each of the three buckets in <2s during manual smoke.
- [ ] `gen:offline-cache` bakes all scripted queries; Phase 2A Recall offline fallback path renders correctly when Anthropic is killed (manual smoke).
- [ ] `check:fixture-mtimes` reports accurate staleness for at least one intentionally-modified source file; exit code always 0.
- [ ] `--confirm` flag on 3.2, 3.3, 3.4 prevents accidental overwrite of existing fixtures; `--dry-run` produces a readable diff summary without writing.
- [ ] `package.json` contains all 8 new `gen:*` + `check:fixture-mtimes` entries per §6.1; `tsx` appears in `devDependencies`.
- [ ] `.gitignore` covers `scripts/.gen-cache/`; `git check-ignore scripts/.gen-cache/foo.txt` returns the path.
- [ ] All gen scripts share the Seg 1+2+3 cache-prefix discipline — they import `buildSegX*` from `lib/llm/segments.ts` and never inline system-block bytes.
- [ ] Re-running any `gen:*` script produces byte-identical output for embeddings (deterministic) and semantically-similar output for Claude-authored artifacts (documented non-determinism).
- [ ] `docs/phase-plans/phase-3-plan.md` committed.
- [ ] Content-owner fixture work (§3.A deliverables: `acme_fixtures/*.md`, scripted query final text, email bodies) flagged **out-of-scope for Phase 3**; implementation unblocked the moment content lands.

When all boxes are green: **Phase 3 ships → Phase 4 (Fake surface port) may start** with all derived fixtures available for rendering.
