# Phase 1 Implementation Plan — Skeleton

## 1. Overview

Phase 1 produces the **runnable desktop shell** that every later phase is bolted onto: a Tauri 2 two-window app (main webview + always-on-top Recall overlay) serving a Next.js static export with five main routes stubbed, a typed `tauri-plugin-store` wrapper brokering cross-window state, a Claude streaming client with the 4-segment prompt-cache scaffold and boot/keep-alive heartbeats, a ~20-line cosine retrieval helper, a cmd-K global shortcut, a pre-flight check screen (Claude + OpenAI ping → red/yellow/green), the design-spec CSS migrated verbatim to `app/globals.css`, the prototype AppShell architecturally translated into an App Router layout, and a minimal set of shared components (`Toast`, `ErrorBoundary`, `TrafficLight`, `StreamingDots`). Phase 1 unblocks Phase 2A (Recall) by standing up the store, events, streaming client, cosine retrieval, tagged-stream parser host surface, and the `/recall-panel` window; unblocks Phase 2B (Override) by standing up the Wheel state field and streaming pipeline; unblocks Phase 2C (Tone Guard) by standing up the shared `TrafficLight`; and unblocks Phase 4 (fake surfaces) by locking the route skeleton and CSS tokens.

---

## 2. Directory layout after Phase 1

```
<repo-root>/
├── app/                                  # Next.js App Router (static export)
│   ├── layout.tsx                        # Root <html>/<body>, imports globals.css, mounts <ErrorBoundary>
│   ├── globals.css                       # migrated verbatim from cgs-ui-design/project/styles.css
│   ├── page.tsx                          # redirects to /dashboard (or renders pre-flight if not green)
│   ├── preflight/
│   │   └── page.tsx                      # Claude + OpenAI ping UI
│   ├── (main)/
│   │   ├── layout.tsx                    # <Titlebar/> + <Sidebar/> + <main> wrapper (AppShell port)
│   │   ├── dashboard/page.tsx            # stub "§5 Dashboard — Phase 4.1"
│   │   ├── diagnostic/page.tsx           # stub "§2 Diagnostic — Phase 4.2"
│   │   ├── continuity/page.tsx           # stub "§6 Continuity — Phase 4.3"
│   │   ├── datahub/page.tsx              # stub "§7 Data Hub — Phase 4.4"
│   │   └── meeting/page.tsx              # stub; emits meeting:start on mount (wiring only)
│   └── (floating)/
│       └── recall-panel/
│           ├── layout.tsx                # no sidebar/titlebar, vibrancy-friendly body class
│           └── page.tsx                  # stub listing event listeners + "Phase 2A" placeholder
├── lib/
│   ├── store.ts                          # typed tauri-plugin-store wrapper + subscribe helper
│   ├── events.ts                         # event name constants + typed emit/listen helpers
│   ├── window.ts                         # repositionToMainRight() + getRecallWindow()
│   ├── shortcuts.ts                      # cmd-K global shortcut registration
│   ├── llm/
│   │   ├── client.ts                     # Claude streaming + 4-segment cache scaffold
│   │   ├── segments.ts                   # Seg 1 / Seg 2 / Seg 3 / Seg 4 builders
│   │   ├── heartbeat.ts                  # boot + ~5min keep-alive
│   │   └── types.ts                      # StreamChunk, CacheSegmentSpec, etc.
│   ├── retrieval/
│   │   ├── cosine.ts                     # ~20-line cosine top-k
│   │   └── types.ts                      # Precedent / DrilldownLayer (mirrors fixtures/precedents.schema.json)
│   ├── preflight/
│   │   └── ping.ts                       # anthropic + openai 200-OK checks with timeout
│   └── components/
│       ├── Toast.tsx                     # 5 variants: info / warning / error / success / loading
│       ├── ErrorBoundary.tsx             # class component, fallback UI + retry button
│       ├── TrafficLight.tsx              # red / yellow / green dot + optional label
│       ├── StreamingDots.tsx             # 3-dot loader
│       ├── Sidebar.tsx                   # ported from AppShell.jsx, usePathname() driven
│       └── Titlebar.tsx                  # ported from AppShell.jsx titlebar block
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json                   # two windows: main + recall
│   ├── build.rs
│   ├── capabilities/
│   │   ├── main.json                     # store + event + shell scopes for main window
│   │   └── recall.json                   # store + event + window position scopes
│   ├── icons/                            # placeholder icons (Phase 1 can ship defaults)
│   └── src/
│       ├── main.rs                       # tauri::Builder setup, plugin wiring
│       └── lib.rs                        # if split mode is preferred
├── fixtures/                             # (from Phase 0)
│   ├── precedents.schema.json
│   └── precedents.example.json
├── scripts/
│   └── test-phase-0.js                   # (from Phase 0)
├── docs/
│   ├── architecture.md
│   ├── cgs-prd-v2.md
│   ├── impl-plan.md
│   ├── recall-stream-grammar.md
│   ├── tech-design.md
│   └── phase-plans/
│       ├── phase-0-plan.md
│       └── phase-1-plan.md               # this file
├── cgs-ui-design/                        # (prototype reference only, not built)
├── next.config.js                        # output:'export', images.unoptimized:true
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── .eslintrc.json
├── .prettierrc
├── .env.local.example                    # (from Phase 0)
├── .env.local                            # local-only, gitignored
└── .gitignore                            # (from Phase 0; Phase 1 verifies coverage)
```

---

## 3. Tooling + config files

### 3.1 `package.json`

Required fields:
- `"name"`: `cgs-advisors-demo`
- `"private"`: `true`
- `"packageManager"`: pnpm 10.x (runtime uses `pnpm@10.24.0` — lockfile is pnpm-lock.yaml v10 format; initial plan said 9 but 10 is already installed and working)
- `"scripts"`:
  - `dev` → `next dev` (browser-only, no Tauri shell)
  - `build` → `next build` (produces `out/` because `output: 'export'`)
  - `tauri` → `cargo tauri`
  - `tauri:dev` → `cargo tauri dev`
  - `tauri:build` → `cargo tauri build`
  - `lint` → `next lint`
  - `typecheck` → `tsc --noEmit`
  - `format` → `prettier --write .`
  - `test:phase-0` (keep from Phase 0)
- `"dependencies"`:
  - `next` (15.x, App Router)
  - `react` 18.3
  - `react-dom` 18.3
  - `@anthropic-ai/sdk` (latest; supports streaming + prompt caching)
  - `@tauri-apps/api` 2.x
  - `@tauri-apps/plugin-store` 2.x
  - `@tauri-apps/plugin-global-shortcut` 2.x
- `"devDependencies"` (carry forward `ajv`, `ajv-cli` from Phase 0, plus):
  - `typescript` 5.x
  - `@types/react`, `@types/react-dom`, `@types/node`
  - `@tauri-apps/cli` 2.x
  - `eslint`, `eslint-config-next`
  - `prettier`

### 3.2 `next.config.js`

Required fields:
- `output: 'export'` (D1)
- `images: { unoptimized: true }` (static export cannot optimize)
- `trailingSlash: true` (so `out/recall-panel/index.html` resolves cleanly inside Tauri)
- `reactStrictMode: true`
- No `headers()` / `redirects()` / middleware — static export disallows them

### 3.3 `tsconfig.json`

Required fields:
- `"target": "ES2022"`
- `"lib": ["dom", "dom.iterable", "ESNext"]`
- `"module": "esnext"`, `"moduleResolution": "bundler"`
- `"jsx": "preserve"`
- `"strict": true`
- `"noImplicitAny": true`, `"strictNullChecks": true`
- `"paths": { "@/*": ["./*"] }` (imports like `@/lib/store`)
- `"plugins": [{ "name": "next" }]`
- `"incremental": true`
- `"include"`: `["next-env.d.ts", "**/*.ts", "**/*.tsx"]`
- `"exclude"`: `["node_modules", "src-tauri/target", "out", ".next"]`

### 3.4 `src-tauri/tauri.conf.json`

Required fields:
- `"productName": "CGS Advisors"`, `"version": "0.1.0"`, `"identifier": "com.cgs.advisors.demo"`
- `"build"`:
  - `"frontendDist": "../out"` (Next.js export directory)
  - `"devUrl": "http://localhost:3000"` (next dev server in dev mode)
  - `"beforeDevCommand": "pnpm dev"`, `"beforeBuildCommand": "pnpm build"`
- `"app"`:
  - `"windows"`: array with exactly two entries — `main` and `recall`
    - `main`: `{ label: "main", url: "/", title: "CGS Advisors", width: 1440, height: 900, minWidth: 1200, minHeight: 720, decorations: true, resizable: true }`
    - `recall`: `{ label: "recall", url: "/recall-panel/", width: 380, height: 560, decorations: false, transparent: true, alwaysOnTop: true, visible: false, skipTaskbar: true, resizable: true }` — `visible: false` so meeting:start controls show
  - macOS only (documented for Mac-mirror later): `macOSPrivateApi: true`; Windows box is primary demo machine so vibrancy is best-effort
- `"plugins"`: list `store` and `global-shortcut`
- `"bundle": { "active": true, "targets": ["msi", "nsis"] }` (Windows demo host)

### 3.5 `src-tauri/Cargo.toml`

Required fields:
- Workspace or crate package named `cgs-advisors-demo`
- `edition = "2021"`
- dependencies:
  - `tauri = { version = "2", features = [] }`
  - `tauri-plugin-store = "2"`
  - `tauri-plugin-global-shortcut = "2"`
  - `serde`, `serde_json` (for command payloads)
- `[build-dependencies]` `tauri-build = { version = "2", features = [] }`

### 3.6 `src-tauri/capabilities/*.json`

- `main.json`: `core:default`, `store:default` (read/write `session.json`), `event:default` (emit/listen), `window:allow-inner-position/outer-position/inner-size/outer-size`, `global-shortcut:default`
- `recall.json`: `core:default`, `store:default` (read), `event:default`, `window:allow-show/hide/set-position/set-size/set-always-on-top`

### 3.7 `.eslintrc.json`

- extends `next/core-web-vitals`
- rules: warn on unused vars except `_`-prefixed; require `import/order`

### 3.8 `.prettierrc`

- `{ "semi": true, "singleQuote": true, "trailingComma": "es5", "printWidth": 100 }`

### 3.9 `.gitignore` additions beyond Phase 0

- `out/` (Next.js export) — confirm present (Phase 0 listed `out/`)
- `src-tauri/target/` — confirm present
- `.next/` — confirm present
- `*.tsbuildinfo`

---

## 4. Per-item plans (12 items)

### Item 1 — Next.js static export skeleton

**Files created**
- `next.config.js`, `tsconfig.json`, `next-env.d.ts`, `.eslintrc.json`, `.prettierrc`
- `app/layout.tsx` (root, imports `./globals.css`)
- `app/page.tsx` (redirect to `/dashboard` when pre-flight has passed; else to `/preflight`)

**Depends on** — nothing in Phase 1; scaffolds everything else.

**Gotchas**
- `output: 'export'` means **no dynamic server features**: no `cookies()`, no `headers()`, no route handlers, no middleware, no server actions. Any component reading `window`/`document` must be a client component and guard for SSG (use `'use client'` + `useEffect`).
- Static export will fail the build if a page depends on `dynamic = 'force-dynamic'` or reads request-time APIs — all five stubs stay simple.
- Tauri loads `out/<route>/index.html`; `trailingSlash: true` makes the routing predictable on the webview (avoids 404 on `/recall-panel`).
- Do NOT enable `experimental.turbo` in Phase 1 — we want stable static export first. (See risk §5.)

**Acceptance**
- `pnpm build` produces `out/index.html`, `out/dashboard/index.html`, `out/recall-panel/index.html`, etc.
- `out/_next/` contains static bundles; no server chunks.
- `pnpm typecheck` passes with zero errors.

---

### Item 2 — Tauri 2 two-window config

**Files created**
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`, `src-tauri/build.rs`
- `src-tauri/src/main.rs` (or `lib.rs` + thin `main.rs`)
- `src-tauri/capabilities/main.json`, `src-tauri/capabilities/recall.json`
- `src-tauri/icons/` (placeholder icon set)

**Depends on** item 1 (needs `out/` path to exist for `frontendDist`).

**Gotchas**
- Recall window must be `visible: false` at startup; meeting:start (item 4) is what shows it. If we ship visible, VP sees an empty floating panel at boot.
- `transparent: true` + `decorations: false` on Windows: vibrancy is not native; **fallback must be a solid semi-opaque paper background on `/recall-panel/layout.tsx`** so the window doesn't read as a bug (architecture R9). Document this inline in `tauri.conf.json` comments are not valid JSON — put the note in `phase-1-plan.md` and in the adjacent `.rs` file.
- `alwaysOnTop: true` is set statically; we still need `window:allow-set-always-on-top` in the capability file so runtime toggle works if needed.
- `skipTaskbar: true` on recall — prevents a second Windows taskbar entry that looks buggy.
- macOS `macOSPrivateApi: true` is needed for vibrancy; safe to set on Windows (ignored).
- `frontendDist: "../out"` is relative to `src-tauri/`; `beforeBuildCommand: "pnpm build"` ensures it exists.
- Capability files must list explicit window labels under `windows: ["main"]` vs `["recall"]` — otherwise every window gets every capability.

**Acceptance**
- `cargo tauri dev` launches two windows: main (visible, decorated, 1440×900), recall (hidden).
- Manually calling `WebviewWindow.getByLabel('recall').show()` from devtools reveals a 380×560 frameless panel that stays on top of other apps.
- Capability JSON validates (Tauri prints no ACL warnings at launch).

---

### Item 3 — `tauri-plugin-store` typed wrapper + subscribe helper

**Files created**
- `lib/store.ts`

**Depends on** item 2 (plugin must be registered in `main.rs`).

**Schema** (exactly these keys; all others forbidden by the wrapper type):

```ts
type SessionStore = {
  current_client: string | null;                  // "acme" | null
  meeting_state: 'idle' | 'in_meeting' | 'post_meeting';
  recall_history: { query: string; precedent_id: string | null; ts: number }[];
  thesis_diff_state: 'before_m1' | 'before_m2';
  wheel_scores: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7>;  // dimension → score
};
```

**Wrapper surface** (typed; no loose `any`):
- `getStore()` → cached singleton `Promise<Store>` loading `session.json`
- `get<K extends keyof SessionStore>(key: K): Promise<SessionStore[K]>`
- `set<K extends keyof SessionStore>(key: K, value: SessionStore[K]): Promise<void>` (auto `save()`-s)
- `subscribe<K extends keyof SessionStore>(key: K, cb: (v: SessionStore[K]) => void): Promise<Unlisten>` — uses `onKeyChange` under the hood (inherently async, so the return is a Promise); resolved value is a cleanup function
- `resetSession()` — writes initial defaults (used by dev menu, not by demo flow)

**Gotchas**
- `tauri-plugin-store` uses `onKeyChange` per-key. Our `subscribe` must debounce (microtask) because Phase 2B writes multiple keys in a burst; if the React component re-renders on every key, animations stutter.
- Subscribing inside a Next.js client component requires guarding for SSR: `if (typeof window === 'undefined') return;`. Wrapper should export a `useStoreField` React hook later (Phase 2+); Phase 1 only exposes imperative get/set/subscribe.
- Cross-window broadcast is automatic, but **only within the same store file name** — make sure main + recall both call `Store.load('session.json')`.
- The `wheel_scores` field shape is locked here so Phase 2B doesn't renegotiate it. Default: empty object `{}`.
- Writes during boot (before plugin registered) throw. Wrapper must internally await a one-shot `ready` promise.

**Acceptance**
- Writing `set('meeting_state', 'in_meeting')` in main window fires `subscribe('meeting_state', cb)` registered in recall window within ≤50ms.
- TypeScript rejects `set('meeting_state', 'xyz')` at compile time.
- `resetSession()` restores all five keys to defaults in one save.

---

### Item 4 — Meeting transition events + `repositionToMainRight()`

**Files created**
- `lib/events.ts` — exports event name constants + typed `emit()` / `listen()` helpers
- `lib/window.ts` — `repositionToMainRight()` and `getRecallWindow()` helpers

**Depends on** items 2 + 3.

**Events** (single source of truth in `lib/events.ts`):

```ts
export const EVENTS = {
  MEETING_START: 'meeting:start',          // payload: { client_id: string }
  MEETING_END:   'meeting:end',            // payload: {}
  RECALL_QUERY_COMPLETE: 'recall:query_complete', // payload: { query: string, precedent_id: string }
} as const;
```

**`repositionToMainRight()` spec** (from tech-design §2.4):
- Get `main` window via `Window.getByLabel('main')`.
- Read `outerPosition()` and `outerSize()`.
- Set recall position to `(main.x + main.width + 8, main.y + 80)` (80px for macOS traffic-light breathing room; harmless on Windows).
- No-op silently if either window is missing.

**Phase 1 handler wiring (stubs only)**:
- Main window (in `/meeting/page.tsx`): on mount, `store.set('meeting_state', 'in_meeting')` then `emit('meeting:start', { client_id: 'acme' })`. On unmount, `meeting:end`.
- Recall window (in `/recall-panel/page.tsx`): `listen('meeting:start', async () => { await getCurrentWindow().show(); await repositionToMainRight(); })`. `listen('meeting:end', () => getCurrentWindow().hide())`. **No content loading in Phase 1** — Phase 2A fills `loadClientContext()`.

**Gotchas**
- `emit()` in Tauri 2 broadcasts to all windows including the emitter; the recall listener must ignore echoes that came from itself. Solution: `emit` from main only; recall uses `emit` for `recall:query_complete` only (Phase 2A).
- Positioning uses **physical pixels**; on a high-DPI display, `mainWindow.outerSize()` already returns physical, so no scaling math is needed — but document it here because Phase 2D will revisit.
- If the user drags recall manually, we cannot detect "manual drag" in Phase 1. The "reattach" button is Phase 2D — just do not over-engineer now.
- `router.push('/meeting')` does not unmount other routes in App Router nested layouts — meeting:end must fire on unmount of the `/meeting/page.tsx`, not on an inner widget.

**Acceptance**
- Navigating main window to `/meeting` shows the recall floating window positioned immediately to the right of main.
- Navigating away from `/meeting` hides recall.
- Store `meeting_state` reflects the transition in both windows (verified via console log on recall listening to the store key).

---

### Item 5 — Route stubs

**Files created**
- `app/(main)/dashboard/page.tsx`
- `app/(main)/diagnostic/page.tsx`
- `app/(main)/continuity/page.tsx`
- `app/(main)/datahub/page.tsx`
- `app/(main)/meeting/page.tsx`
- `app/(floating)/recall-panel/page.tsx`
- `app/(floating)/recall-panel/layout.tsx` (chrome-less wrapper — no sidebar/titlebar; sets a CSS class to opt out of the AppShell frame)

**Depends on** item 1 (Next.js) + item 7 (AppShell main layout) for the first five; item 2 (recall window) for the last one.

**Content scope (Phase 1)**
- Each of the five main stubs renders a `<section class="page">` with `<h1>` = the title and a `<p class="placeholder">` describing which Phase will fill it in. Nothing more.
- `meeting/page.tsx` additionally fires the transition events (item 4).
- `recall-panel/page.tsx` renders a minimal "Recall panel · Phase 2A" placeholder and registers the event listeners; no streaming, no autocomplete.

**Gotchas**
- Route groups: `(main)` wraps four surfaces + meeting; `(floating)` wraps only `/recall-panel`. The `(floating)` route group layout must NOT include `<Sidebar/>` or `<Titlebar/>` — the recall panel is chrome-less by design.
- `app/page.tsx` must redirect somewhere (static export has no 404 handler by default for `/`). Use a client-side redirect via `<Link>` or a plain `useEffect(() => router.replace('/dashboard'))`. Using the `redirect()` server API **does not work** with `output: 'export'`.
- With `trailingSlash: true`, always link to `/dashboard/` (Next.js rewrites links automatically, but hand-written `href="/dashboard"` can double-redirect in Tauri).

**Acceptance**
- In the browser dev server: all six routes load without console errors.
- In the Tauri shell: main window navigates between the five surfaces via sidebar clicks; recall window renders the placeholder.
- Each page is indexable as `out/<route>/index.html` after `pnpm build`.

---

### Item 6 — Global CSS migration

**Files created**
- `app/globals.css` (migrated from `cgs-ui-design/project/styles.css`, 470 lines)

**Depends on** — nothing, but must precede item 7 (AppShell port relies on these class names).

**Migration rules**
- Copy verbatim, including the `@import` for IBM Plex fonts. (Google Fonts CDN is fine for Phase 1; self-hosting is Phase 4+ polish.)
- `:root { --ivory, --paper, --bone, --ink, --navy, --navy-2, --charcoal, --slate, --mist, --rule, --rule-2, --crimson, --crimson-ink, --sage, --sage-ink, --gold, --gold-ink, --serif, --sans, --mono, --shadow-sm/md/lg }` — all 20+ tokens preserved, **names unchanged** so ported components from the prototype keep working without renames.
- Layout classes: `.window, .titlebar, .traffic, .app, .main, .sidebar, .brand, .nav-section, .nav-item, .nav-group, .nav-sub, .sidebar-footer, .page, .page-header, .btn, .tag, .dot-tag, .card, .grid, .placeholder`, scrollbar rules, animations.
- Keep `body { overflow: hidden }` — matches Tauri single-window feel; main scroll is `.main { overflow: auto }`.

**Gotchas**
- `styles.css` uses `oklch()` for accents. Next.js (via its bundled PostCSS) passes CSS through unchanged for static export, so oklch survives. Still worth smoke-testing in Tauri's WebView2 (Chromium-based → OK).
- `.window` class sets `width: 100%; height: 100%`. In Next.js App Router, `html, body, body > #__next` must all be `height: 100%` or flex-grow chains break. The imported `html, body { margin: 0; padding: 0; height: 100% }` rule from the prototype handles this; **do not remove it**.
- The prototype loads Google Fonts via `@import` at the top of `styles.css` — keep this, but also add `<link rel="preconnect">` in `app/layout.tsx` `<head>` for a faster first paint (optional polish; not blocking).
- No CSS Modules, no Tailwind — single global stylesheet is the intended architecture for Phase 1.

**Acceptance**
- Every class name referenced in `AppShell.jsx` / `Sidebar.jsx` (§2.3) resolves to a rule in `globals.css`.
- Visual diff against the prototype HTML (read CSS rules, do not render) shows byte-equivalent style rules except for the file header comment.
- No console errors about missing CSS custom properties.

---

### Item 7 — AppShell port

**Files created**
- `app/(main)/layout.tsx` — the actual App Router layout: renders `<Titlebar/>` + `<Sidebar/>` + `<main className="main">{children}</main>` inside `<div className="window">` + `<div className="app">`
- `lib/components/Sidebar.tsx` — ported from `cgs-ui-design/project/components/AppShell.jsx` lines 24–85; `active` prop replaced by `usePathname()`
- `lib/components/Titlebar.tsx` — ported from `AppShell.jsx` lines 6–13

**Depends on** items 1 + 6 (CSS tokens); items 2 + 3 (Sidebar reads `current_client` from store — but Phase 1 just hard-codes "Acme Industrial" like the prototype; the store read is Phase 2+).

**Architectural translation (not copy-paste)**
- Prototype passes `active="<id>"` into `AppShell`. In App Router we derive:
  ```ts
  const pathname = usePathname();
  const active = pathname.startsWith('/dashboard') ? 'dashboard'
               : pathname.startsWith('/diagnostic') ? 'diagnostic'
               : pathname.startsWith('/continuity') ? 'continuity'
               : pathname.startsWith('/datahub') ? 'datahub'
               : pathname.startsWith('/meeting') ? 'meeting'  // new — prototype didn't have
               : null;
  ```
- Convert the inline `Sidebar` JSX (which uses `<div className={...}>` click-targets) to `<Link href="/dashboard/">` etc. The prototype is click-less (design canvas); the Next.js port must navigate.
- Prototype's `<SubNav>` inner component stays inside `Sidebar.tsx` as a local helper.
- `'use client'` directive at the top of `Sidebar.tsx` (uses `usePathname`) and `(main)/layout.tsx` (renders a client component).
- Prototype's `compact` prop on `AppShell` (for `ThesisFullPage` artboard) is deferred — Phase 1 does not render the `compact` variant; add a TODO comment only.

**Gotchas**
- `usePathname()` returns `null` during initial SSG render; the derived `active` must handle null → fallback `'dashboard'` or `null` (prefer `null` so no item is highlighted until hydration).
- With `trailingSlash: true`, `pathname` will be `/dashboard/` — `startsWith` comparisons work, exact-match `===` does not.
- The prototype uses some odd class names (`.c`, `.m`, `.x` for traffic lights) — these ARE real class names in `styles.css` and must survive the migration (item 6 locks them).
- The sidebar `⌘K · Ask recall` hint card is static text in Phase 1; global shortcut wiring is item 11.
- Prototype `<Sidebar>` hardcodes counts like `14` / `3` next to nav items — leave as hardcoded text; they are cosmetic.

**Acceptance**
- Clicking "§5 Dashboard" in sidebar navigates to `/dashboard/`; highlight moves to Dashboard row.
- Nested Meeting Recall active state (`preread`/`realtime`/`post` list) is deferred to Phase 2A — Phase 1 leaves the sub-nav absent (the prototype already renders sub-nav only when active is one of those three, which we never hit in Phase 1).
- Titlebar shows the hardcoded "CGS Workbench · Acme Industrial · cgs-advisors.local" chrome.
- The `(floating)/recall-panel` route does NOT render this layout (route group isolation).

---

### Item 8 — `lib/llm/client.ts` Claude streaming + 4-segment prompt cache

**Files created**
- `lib/llm/client.ts`
- `lib/llm/segments.ts`
- `lib/llm/heartbeat.ts`
- `lib/llm/types.ts`

**Depends on** items 1 + 3 (store read for `current_client` → Seg 3 gating).

**Segment builders** (`lib/llm/segments.ts`):
- `buildSeg1_Framework()`: CGS framework text (Strategy Wheel 7 dims + Dominant Logic + Structural Inertia + First Mile). **Static string constant or loaded from `lib/methodology/tags.ts` when Phase 2C ships.** Phase 1 stub: a named constant with a TODO pointing to the content owner deliverable.
- `buildSeg2_Precedents()`: read `fixtures/precedents.json` (does not exist yet; Phase 1 reads the Phase 0 `precedents.example.json`) and concat the content fields. Note: embeddings are not part of Seg 2.
- `buildSeg3_AcmeContext(clientId)`: returns `null` if `clientId !== 'acme'`; else returns Acme fixture text (stub in Phase 1, filled by content owner). **Critical: returning `null` means the message array has one fewer item, not an empty string — this keeps the cache prefix byte-identical for the non-Acme path.**
- `buildSeg4_Dynamic(query, precedentIds)`: the per-call slot.

**`streamCompletion()` signature** (`lib/llm/client.ts`):

```ts
type StreamOptions = {
  mode: 'recall' | 'override' | 'heartbeat';
  clientId: string | null;
  precedentIds?: string[];
  query?: string;
  onDelta: (textDelta: string) => void;
  onComplete: (result: { fullText: string; usage: CacheUsage }) => void;
  signal?: AbortSignal;
};
```

- Uses `@anthropic-ai/sdk`'s `messages.stream()`.
- Passes Seg 1 / Seg 2 / (Seg 3 conditionally) as system-message array entries **each with `cache_control: { type: 'ephemeral' }`** — this is how Anthropic marks the prompt-cache breakpoints.
- Seg 4 is the user message; not cached.
- Forwards `usage.cache_creation_input_tokens` and `usage.cache_read_input_tokens` in `onComplete` so the exit-gate test can assert `cache_read_input_tokens > 0`.

**Heartbeat** (`lib/llm/heartbeat.ts`):
- `startBootHeartbeat()`: fires a 10-token completion with Seg 1 + Seg 2 only (Seg 3 = null) at app boot. Called from `app/layout.tsx` via a client-only `useEffect`. Must not block render.
- `startKeepAliveHeartbeat()`: `setInterval(fire, 270_000)` (4.5 minutes — safely under Anthropic's ~5 min TTL). Fires with the **currently active cache path** (with or without Seg 3, based on store `current_client`).
- `warmAcmeContextOnce()`: on first store change `current_client: null → 'acme'`, silently fire one completion with Seg 1+2+3 to warm the with-Seg-3 cache. Guarded by a module-level `warmed` boolean. (Documented in impl-plan.md §1.8.)

**Gotchas — cache-busting on Seg 3 conditional**
- **This is the non-obvious item.** With Seg 3 present → cache prefix `[Seg1][Seg2][Seg3]`. Without Seg 3 → `[Seg1][Seg2]`. These are **two separate cache keys**. Boot heartbeat only warms the no-Seg-3 path; entering Acme view is a cold cache hit on the with-Seg-3 path unless we pre-warm.
- Solution (spec'd above): `warmAcmeContextOnce()` fires one silent call when the user enters Acme view. From then on, keep-alive heartbeat fires on whichever path is active.
- If `current_client` flips back to `null` (theoretical; demo doesn't do this), the with-Seg-3 cache will TTL out — do not try to keep both warm; not worth the API spend.
- Any whitespace or comment drift in Seg 1 / Seg 2 / Seg 3 between the boot call and subsequent calls will break caching. Builders must be **pure functions with frozen outputs** (memoize in-process).

**Phase 1 scope discipline**
- The **stream parser** (tagged stream → events) is **Phase 2A**, NOT Phase 1. Phase 1's `streamCompletion` just forwards raw text deltas via `onDelta`. Do not pre-implement the parser here — the grammar lives in `docs/recall-stream-grammar.md` and Phase 2A owns it.
- Phase 1 does not populate Seg 1 / Seg 3 with real content; stub strings are acceptable, but the **sizes must be representative** (a few KB each) so cache-hit measurements in the exit gate are realistic.

**Acceptance**
- Calling `streamCompletion({ mode: 'heartbeat', clientId: null, query: 'ping', onDelta: noop, onComplete: cb })` twice in succession results in `cache_read_input_tokens > 0` on the second call (logged to console for exit-gate verification).
- Switching `current_client` to `'acme'` fires exactly one `warmAcmeContextOnce` call (no duplicates across renders).
- `startKeepAliveHeartbeat` fires at 4.5 min intervals; verifiable via a log counter.
- `streamCompletion` respects `AbortSignal` cancellation.

---

### Item 9 — `lib/retrieval/cosine.ts`

**Files created**
- `lib/retrieval/cosine.ts` (~20 lines)
- `lib/retrieval/types.ts` (mirrors `fixtures/precedents.schema.json` TypeScript shapes)

**Depends on** Phase 0.1 schema (already committed).

**Surface**:
```ts
export function cosineTopK(
  queryEmbedding: number[],
  precedents: Precedent[],
  k = 3,
): { precedent: Precedent; score: number }[];
```

**Gotchas**
- Skip any `precedent.embedding.length === 0` entry (pre-Phase-3.1 stubs).
- Dimension mismatch (query length ≠ embedding length) → throw, don't silently return `[]`; fail-fast surfaces Phase 3 integration bugs.
- No normalization assumption: compute `dot / (|q| · |p|)` fully. OpenAI `text-embedding-3-small` vectors are unit-normalized, but we own the math so we don't inherit a silent wrong answer if a future embedder is not.
- Stable sort on ties.

**Acceptance**
- Unit test: two hand-built precedents with known embeddings + a query embedding; `cosineTopK` returns them in the expected score order.
- Handles `k > precedents.length` gracefully (returns all).

---

### Item 10 — Pre-flight check screen

**Files created**
- `app/preflight/page.tsx`
- `lib/preflight/ping.ts`

**Depends on** items 1 + 12 (`<TrafficLight/>`).

**`ping.ts` surface**:
```ts
type PingResult = { ok: boolean; latencyMs: number; error?: string };
export async function pingAnthropic(signal: AbortSignal): Promise<PingResult>;
export async function pingOpenAI(signal: AbortSignal): Promise<PingResult>;
```

- Anthropic: `client.messages.create({ model, max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] })` with `signal`.
- OpenAI: direct `fetch('https://api.openai.com/v1/embeddings', ...)` — no SDK needed for one ping; keeps install light.
- Timeout: `NEXT_PUBLIC_PREFLIGHT_TIMEOUT_MS` from `.env.local` (5000 default).

**Page UI** (architecture §5.1):
- Two rows: Anthropic / OpenAI.
- Each row: `<TrafficLight color={...} label={...} />` + latency ms + retry button.
- Green when `ok: true`. Red when Anthropic fails (block entry). Yellow when OpenAI fails (allow entry but warn "脱稿 query will fail"; architecture §5.1).
- "Enter demo" button disabled until Anthropic is green. Routes to `/dashboard`.

**Gotchas**
- API keys come from `.env.local` via `NEXT_PUBLIC_*` — **do NOT expose `ANTHROPIC_API_KEY` with the public prefix**; it is secret. Since Tauri webview is a controlled environment (not publicly shipped), reading via `process.env.ANTHROPIC_API_KEY` in a client component IS exposed to the final bundle — but that bundle only runs inside the demo laptop. Document this trade-off in `lib/llm/client.ts` comments. (The demo is a single-host install, not a public site. If this assumption changes, move calls behind a Tauri Rust command.)
- `fetch` to Anthropic from a browser context triggers CORS in dev server; inside Tauri, CORS is not enforced — so pre-flight **works in Tauri, may fail in `next dev` standalone**. Mitigation: gate a dev-only fake "green" toggle via `?mock=green` query string.
- Ping failures must not throw out of `useEffect`; wrap in try/catch and set state.

**Acceptance**
- Both green → "Enter demo" enabled.
- Anthropic red → entry blocked + red tooltip text.
- OpenAI yellow → entry allowed + yellow tooltip.
- Page loads without any runtime error even with no keys set (both show red with "missing env var").

---

### Item 11 — cmd-K global shortcut registration

**Files created**
- `lib/shortcuts.ts`
- Registration call wired into `app/layout.tsx` (client-only via `useEffect`)

**Depends on** items 1 + 2 + 4.

**Behavior (Phase 1 scope)**
- On app boot: `register('CommandOrControl+K', onSummon)`.
- `onSummon()`: read `meeting_state` from store. If `idle`/`post_meeting`: call `getRecallWindow().show()` + `repositionToMainRight()`. If already `in_meeting` and window already visible: focus the recall window. If user manually `×`-closed the recall window: re-show on next cmd-K.
- On app teardown: `unregisterAll()`.

**Gotchas**
- `tauri-plugin-global-shortcut` intercepts the key combo globally — this means cmd-K **will not pass to the focused textarea inside the recall panel**. Solution: only register when recall is hidden; unregister when recall is visible; re-register on close. Or: use a window-scoped keyboard listener in the recall panel itself and let the global shortcut fire only when our app is not focused. Phase 1 picks **approach 1** (simpler); document the trade-off.
- On Windows, "CommandOrControl+K" is Ctrl+K, which some apps (browsers) also consume. The global shortcut API claims exclusivity at the OS level only when the foreground app doesn't own the binding — this is fine for the demo where the user focuses a browser first and then presses Ctrl+K to summon recall.
- Must work after user closes the recall window (architecture requirement). Verify by: summon → close recall (×) → summon again → panel re-appears.
- Avoid double-registration on HMR: `shortcuts.ts` uses a module-level `registered` flag.

**Acceptance**
- cmd-K (mac) / Ctrl+K (Windows) from anywhere on the OS summons the recall panel.
- Pressing cmd-K a second time with recall visible focuses it (does not hide it).
- Restarting the app still works (no dangling OS shortcut after crash).

---

### Item 12 — Shared base components

**Files created**
- `lib/components/Toast.tsx`
- `lib/components/ErrorBoundary.tsx`
- `lib/components/TrafficLight.tsx`
- `lib/components/StreamingDots.tsx`

**Depends on** item 6 (CSS tokens).

**Surfaces**:

- `<Toast variant="info"|"warning"|"error"|"success"|"loading" onDismiss?={() => void}>{children}</Toast>`
  - Inline, positioned within caller's container — NOT a global toast stack in Phase 1.
  - `loading` variant embeds `<StreamingDots/>` at the left.
  - Auto-dismiss after 4s for `success`/`info`; sticky for `warning`/`error`/`loading`.

- `<ErrorBoundary fallback?={ReactNode} onReset?={() => void}>{children}</ErrorBoundary>`
  - Class component (React still requires this for error boundaries).
  - Default fallback: a card with error message + "Retry" button that calls `onReset` and `forceUpdate`s.
  - Mounted once at the top of `app/layout.tsx` (root) and once at the top of `(floating)/recall-panel/layout.tsx`.

- `<TrafficLight color="red"|"yellow"|"green" label?={string} size?={"sm"|"md"}>`
  - A single colored dot using token colors (`--crimson`, `--gold`, `--sage`).
  - Optional inline label on the right.
  - Used by pre-flight (item 10) AND by Tone Guard in Phase 2C — **single source of truth**.

- `<StreamingDots count?={3} />`
  - Three animated dots using `@keyframes` in `globals.css` (the prototype already has animations; piggyback).

**Gotchas**
- `ErrorBoundary` cannot be a React Server Component → file must start with `'use client'`.
- `Toast` auto-dismiss uses `setTimeout` — must `clearTimeout` in cleanup to avoid React state-update-after-unmount warnings.
- Colors must reference CSS custom properties (not hex) so later theme switches are cheap.

**Acceptance**
- Storybook-equivalent: a temporary `/dev/components` route (gate behind a dev flag) renders one of each variant and confirms visual parity with the prototype's design system sheet (`design-canvas.jsx` Part 9). Or: smoke-check in the pre-flight page which uses `<TrafficLight/>` directly.
- `ErrorBoundary` catches a thrown error in a child and shows the fallback card; clicking "Retry" re-mounts.

---

## 5. Cross-item risk notes

- **Static export × server-only APIs**: any accidental use of `cookies()`, `headers()`, route handlers (`app/**/route.ts`), or `dynamic = 'force-dynamic'` will fail `next build`. Enforce via: `.eslintrc.json` rule + CI step that runs `pnpm build` not just `typecheck`.
- **Hydration mismatches on store reads**: `lib/store.ts` calls Tauri APIs that only exist in the webview runtime. Any component reading the store during SSG render will mismatch on hydration. **Rule: all store reads go in `useEffect`**, initial state defaults to schema default. Document in `lib/store.ts` header comment.
- **Streaming inside a static-exported page**: Phase 2A will hit this — in Phase 1 we only wire `streamCompletion` from client components (never from `generateStaticParams` etc.). Verify by: no top-level `await` in any `page.tsx` that touches `lib/llm/*`.
- **Tauri plugin ACLs**: Phase 1 is where capability JSONs get authored. Forgetting `store:default` on the recall window silently breaks the cross-window broadcast — the error appears only at runtime as "denied". Exit gate includes a cross-window write/read test.
- **Prompt cache breakpoints × content drift**: Seg 1 and Seg 2 content is Phase 1 stub text. When Phase 2C ships the real methodology tags and Phase 3.A ships the real precedent library, those stub bytes change → cache is invalidated. This is expected and not a regression; the heartbeat warms the new cache on the first real call.
- **Global shortcut × focus stealing**: see item 11 gotchas. If we accidentally register cmd-K permanently and unregister fails on app crash, the keybinding stays hot until reboot. `unregisterAll()` in an `atexit`-style hook in `main.rs` mitigates but does not eliminate this risk — document.
- **Windows WebView2 vs macOS WKWebView**: vibrancy is the reason Tauri was picked over Electron (architecture D5). Phase 1 on Windows will NOT show native vibrancy — that is fine, the fallback solid-translucent background is the acceptance state. Do NOT spend Phase 1 time trying to make Windows vibrancy work; it is a known gap.
- **Trailing-slash consistency**: `trailingSlash: true` + hand-written `<Link>` hrefs without trailing slash can produce a double-redirect that flashes the root page. Lint-rule idea: forbid href strings without trailing slash to `/dashboard` etc.

---

## 6. Implementation DAG (order the implementer should follow)

1. **Item 1** — package.json + next.config.js + tsconfig.json + eslint/prettier. `pnpm install`, confirm `pnpm dev` starts.
2. **Item 6** — migrate `styles.css` → `app/globals.css`. Import in `app/layout.tsx`. (Landing page renders `<div className="window">` background correctly.)
3. **Item 12** — shared components (`TrafficLight`, `StreamingDots`, `Toast`, `ErrorBoundary`). Pure JSX+CSS, no external deps.
4. **Item 2** — Tauri scaffold (`cargo tauri init`-style, but we hand-write conf to match our dual-window + plugin list). `cargo tauri dev` boots main window; recall window hidden. Plugins register clean.
5. **Item 3** — `lib/store.ts`. Exit condition: smoke `await set / await get` from devtools in main window.
6. **Item 4** — `lib/events.ts` + `lib/window.ts`. Cannot fully test until item 5 wires the meeting route, but file is ready.
7. **Item 7** — AppShell port (`app/(main)/layout.tsx` + `lib/components/Sidebar.tsx` + `lib/components/Titlebar.tsx`). Exit condition: title bar + sidebar render with correct tokens.
8. **Item 5** — route stubs. Stubs for the 5 main routes render inside AppShell. `/recall-panel` stub renders in recall window.
9. **Wire item 4 handlers** — meeting page emits, recall page listens. Exit condition: navigating main to `/meeting` shows recall floating; navigating away hides it.
10. **Item 9** — `lib/retrieval/cosine.ts` + types. Trivial; knock out with unit test.
11. **Item 8** — `lib/llm/` (client, segments, heartbeat, types). Boot heartbeat wired into `app/layout.tsx`. Exit condition: second heartbeat call logs `cache_read_input_tokens > 0`.
12. **Item 10** — pre-flight page. Routes properly: `app/page.tsx` → `/preflight/` (if not yet passed) or `/dashboard/` (if passed, tracked via session memory only — no persistence).
13. **Item 11** — cmd-K global shortcut. Exit condition: summon from another app works.
14. **Dry-run**: restart cold, walk through all five routes, trigger meeting transition, trigger cmd-K.

Order rationale: front-loaded items (1/6/12) are pure-frontend and can be tested without Tauri at all; items 2/3/4 bring in Tauri; items 7/5 complete the main window UX; items 8–11 add the cross-cutting infra; item 10 is last because it depends on 12 + 8.

---

## 7. Test strategy

| Type | Coverage |
|---|---|
| **Unit (vitest or `node --test`)** | `lib/retrieval/cosine.ts` (4 tests: top-1/top-3, empty embedding skip, dim mismatch throw, stable tie-break). `lib/store.ts` type-level tests via `tsc --noEmit` on a fixture file that tries illegal writes (expect compile errors, verified manually). |
| **Type check** | `pnpm typecheck` catches most Phase 1 regressions. Add to CI. |
| **Build smoke** | `pnpm build` must produce `out/` with all 6 HTML files. Add to CI. |
| **Manual smoke in Tauri** | Documented checklist (see §8 exit gate): boot → pre-flight green → navigate 5 main routes → `/meeting` shows recall → navigate away hides recall → cmd-K re-shows recall → close recall `×` → cmd-K re-shows → wait 5 min → heartbeat fired (console log) → kill app → cold restart → cache hit on first heartbeat. |
| **Playwright (deferred)** | No Playwright in Phase 1. Tauri webview is not standard Playwright target, and the orchestration cost isn't justified until Phase 2A's stream rendering needs visual regression. Defer to Phase 2A or later. |
| **Anthropic cache-hit verification** | One manual test: call `streamCompletion` twice with identical Seg 1+2; assert `cache_read_input_tokens > 0` on call 2. This is the single most important correctness signal for item 8. |

No E2E automation (impl-plan §测试策略 explicitly: "不做 E2E 自动化").

---

## 8. Exit gate checklist

Phase 1 is done when **every** box below is checked:

- [ ] `pnpm install && pnpm build` produces `out/` with 6 `index.html` files (5 main routes + recall + preflight + root).
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `cargo tauri dev` launches two windows (main visible 1440×900; recall hidden, 380×560 decorations-off).
- [ ] Main window navigates between `/dashboard`, `/diagnostic`, `/continuity`, `/datahub`, `/meeting` via sidebar clicks with active-state highlight tracking.
- [ ] Navigating main to `/meeting` emits `meeting:start`; recall window shows + positions at main-right+8px.
- [ ] Navigating main away from `/meeting` emits `meeting:end`; recall window hides.
- [ ] `store.set('meeting_state', ...)` in main triggers a subscribed callback in recall within ≤50ms.
- [ ] TypeScript rejects an illegal store write at compile time (demonstrate via a throwaway file + `tsc --noEmit`).
- [ ] Pre-flight page: Anthropic green + OpenAI green unblocks "Enter demo" button; Anthropic red blocks it; OpenAI red yields yellow warning.
- [ ] cmd-K / Ctrl+K from outside the app (e.g., with Finder/Explorer focused) summons the recall panel.
- [ ] Manually closing the recall panel and pressing cmd-K re-shows it.
- [ ] Boot heartbeat fires exactly once on startup (log evidence).
- [ ] Second completion call (any mode) logs `usage.cache_read_input_tokens > 0`, proving prompt cache hit — architecture's build-completion signal.
- [ ] Keep-alive heartbeat fires at ~4.5 min (observe console log after 5 min).
- [ ] Entering Acme view (setting `current_client='acme'` in store) fires exactly one silent `warmAcmeContextOnce` call; subsequent Acme-path calls show `cache_read_input_tokens > 0`.
- [ ] `lib/retrieval/cosine.ts` unit tests pass (4/4).
- [ ] `globals.css` contains every token + layout class enumerated in §4.6; no class used by Sidebar/Titlebar is missing.
- [ ] Recall panel route `/recall-panel/` renders chrome-less (no titlebar, no sidebar).
- [ ] Error boundary fallback displays when a child throws (manually triggered via `throw new Error('test')` in a page).
- [ ] `.env.local` contains real keys; `.env.local` is gitignored (re-verify `git check-ignore .env.local`).
- [ ] Phase 0 artifacts still intact: `fixtures/precedents.schema.json`, `fixtures/precedents.example.json`, `docs/recall-stream-grammar.md`, `.env.local.example`, `.gitignore`.
- [ ] This plan, `docs/phase-plans/phase-1-plan.md`, committed.

When all boxes are green: **Phase 1 ships → Phase 2A (Recall) may start** (impl-plan §Phase 2A prereqs 1.2 / 1.3 / 1.4 / 1.8 / 1.9 / 1.11 / 1.12 all satisfied).
