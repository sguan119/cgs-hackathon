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

## Content gaps (outside engineering scope)

These are flagged in `docs/impl-plan.md` §3.A. The app runs with fallbacks
until they land:

1. `fixtures/precedents.json` — full 15 precedent bodies (Globex 2018 hero)
2. `fixtures/scripted_queries.json` — 10 scripted queries
3. `fixtures/diagnostic_fixtures/f{1..5}.json` — generated via `pnpm gen:diagnostic-fixtures`
4. `fixtures/continuity_fixtures/*.json` — real email bodies
5. `public/assets/fake_zoom.mp4` — CSS fallback already wired
6. `public/assets/thesis/before-m{1,2}.png` — SVG placeholders already wired

## License

Not specified. Internal demo for the CGS hackathon.
