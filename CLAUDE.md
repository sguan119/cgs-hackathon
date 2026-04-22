# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

CGS Advisors demo for a b-school agentic-AI challenge. **Spec phase** — no application code written yet. The artifacts in this repo are:

- `docs/` — three markdown specs (Chinese + technical English mixed) that together define the demo
- `cgs-ui-design/` — a handoff bundle from Claude Design with HTML/React prototype artboards

The target application (not yet built) is a **Tauri 2 desktop app** that packages a Next.js static-export frontend. See `docs/architecture.md` for the full stack and decisions (D1–D6).

## The three-doc split — do not mix them

| Doc | Scope |
|---|---|
| `docs/cgs-prd-v2.md` | What observers see / what claims the 15-min demo must pay off. Product-level language only. |
| `docs/architecture.md` | How the system is built. Tech stack, window model, data flow, LLM pipeline. |
| `docs/tech-design.md` | Which features are built for real vs faked, plus concrete implementation details (Tone Guard validator, override cache schema, Meeting transition events, etc.). |

When editing, **keep concerns in the right doc**. The team already pushed back on PRD pollution with Tauri/SQLite terms. Technical decisions live in architecture; fake/real boundary and asset specs live in tech-design.

## Build cut principle (tech-design.md §1)

Only four things get **real implementations** — everything else is fixture, pre-generated, or CSS animation:

1. §3.6.2 Real-Time Recall (PRD locks this as `real (半脚本)`)
2. §2 F6 Fellow Override (demo high point, VP will live-test it)
3. §6 E3 Tone Guard validator (VP will ask "what if the email said X")
4. Tauri shell + two-window orchestration (infrastructure)

Before adding code or fixtures, check §1.1 / §1.2 of tech-design.md to confirm a feature's bucket. Don't over-engineer fake surfaces.

## UI design bundle (`cgs-ui-design/project/`)

This is a **prototype**, not production code. Zero-dependency HTML page that loads React 18 + Babel standalone + IBM Plex fonts from CDNs.

- Entry: `cgs-ui-design/project/CGS Design Spec.html`
- Loaded via `<script type="text/babel">` — each component exposes itself with `Object.assign(window, { ... })`
- To add a new prototype component, create `components/<Name>.jsx` and add a `<script>` tag before `app.jsx` in the HTML
- Fixtures live on the `window` global (see `fixtures.js`)
- The file `components/NewArtboards.jsx` holds sketches added to close gaps between the design canvas and the architecture/tech-design decisions (see `app.jsx` "Part 8 · Architecture-aligned additions")

Per `cgs-ui-design/README.md`: **don't render these files in a browser or take screenshots unless the user asks** — read the HTML/CSS directly.

## Fixture conventions

- Virtual client is always **Acme Industrial** (industry-neutral per PRD §3.7 — no sector-specific terms like "same-store sales" or "production line")
- Precedent clients are virtual too: **Globex** (2018 CDO reporting-line case — the hero precedent), **Initech** (2019)
- CGS methodology tags (Strategy Wheel 7 dims + Dominant Logic / Structural Inertia + First Mile) must be **100% aligned with CGS official definitions** — methodology misuse is a demo red line (PRD §3.5.3)

## Stack decisions already made (architecture.md §1)

| # | Layer | Choice |
|---|---|---|
| D1 | Frontend | Next.js static export (`output: 'export'`) |
| D2 | Retrieval | JSON + in-memory cosine over ~15 precedents (no vector DB) |
| D3 | LLM | Anthropic Claude + streaming + prompt caching |
| D4 | Embedding | OpenAI `text-embedding-3-small`, **computed at build time**; runtime fallback only on free-text queries |
| D5 | Desktop shell | **Tauri 2** (chosen for Mac-native vibrancy on the Recall floating panel) |
| D6 | Cross-window state | `tauri-plugin-store` (not SQLite) |

Don't relitigate these without explicit direction. The Recall floating panel being a **separate OS-level window** (not a sidebar inside the main window) is the reason Tauri was picked.

## Navigating doc references

Specs cross-reference PRD sections by number (e.g. `§3.6.2` = Real-Time Recall). When a doc mentions `§N.M`, check whether the number is PRD-local (§2, §3, §5, §6, §7 are PRD top-level) or doc-local (architecture and tech-design use `§` for their own internal sections too). Context usually disambiguates.
