# Phase 0 Implementation Plan — Pre-Phase-1 Blockers

## Overview

Phase 0 unblocks all of Phase 1 by locking three contracts before any build code is written:
1. Precedent JSON schema with a three-layer drilldown structure
2. Claude Recall tagged-stream format with a chunk-boundary-safe parser contract
3. Verified local dev environment (Node 20, pnpm, Rust, Tauri 2 system deps, API keys)

No application code is written in Phase 0 — this phase produces schema files, a parser spec, an env template, and a verification checklist.

## Requirements

- Lock `precedents.json` shape so `scripts/gen-precedent-embeddings.ts` (Phase 3.1) and Recall cosine retrieval (Phase 2A) can be built against a stable contract.
- Lock the Claude return grammar so `lib/llm/stream-parser.ts` (Phase 2A) can be implemented in isolation with unit tests — no need to wait on live Claude calls.
- Prove the Windows 11 dev box can build/run a Tauri 2 shell before Phase 1.2 touches `tauri.conf.json`.
- All three sub-phases must produce artifacts committed to the repo so Phase 1 engineers do not re-litigate these decisions.

## Architecture Changes / New Files

- New dir: `docs/phase-plans/` — this plan and future phase plans live here.
- New dir: `fixtures/` — placeholder created in 0.1; populated in Phase 3.
- New file: `fixtures/precedents.schema.json` — JSON Schema draft-07 document.
- New file: `fixtures/precedents.example.json` — one hand-written example precedent (2018 Globex hero skeleton).
- New file: `docs/recall-stream-grammar.md` — tag grammar + parser state machine spec for 0.2.
- New file: `.env.local.example` — committed template with placeholder values.
- New file: `.gitignore` — excludes `.env.local`, build artifacts.

No existing files are mutated in Phase 0.

---

## Phase 0.1 — Precedent JSON Schema + drilldown_layers[]

**Goal:** produce a JSON Schema file + one fully-worked example, so Phase 2A / 3.1 can be built against it.

### Canonical TypeScript type (for documentation — actual .ts file created in Phase 1 at `lib/retrieval/types.ts`)

```ts
type Precedent = {
  id: string;                 // stable slug, e.g. "globex-2018-cdo"
  client_name: string;        // virtual: "Globex", "Initech", ...
  year: number;               // 4-digit int
  industry: string;           // neutral tag, never sector-specific per PRD §3.7
  summary: string;            // 1–3 sentence surface blurb
  scene: string;              // one-line scene label
  key_quotes: string[];       // verbatim quotes — at least 3 for hero, 1+ for others
  cgs_tags: string[];         // MUST match lib/methodology/tags.ts whitelist (Phase 2C)
  source_id: string;          // clickable provenance, e.g. "Globex_Board_Memo_2018_p4"
  embedding: number[];        // length 1536 for text-embedding-3-small; [] until Phase 3.1
  drilldown_layers: DrilldownLayer[]; // length 1–3; hero has exactly 3
};

type DrilldownLayer = {
  depth: 1 | 2 | 3;
  theme: 'decision' | 'transition' | 'resistance' | 'rebound' | string;
  quotes: string[];                               // verbatim only
  key_facts: { label: string; value: string }[];
};
```

### JSON Schema shape (for `fixtures/precedents.schema.json`)

- `$schema`: `"http://json-schema.org/draft-07/schema#"`
- top-level: `{ type: "array", items: { $ref: "#/definitions/Precedent" } }`
- `definitions.Precedent`: object with required fields as above; `additionalProperties: false` on core; optional `metadata: object` bag for experimentation.
- `year`: `{ type: "integer", minimum: 2005, maximum: 2026 }`
- `embedding`: `{ type: "array", items: { type: "number" } }` — empty array pre-Phase-3.1, length 1536 post-run.
- `drilldown_layers`: `{ type: "array", minItems: 1, maxItems: 3 }`
- `DrilldownLayer.depth`: `{ type: "integer", enum: [1,2,3] }`
- `DrilldownLayer.key_facts`: `{label, value}` both strings.

### Hand-written example (for `fixtures/precedents.example.json` — skeleton; content owner fills prose)

```json
[
  {
    "id": "globex-2018-cdo",
    "client_name": "Globex",
    "year": 2018,
    "industry": "industrial-neutral",
    "summary": "<1–3 sentence hook — content owner to fill>",
    "scene": "CDO reporting-line restructure",
    "key_quotes": ["<verbatim 1>", "<verbatim 2>", "<verbatim 3>"],
    "cgs_tags": ["Structural Inertia", "Strategy Governance & Communications"],
    "source_id": "Globex_Board_Memo_2018_p4",
    "embedding": [],
    "drilldown_layers": [
      { "depth": 1, "theme": "decision",   "quotes": ["<Q>"], "key_facts": [{"label":"Final reporting line","value":"CDO → CEO"}] },
      { "depth": 2, "theme": "transition", "quotes": ["<Q>"], "key_facts": [{"label":"Transition duration","value":"7 months"}] },
      { "depth": 3, "theme": "resistance", "quotes": ["<Q>"], "key_facts": [{"label":"Primary friction","value":"COO org"}] }
    ]
  }
]
```

### 0.1 Acceptance criteria

- [ ] `fixtures/precedents.schema.json` is valid JSON Schema draft-07 (validates with `ajv compile`).
- [ ] `fixtures/precedents.example.json` validates against the schema with zero errors.
- [ ] Schema permits `embedding: []` AND `embedding: [1536 floats]`.
- [ ] Every field in `architecture.md` §3.1 is present.
- [ ] `depth` constrained to 1|2|3.
- [ ] Hero example has exactly 3 drilldown layers.

---

## Phase 0.2 — Claude Recall Tagged Stream Format

**Goal:** pin the grammar Claude must return and the parser contract so Phase 2A can implement `lib/llm/stream-parser.ts` as a pure, unit-testable function.

### Tag grammar (goes in `docs/recall-stream-grammar.md`)

**Tag set (7 content tags + 2 control):**

| Tag | Cardinality | Content | UI slot |
|---|---|---|---|
| `<year>…</year>` | exactly 1 | integer string | card header |
| `<client>…</client>` | exactly 1 | plain text | card header |
| `<scene>…</scene>` | exactly 1 | plain text ≤ 80 char | card subtitle |
| `<tag>…</tag>` | 1..N | single CGS methodology tag (whitelisted) | tag chip row |
| `<quote>…</quote>` | 1..N | verbatim precedent quote | blockquote list |
| `<source_id>…</source_id>` | exactly 1 | id matching 0.1 schema | citation link |
| `<fellow_voice>…</fellow_voice>` | 0 or 1 | Fellow-tone rewrite | right column double-column view |
| `<no_anchor/>` | 0 or 1 (self-closing) | — | replaces all above; UI shows "suggest 24h Memo" |
| `<done/>` | exactly 1 (self-closing) | — | closes turn |

**Rules:**
- **Ordering**: `year → client → scene → tag* → quote+ → fellow_voice? → source_id → done`. Parser tolerates out-of-order; UI renders by slot.
- **Repetition**: `<tag>` and `<quote>` append to arrays. Others are last-wins.
- **Escape**: literal `<` inside content must be `&lt;`. Parser does not reverse-escape; UI renders as text node (no XSS).
- **Nesting**: forbidden. A `<` inside open content before its closer → parser enters ERROR_RECOVERY, drops buffer to the next `</…>` close tag, continues.

### Parser state machine contract

States: `OUTSIDE`, `IN_OPEN_TAG`, `IN_CONTENT`, `IN_CLOSE_TAG`, `ERROR_RECOVERY`.

```
push(chunk: string) -> emissions: ParserEvent[]
```

where `ParserEvent = { field: TagName, value: string | boolean, isComplete: boolean }`.

**Chunk-boundary buffering:**
- Maintains `pendingBuffer: string` across calls.
- On `push(chunk)`:
  1. Append chunk to `pendingBuffer`.
  2. Scan from cursor. If `OUTSIDE` and `<` found → `IN_OPEN_TAG`, accumulate tag name.
  3. If tag name incomplete (buffer ends mid-name) → freeze cursor at `<`, return no emissions.
  4. If open tag closes with `>` → `IN_CONTENT`; emit partial content `{field, value: accumulatedContent, isComplete: false}` on each push extending content (for fade-in rendering).
  5. If `</tagname>` found → emit `{field, value, isComplete: true}`, transition `OUTSIDE`.
  6. Self-closing tags → emit `{field, value: true, isComplete: true}` immediately.
- Cursor advances only past committed content; rest stays in buffer.

**Worked chunk-split example:**
- Chunk 1: `<year>2018</year><cli`
- Chunk 2: `ent>Globex</client><scene>CDO re`
- Chunk 3: `porting-line</scene>...`
- After 1: emit `{year, "2018", true}`; buffer retains `<cli`.
- After 2: emit `{client, "Globex", true}`, `{scene, "CDO re", false}`; buffer retains `CDO re` (open-tag `<scene>` is committed and tracked in parser state, not re-buffered; cursor advances past committed content per §3.3 step 3).
- After 3: emit `{scene, "CDO reporting-line", true}`.

**Unit-test seed cases (for Phase 2A):**
1. Tag split across 2 chunks.
2. Tag split across 3 chunks (stress).
3. Literal `<` inside quote (must be `&lt;` or parser error).
4. Multiple `<quote>` in one chunk.
5. `<no_anchor/>` arriving alone.
6. Malformed: unclosed `<year>` followed by `<done/>` → ERROR_RECOVERY drops unclosed, still emits `done`.

### 0.2 Acceptance criteria

- [ ] `docs/recall-stream-grammar.md` lists all 7 content + 2 control tags with cardinality + ordering.
- [ ] Grammar forbids nesting, documents escape rule.
- [ ] Parser contract defines all 5 states and `push` signature.
- [ ] Worked chunk-split example end-to-end.
- [ ] 6 unit-test seed cases enumerated.
- [ ] References `fixtures/precedents.schema.json` for `source_id` values.
- [ ] Covers no-anchor path.

---

## Phase 0.3 — Windows 11 Dev Environment Setup

**Goal:** local machine can build a Tauri 2 shell and call Anthropic + OpenAI.

### Steps

1. **Node 20 LTS** — `winget install OpenJS.NodeJS.LTS`. Verify: `node --version` → `v20.x.x`.
2. **pnpm** via corepack — `corepack enable && corepack prepare pnpm@latest --activate`. Verify: `pnpm --version` ≥ 9.
3. **Rust** — `winget install Rustlang.Rustup && rustup default stable && rustup update`. Verify: `rustc --version`, `cargo --version`.
4. **Tauri 2 Windows deps**:
   - MSVC Build Tools 2022 with "Desktop development with C++" workload: `winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`.
   - WebView2: `winget install Microsoft.EdgeWebView2Runtime` (usually pre-installed on Win11).
   - Tauri CLI: `cargo install tauri-cli --version "^2.0.0"`. Verify: `cargo tauri --version`.
5. **Create `.env.local.example`** (committed template).
6. **Create `.gitignore`** — excludes `.env.local`, `node_modules/`, `.next/`, `dist/`, `src-tauri/target/`, `*.log`. Must exist BEFORE step 7.
7. **Provision API keys** — obtain Anthropic (console.anthropic.com) + OpenAI (platform.openai.com) keys; put in local `.env.local` (not committed).
8. **Pre-flight curl verification**:
   - Anthropic: `curl https://api.anthropic.com/v1/messages -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d '{"model":"claude-sonnet-4-5","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}'`
   - OpenAI: `curl https://api.openai.com/v1/embeddings -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" -d '{"model":"text-embedding-3-small","input":"ping"}'`

### `.env.local.example` canonical content

```
# Anthropic — Claude streaming (architecture.md §4)
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME
ANTHROPIC_MODEL=claude-sonnet-4-5

# OpenAI — embedding fallback on free-text Recall queries
# (D4: build-time embed is primary path; runtime OpenAI only when user bypasses autocomplete)
OPENAI_API_KEY=sk-REPLACE_ME
OPENAI_EMBED_MODEL=text-embedding-3-small

# Dev flags
NEXT_PUBLIC_PREFLIGHT_TIMEOUT_MS=5000
```

### `.gitignore` canonical content

```
# env
.env.local
.env*.local

# node
node_modules/
.next/
dist/
out/

# tauri
src-tauri/target/

# misc
*.log
.DS_Store
```

### 0.3 Acceptance criteria

- [ ] `node -v` → v20.x.
- [ ] `pnpm -v` → ≥ 9.x.
- [ ] `rustc -V` → stable.
- [ ] `cargo tauri --version` → 2.x.
- [ ] WebView2 present.
- [ ] `.env.local.example` committed.
- [ ] `.gitignore` excludes `.env.local` (verify: `git check-ignore .env.local`).
- [ ] `.env.local` exists locally with real keys (NOT committed).
- [ ] Anthropic curl returns 200.
- [ ] OpenAI curl returns 200 with 1536-length embedding.

---

## File Summary

**New files created in Phase 0:**
- `docs/phase-plans/phase-0-plan.md` (this doc)
- `fixtures/precedents.schema.json`
- `fixtures/precedents.example.json`
- `docs/recall-stream-grammar.md`
- `.env.local.example`
- `.gitignore`

**Existing files touched:** none.

**Local-only, not committed:** `.env.local`.

---

## Testing Strategy

- **0.1**: ajv CLI validates `precedents.example.json` against `precedents.schema.json`.
- **0.2**: no runnable tests in Phase 0 — parser test seeds documented for Phase 2A.
- **0.3**: two manual curl pings.

---

## Risks and Mitigations

- **Schema locks too early** → `metadata: object` opt-in bag for experimentation.
- **Claude drifts from grammar** → system prompt in Phase 1.8 pins with few-shot examples; parser's ERROR_RECOVERY is safety net.
- **MSVC install fails** → fall back to Visual Studio Community 2022 with same workload.
- **Key leak** → `.gitignore` created BEFORE `.env.local`; order matters.
- **Parser chunk-boundary bugs** → 6 unit-test seeds are non-negotiable for Phase 2A merge.

---

## Phase 0 Exit Gate

- [ ] All three sub-phase acceptance checklists green.
- [ ] Fresh git clone + `cp .env.local.example .env.local` + key paste = only onboarding needed for Phase 1.
- [ ] No ambiguity about precedent shape, Recall tag format, or toolchain.
