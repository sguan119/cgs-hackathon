# CGS Advisors Demo

A desktop app demo for a b-school agentic-AI challenge, built around three
"real" features plus a Tauri 2 two-window shell:

- **Real-Time Recall** — floating panel that surfaces similar historical
  advisory precedents while the Fellow is on a live client call, with
  streaming, multi-turn deep-dive, and an offline-cache fallback.
- **Fellow Override** — a seven-sector Strategy Wheel; clicking any dimension
  live re-computes downstream hypotheses against a pre-baked cache or a fresh
  Claude stream, with diff fade-out between old and new cards.
- **Tone Guard** — synchronous validator that flags sales-speak, malformed
  three-section email structure, and methodology misuse before a Fellow
  sends anything out.

Everything else (Dashboard, Data Hub, Meeting state, Thesis Memory toggle,
Diagnostic F1–F5) is fixture-driven fake surface around those real features.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 static export (`output: 'export'`) |
| Desktop shell | Tauri 2 (main + recall floating windows, `tauri-plugin-store`) |
| LLM | Anthropic Claude with streaming + 4-segment prompt cache |
| Embeddings | OpenAI `text-embedding-3-small`, pre-baked at gen time |
| Retrieval | In-memory cosine over ~15 precedents (no vector DB) |
| Tests | Vitest (happy-dom) + Playwright + ajv schema smokes |

## Run

One command boots the full desktop app (Next.js + Tauri native shell):

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs `scripts/launch.mjs`, which:

- prepends `~/.cargo/bin` to PATH so cargo is reachable from any shell
- auto-seeds `.env.local` from `.env.local.example` on first run
- frees port 3000 if something is already listening
- hands off to `tauri dev` (Next + Rust native window)

Prereqs: Node ≥ 20, pnpm 10, Rust toolchain (https://rustup.rs), and on
Windows the MSVC C++ Build Tools. Fill in real `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY` in `.env.local` to enable live Claude / OpenAI calls —
pre-flight (`/preflight`) shows a red/yellow/green traffic light per key.

Web-only (no native shell, useful for quick UI checks without Rust):

```bash
pnpm dev:web                         # Next.js on :3000 in a browser tab
```

## Offline demo mode

The app auto-enables **offline mode** when either API key in `.env.local`
is missing, empty, or still the `REPLACE_ME` placeholder. In that state:

- `/preflight` skips the Anthropic + OpenAI pings and shows a neutral
  "Offline demo mode" row. **Enter demo** is enabled immediately.
- Recall panel — textarea is disabled with an inline notice
  *"Requires ANTHROPIC_API_KEY + OPENAI_API_KEY — add to .env.local and
  restart."* Scripted autocomplete preview still renders when you click
  in; submissions are blocked until keys land.
- Diagnostic (Strategy Wheel) — a block-level notice sits above the
  wheel. Clicking sectors opens the ScoreEditor for inspection but
  committing a new score is a no-op.
- Tone Guard, Dashboard, Data Hub, Continuity exemplars, Meeting page —
  **fully functional** (pure fixture / local validator).

Fill real `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in `.env.local` and
restart to re-enable live LLM. To force the offline UI while keys are
present (e.g. for testing the gates), set
`NEXT_PUBLIC_DEMO_MODE=offline`.

Note: the `offline_cache.json` and `override_cache.json` fixtures are
currently skeletal. Even with real keys filled, Recall and Override
only light up once you also complete the content-prep steps below and
run `pnpm gen:all`.

## Test

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test:unit                       # 381 Vitest tests
pnpm test:e2e                        # 6 Playwright
pnpm test:phase-0                    # 85 schema + env smokes
pnpm test:phase-1                    # 23 skeleton smokes
pnpm test:phase-2a                   # 8 Recall smokes
pnpm test:phase-2b                   # 24 Override smokes
pnpm test:phase-2c                   # 53 Tone Guard smokes
pnpm test:phase-2d                   # 61 Tauri shell smokes
pnpm test:phase-3                    # 57 gen-script smokes
pnpm test:phase-4                    # 73 fake-surface smokes
```

## Fixture generation

Scripts under `scripts/` are one-shot generators — run manually, commit the
output.

```bash
pnpm gen:precedent-embeddings        # OpenAI batch embed precedents.json
pnpm gen:scripted-query-embeddings   # same for scripted_queries.json
pnpm gen:diagnostic-fixtures         # Claude pre-runs F1..F5
pnpm gen:override-cache              # Claude bakes override_cache.json
pnpm gen:offline-cache               # Claude pre-runs Recall scripted queries
pnpm check:fixture-mtimes            # warn when source newer than target
```

All generators accept `--dry-run` and fail fast when API keys are missing.

## Repo layout

```
app/
  (main)/
    dashboard/ diagnostic/ continuity/ datahub/ meeting/
  (floating)/
    recall-panel/                    # separate Tauri window
  preflight/
lib/
  llm/                               # Claude client, stream parser, retry, segments
  retrieval/                         # cosine, embed, autocomplete
  override/                          # StrategyWheel state, override chain, cache loader
  toneguard/                         # validator + span highlight
  methodology/                       # canonical CGS tag whitelist + sales blacklist
  shell/                             # Tauri window follow/detach coordinator
  components/                        # Toast, TrafficLight, Sidebar, Titlebar, ...
  store.ts events.ts window.ts shortcuts.ts
src-tauri/                           # Rust: main.rs, lib.rs, tauri.conf.json, capabilities
fixtures/
  precedents.json                    # ~15 precedent library (schema + skeleton shipped)
  scripted_queries.json              # ~10 pre-embedded queries
  offline_cache.json                 # pre-baked Claude Recall responses
  override_cache.json                # pre-baked Override streams
  continuity_fixtures/               # 3 pass/borderline/high-risk emails + E1/E4/E5
  diagnostic_fixtures/               # F1..F5 outputs (Claude-generated)
  dashboard_fixtures/ datahub_fixtures/ thesis_fixtures/
scripts/
  launch.mjs                         # one-command desktop launcher (pnpm dev)
  gen-*.ts check-fixture-mtimes.ts test-phase-*.js
  lib/                               # shared helpers (env, args, schema, claude-call)
docs/
  cgs-prd-v2.md                      # product spec
  architecture.md                    # stack + window model
  tech-design.md                     # real vs fake split + asset specs
  recall-stream-grammar.md           # tag grammar + parser state machine
  impl-plan.md                       # the engineering plan
  phase-plans/phase-{0,1,2a,2b,2c,2d,3,4}-plan.md
```

## Build narrative

Eight phases, each run through the same loop: plan file → implement → up to
five independent reviewers (with early-exit when a reviewer returns CLEAN) →
tester for coverage expansion + flakiness → shutdown. Teammates coordinated
through a shared task list; fixes routed back to the same implementer each
round.

| Phase | Scope | New tests |
|---|---|---|
| 0 | Precedent JSON schema, Recall tagged-stream grammar, env template | 37 |
| 1 | Next.js + Tauri scaffold, 4-seg prompt cache, preflight, base components | 23 |
| 2A | Real-Time Recall (parser, retrieval chain, retry ladder, fallbacks) | 73 |
| 2B | Fellow Override (Wheel, cache lookup, diff fade-out, abort semantics) | 35 |
| 2C | Tone Guard validator + continuity page integration | 52 |
| 2D | Tauri shell: follow-coordinator, detach/reattach, cleanup on quit | 17 |
| 3 | Fixture gen scripts + ajv smoke extensions | 58 |
| 4 | Dashboard orchestration, Data Hub, Meeting, Thesis toggle, E1/E4/E5 | 38 |

Final: 381 unit + 6 e2e + ~384 smoke asserts; 5× flakiness check clean.

## Demo content you need to prepare

The repo ships with schemas, skeletons, and SVG fallbacks — enough for the
app to boot and pass typecheck / tests — but the Recall, Override, and
continuity demos go off-script until you fill real content. Everything
below lives under `fixtures/` (and `public/assets/` for the two images).
All JSON inputs are validated by ajv against a sibling `*.schema.json`
and against the CGS methodology tag whitelist (`lib/methodology/tags.ts`).

Order of operations: (A) write the source texts, (B) fill `precedents.json`
+ `scripted_queries.json`, (C) run `pnpm gen:all` to produce embeddings and
pre-baked Claude caches, (D) drop in the two thesis screenshots if you have
them. **Gen scripts refuse to run while any `TODO:` sentinel remains** in
the source files (guard in `scripts/check-fixture-mtimes.ts`).

### A. Acme client pack — 3 markdown files

The virtual client is **Acme Industrial** (industry-neutral per PRD §3.7 —
no "same-store sales", no "production line", etc.). These files anchor the
hero flow; diagnostic fixtures, Tone Guard examples, and the Meeting
narrative all cite them.

| File | What | Target size |
|---|---|---|
| `fixtures/acme_fixtures/memo.md` | CEO memo — the source of the hero hypotheses | ~5 pages / 1200–1800 words |
| `fixtures/acme_fixtures/call.md` | Q3 earnings-call transcript excerpt | ~800–1500 words, speaker-labeled |
| `fixtures/acme_fixtures/org.md` | Org-chart description + reporting lines, highlighting the CDO → CEO vs CDO → COO tension | ~300–500 words |

Write in English; keep the tone neutral executive prose. Names referenced
inside (CDO, COO, CEO initials) should stay consistent across all three —
downstream fixtures cite them verbatim.

### B. Precedent library — `fixtures/precedents.json`

Drives Real-Time Recall (floating panel) and Fellow Override (hypothesis
re-compute). Target **~15 precedents**, all virtual clients (Globex 2018
is the hero — VP will test it live; Initech 2019 is the planned second).
Schema: `fixtures/precedents.schema.json`. Seed template:
`fixtures/precedents.example.json`.

Per precedent:

- `id` (slug), `client_name`, `year` (2005–2026), `industry` (neutral tag)
- `summary` — 1–3 sentence hook (~30–80 words)
- `scene` — one-line subtitle for the Recall card
- `key_quotes` — **verbatim** quotes (≥ 3 for the hero, ≥ 1 for others)
- `cgs_tags` — must match the whitelist (Strategy Wheel 7 dims + Dominant
  Logic / Structural Inertia / First Mile). Methodology misuse is a demo
  red line per PRD §3.5.3.
- `source_id` — e.g. `Globex_Board_Memo_2018_p4`, clickable provenance
- `embedding` — leave `[]`; Phase 3.1 gen script backfills 1536-float
  vectors from `text-embedding-3-small` at build time
- `drilldown_layers` — 1–3 layers (the hero has all 3). Each layer has a
  `theme` (`decision` | `transition` | `resistance` | `rebound`),
  **verbatim** `quotes` (≥ 1), and `key_facts` ({ label, value } pairs).

Budget: a filled 15-precedent file is roughly 15–25 KB of JSON text
before embeddings, ~200 KB after `pnpm gen:precedent-embeddings` writes
the vectors in place.

### C. Scripted recall queries — `fixtures/scripted_queries.json`

The Fellow's pre-wired Recall prompts during the live demo. Target
**~10 queries** covering first-hit + follow-up deep-dive paths. Schema:
`fixtures/scripted_queries.schema.json`.

Per query:

- `id` (slug), `query` (natural language, 8–20 words)
- `embedding` — leave `[]`; `pnpm gen:scripted-query-embeddings` fills it
- `expected_precedent_ids` — precedent IDs the cosine search should rank
  highest; used by e2e + phase-2a smokes
- `category` — `first-hit` | `follow-up` | `adversarial`
- `notes` — optional (intent / demo checkpoint)

### D. Continuity emails — `fixtures/continuity_fixtures/*.json`

Drives Tone Guard validator E2/E3/E6 cases. Three files, each one email:

| File | Expected Tone Guard verdict | Purpose |
|---|---|---|
| `pass.json` | `pass` | Clean three-section "What we're seeing / Quick pulse / Preliminary read" email |
| `borderline.json` | `borderline` | Subtle sales-speak or mild methodology drift — surfaces yellow |
| `high-risk.json` | `block` | Explicit methodology misuse or overt sales tone — surfaces red |

Shape (see `continuity_fixtures/email-fixture.schema.json`):

```json
{
  "id": "pass",
  "to": "D. Park <dpark@acme.example>",
  "subject": "Acme · weekly read",
  "body": "…\n\nWhat We're Seeing\n…\n\nQuick Pulse Check\n…\n\nPreliminary Read\n…",
  "expected_verdict": "pass",
  "notes": "optional"
}
```

Each body: ~120–250 words, structured into the three section headers
exactly as above (validator greps for them). `e1.json`, `e4.json`, `e5.json`
are the already-wired Phase 4 methodology-misuse examples — leave those
alone unless you want to swap the canonical error type.

### E. Images (optional — SVG fallbacks ship)

| Path | Fallback already wired | Target |
|---|---|---|
| `public/assets/thesis/before-m1.png` | `placeholder-before-m1.svg` via `<img onError>` | ~1200×800 PNG screenshot of Thesis Memory captured before Meeting 1 |
| `public/assets/thesis/before-m2.png` | `placeholder-before-m2.svg` | Same layout before Meeting 2, with the diff highlighted in crimson |
| `public/assets/fake_zoom.mp4` | CSS-animated Zoom frame | Short (~5–10s) looping Zoom-grid clip for the Meeting-mode scene |

None blocks the build — drop them in when you have them.

### Already filled (do not re-author unless you want a different narrative)

`fixtures/dashboard_fixtures/`, `fixtures/datahub_fixtures/`,
`fixtures/thesis_fixtures/`, `fixtures/diagnostic_fixtures/initial_hypotheses.json`
— skeletal but consistent with the Acme scaffold; the app reads them as-is.

### After you finish A–D: regenerate the caches

```bash
pnpm gen:all                         # embeddings + diagnostic + override + offline
```

This produces:

- 1536-dim float vectors written back into `precedents.json` / `scripted_queries.json`
- `fixtures/diagnostic_fixtures/f{1..5}.json` — Claude pre-runs F1–F5 (~2–5 KB each)
- `fixtures/override_cache.json` — pre-baked Strategy-Wheel override streams (~5–20 KB)
- `fixtures/offline_cache.json` — pre-baked Recall responses for each scripted query (~10–40 KB)

API spend for a full regen: roughly **$0.05–$0.25** depending on how
verbose your precedent bodies are (embeddings are cheap; Claude stream
generation dominates). Running `pnpm gen:all` is idempotent —
`check-fixture-mtimes.ts` skips targets that are newer than their sources.

## License

Not specified. Internal demo for the CGS hackathon.
