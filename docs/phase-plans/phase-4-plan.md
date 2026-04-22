# Phase 4 Implementation Plan — Fake Surface Port

## 1. Overview

Phase 4 is the **last build phase** and turns the four remaining stubs (`/dashboard`, `/datahub`, `/meeting`, plus the fixture-wire-up on `/diagnostic` + `/continuity`) into the fake surfaces the 15 min demo narrative walks through. Everything here is fixture-driven, CSS-animated, or static — no new Claude / OpenAI calls, no new Rust — because impl-plan §Phase 4 + tech-design §1.1 pin that §5 Dashboard / §7 Data Hub / §2 F1-F5 / §6 E4+E5 / Meeting split / Thesis Memory are fake by design (the four real surfaces — 2A Recall, 2B Override, 2C Tone Guard, 2D Shell — already shipped). Five items do the heavy lifting: (4.1) Dashboard context-load orchestration with the six-panel 30 s setTimeout timeline and click-to-route dispatcher; (4.2) Diagnostic F1-F5 fixture read + Wheel sector-by-sector coloring animation (F6 Override stays on Phase 2B — no change); (4.3) Continuity E1 baseline + E4 reply extractor + E5 internal escalation fixture renders — E2 emails + E3 paste already on Phase 2C; (4.4) Data Hub F1-F3 static + F5-F8 CSS-animated indicator-light sweep that fires on a "Push" button click; (4.5) Meeting state CSS split (left `fake_zoom.mp4` or CSS fallback + right single static shared-deck slide) that emits the existing `meeting:start` on route enter; (4.6) Thesis Memory toggle showing two pre-gen screenshots (Meeting 1 / Meeting 2) with a simple swap button. Content owner still owes `fake_zoom.mp4`, the two Thesis screenshots, and the real Dashboard timeline copy (per §3.A); this plan specifies the fallback surfaces that render without those assets so the demo dry-runs don't block on content. Exit gate: all 5 main routes render live (no "Phase 4.X will fill this" text anywhere), `pnpm build` produces the static export, and the prior 657 tests stay green — Phase 4 adds ~20-25 new jsdom + unit tests for the orchestration timer, routing table, and Thesis toggle.

---

## 2. Directory deltas (new files only)

```
app/
  (main)/
    dashboard/
      page.tsx                                  # REWRITTEN: renders <DashboardPage/>
      DashboardPage.tsx                         # container: mounts ClientSwitcher + header + panels; drives orchestration
      ClientSwitcher.tsx                        # port from prototype (static, Acme always active in demo)
      RelationshipStage.tsx                     # port StageTrack
      ContextLoadBanner.tsx                     # "Context loaded · 28s" strip + live ms timer
      InteractionTimeline.tsx                   # port TimelineItem; click → routeEventToSurface()
      AlertsCard.tsx                            # port AlertCard list
      ExternalSignals.tsx                       # port signals card
      ThesisMemoryToggle.tsx                    # 4.6 — two-screenshot toggle + keyboard nav
      useDashboardOrchestration.ts              # 4.1 orchestration hook (setTimeout timeline + cleanup)
      dashboard-timeline.ts                     # 4.1 constants: RELOAD_TIMELINE + EVENT_ROUTE_MAP
      dashboard-timeline.test.ts                # unit — timeline constant + route-map coverage
      useDashboardOrchestration.test.tsx        # jsdom — fake-timers sweep + unmount cancels pending
      DashboardPage.test.tsx                    # jsdom — panels hydrate in order, click routes correctly
      ThesisMemoryToggle.test.tsx               # jsdom — toggle swaps srcset, keyboard works
    datahub/
      page.tsx                                  # REWRITTEN: renders <DataHubPage/>
      DataHubPage.tsx                           # container: uploads + client table + push strip
      UploadsCard.tsx                           # port "Recent uploads" card (F3 static)
      ClientTagTable.tsx                        # port CRM tagged table (F1 + F2 static; Acme row expandable)
      ClientFolder.tsx                          # port expanded-row file list (Acme folder)
      DistributeStrip.tsx                       # 4.4 — "Push" button + 4 downstream indicator lights
      useDistributeAnimation.ts                 # 4.4 — sequenced indicator-light activation
      DistributeStrip.test.tsx                  # jsdom — click button → lights activate in order
    meeting/
      page.tsx                                  # REWRITTEN: renders <MeetingPage/> with split layout
      MeetingPage.tsx                           # container: emits meeting:start on mount / end on unmount (port of stub's effect)
      FakeZoomPane.tsx                          # left pane — <video> loop OR CSS fallback
      SharedDeckPane.tsx                        # right pane — single static slide (no paging)
      MeetingPage.test.tsx                      # jsdom — start/end events emitted at mount/unmount; video fallback renders
fixtures/
  dashboard_fixtures/
    dashboard.json                              # 4.1 — Acme client + timeline + alerts + signals + stages
    dashboard.schema.json                       # JSON Schema validated in scripts/test-phase-0.js
  datahub_fixtures/
    datahub.json                                # 4.4 — uploads + CRM rows + Acme folder files
    datahub.schema.json                         # JSON Schema
  thesis_fixtures/
    thesis.json                                 # 4.6 — { before_m1: {...}, before_m2: {...} }
    thesis.schema.json                          # JSON Schema
    placeholder-before-m1.svg                   # fallback screenshot — ships with engineering deliverable
    placeholder-before-m2.svg                   # fallback screenshot
public/
  assets/
    fake_zoom.mp4                               # content-owner deliverable (fallback CSS placeholder if missing)
    thesis/
      before-m1.png                             # content-owner deliverable (§3.A)
      before-m2.png                             # content-owner deliverable (§3.A)
      README.md                                 # notes on provenance + fallback behaviour
tests/unit/
  routing-map.test.ts                           # unit — every timeline.kind has an entry in EVENT_ROUTE_MAP
```

No new npm deps. No Rust / Tauri capability changes. No new `.env.local` keys. No changes to `lib/store.ts` (SessionStore schema stays closed). No new routes (four existing stubs swap to real pages; no siblings added).

**Shared asset directory**: `public/assets/` is the Next.js static-export serving root for binary media. Phase 4 introduces this dir (the first phase that needs hosted media inside `out/`). Per Next.js static-export rules, files under `public/` copy verbatim into `out/` and resolve at `/assets/...`. Tauri shell runs from `out/index.html` so `/assets/fake_zoom.mp4` resolves correctly in-app.

---

## 3. Data shapes

### 3.1 `DashboardTimelineEvent` + `EVENT_ROUTE_MAP` (`app/(main)/dashboard/dashboard-timeline.ts`)

```ts
/**
 * Narrow event-type taxonomy used by the timeline. Each kind is paired with
 * a downstream surface route in EVENT_ROUTE_MAP (§5 below). Adding a new
 * kind requires a matching entry in that map; the routing-map unit test
 * enforces the invariant.
 */
export type DashboardEventKind =
  | 'meeting'    // bi-weekly / intro / close-out meetings → /meeting
  | 'earnings'  // earnings call, analyst day → /diagnostic (F1 signals)
  | 'email'     // inbound / outbound email → /continuity
  | 'memo'      // CEO memo, internal doc → /diagnostic
  | 'project'   // project start / milestone → /diagnostic
  | 'signal';   // external signal / news → /continuity

export type DashboardTimelineEvent = {
  id: string;               // stable slug ("evt-q3-earnings")
  t: string;                // display timestamp ("Apr 14")
  kind: DashboardEventKind;
  label: string;            // headline ("Q3 FY25 Earnings Call · transcript ingested")
  sub?: string;             // subheadline / tags
  route: 'recall' | 'diagnostic' | 'continuity' | 'meeting';  // explicit override; null-safe default below
};

/**
 * Default routing when event.route is absent. Authoring hint: set `route`
 * explicitly when the semantic mapping differs from the kind default
 * (e.g. a "meeting" entry that should drop the user into /diagnostic rather
 * than /meeting). The explicit field wins.
 */
export const EVENT_ROUTE_MAP: Record<DashboardEventKind, DashboardTimelineEvent['route']> = {
  meeting: 'meeting',
  earnings: 'diagnostic',
  email: 'continuity',
  memo: 'diagnostic',
  project: 'diagnostic',
  signal: 'continuity',
} as const;

export type ReloadTimelineSlot = {
  delay: number;            // ms after orchestration start
  panel: 'client_identity'
       | 'relationship_stage'
       | 'interaction_timeline'
       | 'ai_alerts'
       | 'external_signals'
       | 'context_loaded_badge';
};

// Pinned verbatim per tech-design §2.5.
export const RELOAD_TIMELINE: readonly ReloadTimelineSlot[] = Object.freeze([
  { delay: 0,     panel: 'client_identity' },
  { delay: 5000,  panel: 'relationship_stage' },
  { delay: 12000, panel: 'interaction_timeline' },
  { delay: 18000, panel: 'ai_alerts' },
  { delay: 23000, panel: 'external_signals' },
  { delay: 28000, panel: 'context_loaded_badge' },
]);
```

### 3.2 `DashboardFixture` (`fixtures/dashboard_fixtures/dashboard.json`)

```ts
export type DashboardAlert = {
  id: string;
  kind: 'retainer_renewal_risk' | 'exec_email_overdue' | 'pre_rfp_signal' | 'prospect_cooling';
  severity: 'high' | 'borderline';
  text: string;
  source?: string;
};

export type DashboardExternalSignal = {
  id: string;
  t: string;
  headline: string;
  relevance: number;  // 0..1
};

export type DashboardFixture = {
  client: {
    name: string;                // "Acme Industrial" (locked per CLAUDE.md fixture conventions)
    industry: string;            // must be industry-neutral (per PRD §3.7 + CLAUDE.md)
    retainer: string;            // "Retainer · Q2 FY26"
    nextContact: string;
    relationshipStage: 'Signal' | 'Pre-RFP' | 'Retainer' | 'Active Delivery' | 'Renewal';
  };
  stages: readonly ['Signal', 'Pre-RFP', 'Retainer', 'Active Delivery', 'Renewal'];
  timeline: DashboardTimelineEvent[];
  alerts: DashboardAlert[];
  externalSignals: DashboardExternalSignal[];
  contextLoadSec: number;        // always 28 — matches tech-design §2.5 badge copy
};
```

### 3.3 `DataHubFixture` (`fixtures/datahub_fixtures/datahub.json`)

```ts
export type DataHubUpload = {
  id: string;
  name: string;
  size: string;            // display form ("1.2 MB")
  rows: number;
  status: 'tagged' | 'tagging' | 'untagged';
};

export type DataHubCrmRow = {
  id: string;
  name: string;            // Acme Industrial, Globex, Initech, ...
  industry: string;        // industry-neutral
  size: string;
  region: string;
  serviceLine:
    | 'Strategic Transformation'
    | 'IT Transformation'
    | 'Enterprise Innovation'
    | 'Inertia Removal';
  stage: 'Signal' | 'Retainer' | 'Pre-RFP' | 'Renewal' | 'Active Delivery';
  flag?: 'new' | null;
};

export type DataHubFolderFile = {
  icon: string;            // single emoji/char — port from prototype
  name: string;
  meta: string;
};

export type DataHubFixture = {
  uploads: DataHubUpload[];
  crmRows: DataHubCrmRow[];
  acmeFolder: DataHubFolderFile[];   // expanded-row file list (Acme only, for demo)
};
```

### 3.4 `ThesisScreenshot` + `ThesisFixture` (`fixtures/thesis_fixtures/thesis.json`)

```ts
export type ThesisScreenshot = {
  label: 'Before Meeting 1' | 'Before Meeting 2';
  id: 'before_m1' | 'before_m2';
  imagePath: string;                  // "/assets/thesis/before-m1.png" or fallback "/thesis_fixtures/placeholder-before-m1.svg"
  alt: string;                        // accessibility text
  caption?: string;                   // optional sub-caption (e.g. "Diff highlighted in crimson")
};

export type ThesisFixture = {
  screenshots: [ThesisScreenshot, ThesisScreenshot];   // exactly two, ordered [m1, m2]
  defaultId: 'before_m1' | 'before_m2';                // which shows on first mount
};
```

### 3.5 `MeetingStateConfig` (in-file constants on `app/(main)/meeting/MeetingPage.tsx`)

Not a fixture — this is a handful of constants the component uses. Defined alongside the component rather than as a separate data file because it has no content-owner hand-off.

```ts
export type MeetingStateConfig = {
  videoSrc: string;                     // "/assets/fake_zoom.mp4"
  videoFallbackMode: 'css-placeholder'; // fallback type when video missing
  sharedDeckSlide: {
    title: string;                      // "Acme · Bi-weekly · Week 3"
    bullets: string[];                  // 3-5 bullets, demo script locked
    footer: string;                     // "CGS Advisors · Confidential"
  };
  emitStartOnMount: boolean;            // true — fires meeting:start on route enter
  emitEndOnUnmount: boolean;            // true — fires meeting:end on route leave
  clientId: string;                     // "acme"
};
```

The `sharedDeckSlide` body is tech-design §2.6 "demo 全程不翻页，演示者口述" — a **single** slide, never advanced. Authored as constants so a content-owner tweak is a one-line diff.

---

## 4. Per-item plans

### 4.1 Dashboard (§5) — NEW FULL IMPLEMENTATION

- **Files**: `app/(main)/dashboard/page.tsx`, `DashboardPage.tsx`, `ClientSwitcher.tsx`, `RelationshipStage.tsx`, `ContextLoadBanner.tsx`, `InteractionTimeline.tsx`, `AlertsCard.tsx`, `ExternalSignals.tsx`, `useDashboardOrchestration.ts`, `dashboard-timeline.ts`, `dashboard.json`, `dashboard.schema.json`; tests `DashboardPage.test.tsx`, `useDashboardOrchestration.test.tsx`, `dashboard-timeline.test.ts`, `routing-map.test.ts`.
- **Fixture dependency**: `fixtures/dashboard_fixtures/dashboard.json` — shipped with engineering deliverable as a skeletal Acme instance with industry-neutral copy. Content owner (§3.A) may overwrite later without code change. No 3.A block.
- **Architectural translation**: prototype `DashboardPage.jsx` uses `window.DASHBOARD` + `window.DATA_HUB` globals + inline styles. Port swaps to static JSON import + `className` + `globals.css` rules under a new `/* §4.1 dashboard */` banner using the existing token palette (`--navy`, `--paper`, `--crimson`, `--sage`, `--gold`). No new tokens.
- **Correctness callouts**:
  - **Orchestration timing**: `RELOAD_TIMELINE` drives `setTimeout` chain. Each slot schedules a single `setState` flip on `visiblePanels.add(slot.panel)`. Fade-in CSS class (`panel-fade-in`, 300 ms cubic-bezier) applied via `className` toggle — CSS animation, not JS animation (perf on Windows GPU per §9.4).
  - **Timer cleanup**: `useRef<Set<ReturnType<typeof setTimeout>>>` stores all pending handles; `useEffect` cleanup iterates + `clearTimeout` to prevent `setState on unmounted` React warnings during StrictMode double-mount (dev) or actual navigation-away.
  - **Real-time ms clock**: top-right corner renders `performance.now() - orchestrationStartRef.current` formatted to `MM:SS.mmm` via a 16 ms `setInterval` (one interval, cleaned up on unmount). This is the "演示者直接念屏幕数字" clock per tech-design §2.5. `MM:SS` updates every frame visually but stays stable across fast-paint frames (no jitter from re-render battle).
  - **Route dispatcher**: `onTimelineClick(event)` resolves target via `event.route ?? EVENT_ROUTE_MAP[event.kind]`, then `router.push('/' + route)` using `next/navigation`'s `useRouter`. **Guard**: Tauri shell uses `app/` static export — `router.push` is client-side only. Verified by existing Phase 1 `/preflight` → `/dashboard` navigation in `boot-effects.tsx`.
  - **StrictMode double-effect**: in dev, React runs effects twice. The orchestration hook must be idempotent on second mount — scheduled timers must be keyed to the mount epoch, and the first cleanup must clear them before the second mount fires a fresh schedule. Test `useDashboardOrchestration.test.tsx` verifies via `rerender` that double-mount produces one ordered reveal, not two overlapping sequences.
  - **Acme-only narrative**: `ClientSwitcher` renders all CRM rows from `datahub.json` but Acme is hard-highlighted as "active"; other clients render as static chips (click = no-op for demo). Do NOT wire real client switching — `current_client` store write only happens via Meeting navigation (Phase 1 pattern) and we do not want to accidentally un-warm Seg 3 cache mid-demo.
- **Acceptance criteria**:
  - Loading `/dashboard/` shows the header + ClientSwitcher chip row immediately; remaining panels fade in at 0 / 5 / 12 / 18 / 23 / 28 s (read against CSS, do not screenshot).
  - Top-right ms timer advances continuously; resets to `00:00.000` on route re-entry.
  - Click the first timeline item (a "meeting" kind) → main window navigates to `/meeting/` (and Recall floating panel shows via Phase 2A lifecycle).
  - Click a "signal" kind → navigates to `/continuity/`.
  - Navigate away mid-orchestration: no console warnings, all timers cancelled.
  - `<em>— Phase 4.1 will fill this</em>` placeholder text no longer present.

### 4.2 Diagnostic (§2) — FIXTURE WIRE-UP (mostly Phase 2B done)

- **Files**: `app/(main)/diagnostic/DiagnosticPage.tsx` (MODIFIED), `lib/override/dims.ts` (unchanged — Phase 2C reconciled); read-only consumers of `fixtures/diagnostic_fixtures/f1.json` / `f2.json` / `f3.json` / `f4.json` / `f5.json`; new CSS keyframes under `/* §4.2 wheel coloring sweep */` banner in `globals.css`.
- **Fixture dependency**: blocks on Phase 3.2 `gen-diagnostic-fixtures.ts` producing the F1-F5 JSON (Phase 3 content gate). Phase 4.2 ships with **fallback**: if any of `f1..f5.json` is missing, the Diagnostic page renders the Phase 2B baseline (`initial_hypotheses.json` only) with a dev-only toast `"F1-F5 fixtures not generated; run pnpm gen:diagnostic-fixtures"`. Acceptance goes through whether or not content owner ships 3.A; avoids Phase 4.2 being content-blocked.
- **Correctness callouts**:
  - **F1 sentence highlights**: each `DiagnosticF1.signals[]` renders one highlighted quote line under the three doc panels (`DiagnosticDocs.tsx` from Phase 2B). Visual wiring: the existing `DiagnosticDocs.tsx` renders `memo.json` / `org.json` / `call.json` doc text; new F1 overlay adds per-quote absolute-positioned underline using the `source_id` to locate which doc panel contains the quote. Character-offset math is NOT computed (we do not parse long-form doc text for regex matches) — instead, each F1 signal carries the doc panel id via `source_id` prefix convention (e.g. `acme-memo-p2` → memo panel) and the overlay highlights the **whole quote block** in the doc's `<pre>` region via `text-decoration: underline wavy`.
  - **F2 Wheel by-sector coloring animation**: `DiagnosticF2.color_sequence[]` drives a staggered 400 ms-per-sector CSS fill-color transition. The existing Phase 2B `StrategyWheel.tsx` already applies fill colors per score; Phase 4.2 adds a "first-paint reveal" mode where each sector starts at neutral gray and animates to its F2-assigned color in sequence. One new CSS class `wheel-sector-initial-reveal` with `transition-delay: calc(var(--seq-idx) * 400ms)`. Sequence index is a CSS custom property set inline per sector.
  - **F6 Override unchanged**: the Phase 2B `useOverrideSession` hook + `override-chain.ts` pipeline remain the single source of truth. Phase 4.2 does NOT touch override code. Only adds a one-time "wheel reveal animation fires once per route entry" gate so the reveal doesn't replay every time the user clicks a sector.
  - **F3/F4/F5 rendering**: F3 hypotheses feed `HypothesisCard.tsx` (Phase 2B). F4 interventions render as a new subsection below hypotheses (static cards, one per intervention, linked hypothesis shown as a tag). F5 interview questions render as a collapsed-by-default `<details>` block (`/** §4.2 F5 question menu */` CSS) so they don't hijack initial visual weight.
- **Acceptance criteria**:
  - With F1-F5 fixtures present, Diagnostic page loads + Wheel runs the 7-sector reveal animation once within ~2.8 s (7 × 400 ms stagger) on first mount.
  - With F1-F5 fixtures missing, page renders Phase 2B baseline; dev-mode warning logged once.
  - F6 Override path still cache-hits Strategic Innovation × high in <2 s (no regression).
  - `pnpm test:phase-2b` and `pnpm test:unit` on `DiagnosticPage.test.tsx` remain green (regression gate).

### 4.3 Continuity (§6) — E1 / E4 / E5 FIXTURE RENDERS (E2 / E3 done)

- **Files**: `app/(main)/continuity/ContinuityPage.tsx` (MODIFIED — replaces the "E1 / E4 / E5 · Phase 4.3 placeholders" tag with real subsections); new components `E1BaselineCard.tsx`, `E4ReplyExtractor.tsx`, `E5EscalationCard.tsx` under `app/(main)/continuity/`; reads `fixtures/continuity_fixtures/` new files below.
- **Fixture dependency**: blocks on §3.A content-owner delivering E4 / E5 fixtures (reply bodies + friction classifications) and E1 delivering a Close-Out Baseline summary. Phase 4.3 ships with **skeletal fixtures** under `fixtures/continuity_fixtures/e1-baseline.json` / `e4-replies.json` / `e5-escalations.json` that satisfy schemas and render legible demo-quality content out of the box.
- **Correctness callouts**:
  - **E1 reads Phase 3.2 diagnostic fixture**: reuses `fixtures/diagnostic_fixtures/f2.json` (wheel scores) + `f3.json` (hypotheses) for the baseline summary — so a content-owner update to F-files flows through. If those aren't generated, falls back to hardcoded Phase 2B `initial_hypotheses.json`.
  - **E4 fixture shape** mirrors PRD §6.3:
    ```ts
    type E4Reply = {
      id: string;
      from: string;
      subject: string;
      body: string;
      extracted: {
        strategy_wheel_shifts: { dim: string; direction: 'up' | 'down' | 'flat' }[];
        inertia_shift: 'dominant_logic' | 'structural' | 'none';
        external_coupling: string | null;
      };
      friction_type: 'dominant_logic' | 'structural' | 'external_coupling' | null;
    };
    ```
  - **E5 escalation**: E4 fixtures with non-null `friction_type` feed into an E5 escalation card (one card per triggered friction). Renders baseline-vs-reply diff, friction classification, and a **preset engagement menu** (hardcoded list — Fellow-picks-from-menu is a UI illusion; no real wiring to a backend). Click on a menu item toggles a `selected` visual state; no actual action.
  - **No validator wiring on E4/E5**: Tone Guard only runs on outbound emails (E2). Inbound client replies are not validated.
- **Acceptance criteria**:
  - `/continuity/` route renders E1 baseline section + 2 E4 reply cards + 1+ E5 escalation card. Placeholder tag "E1 / E4 / E5 · Phase 4.3 placeholders" gone.
  - E4 fixtures present but E5 fixtures empty: E5 section renders "No escalations — all replies within baseline" empty-state copy.
  - Phase 2C tests (`ContinuityPage.test.tsx` + `ToneGuardPaste.test.tsx`) remain green (regression gate).

### 4.4 Data Hub (§7) — NEW FULL IMPLEMENTATION + PUSH ANIMATION

- **Files**: `app/(main)/datahub/page.tsx`, `DataHubPage.tsx`, `UploadsCard.tsx`, `ClientTagTable.tsx`, `ClientFolder.tsx`, `DistributeStrip.tsx`, `useDistributeAnimation.ts`, `datahub.json`, `datahub.schema.json`, `DistributeStrip.test.tsx`.
- **Fixture dependency**: `fixtures/datahub_fixtures/datahub.json` — shipped with skeletal Acme-centric data (one expandable Acme row with ~6 files, 3-5 additional client rows with industry-neutral labels).
- **Correctness callouts**:
  - **F1-F3 static display**: pure presentational port of the prototype's three upper sections. `serviceLine` values from §7.2 are constrained to the 4 CGS service-line labels (enforced by TS literal union in `DataHubCrmRow.serviceLine`).
  - **F5-F8 push animation**: pinned spec: 4 downstream surface indicator lights in a horizontal strip (Dashboard · Collective Brain · Diagnostic · Meeting Recall, per PRD §7 F5/F6/F7/F8). Each light is a 12 px dot with a glow ring. Click the "Push" button in `DistributeStrip`:
    1. Button flashes crimson border.
    2. Light 1 activates at 0 ms (`opacity 0 → 1`, 300 ms ease-out, glow ring scales from 0 → 1.2 → 1 in 400 ms).
    3. Light 2 activates at 400 ms.
    4. Light 3 at 800 ms.
    5. Light 4 at 1200 ms.
    6. Strip header text "Distributing…" → "Connected · 4 sources" at 1600 ms.
    7. Press Push again → repeats the animation (no cooldown). Test case covers double-press idempotency.
  - **Animation uses CSS keyframes via a `data-active="N"` attribute on the strip**, not JS `setTimeout` per light. Each light's CSS `animation-delay` is derived from its index: `animation-delay: calc(var(--idx) * 400ms)`. JS only flips the attribute; CSS drives timing. Rationale: keeps the animation GPU-accelerated on Windows (§9.4) and self-resets on attribute flip.
  - **No real push**: this is pure visual theatre per PRD §7.5 "分发动画 - 一键 push → 下游 surface 指示灯依次亮起". No `lib/store` write, no event emit, no router navigation. Consistent with tech-design §1.1 "§7 Data Hub F5-F8 push 分发 CSS 动画".
- **Acceptance criteria**:
  - `/datahub/` route renders uploads + tagged table + Acme expanded folder + Push strip with 4 dim lights.
  - Click Push → lights activate at 0 / 400 / 800 / 1200 ms in sequence; strip header text updates at 1600 ms.
  - Click Push again → animation restarts from dim state.
  - `<em>— Phase 4.4 will fill this</em>` placeholder gone.

### 4.5 Meeting state CSS split — NEW

- **Files**: `app/(main)/meeting/page.tsx`, `MeetingPage.tsx`, `FakeZoomPane.tsx`, `SharedDeckPane.tsx`, `MeetingPage.test.tsx`; new CSS under `/* §4.5 meeting split */` banner.
- **Fixture dependency**: `public/assets/fake_zoom.mp4` is a content-owner deliverable (§3.A per tech-design §2.6). **Fallback path**: if the file is missing (HEAD returns 404 or the `<video>` element fires `error`), `FakeZoomPane` swaps to a CSS-only placeholder — navy rectangle with a centered `● LIVE · Zoom · Recording` label + a faint pulsing dot animation. Fallback is automatic; no code path requires the file to exist.
- **Correctness callouts**:
  - **`meeting:start` emit on route enter**: preserves the existing Phase 1 stub's effect verbatim — `useEffect` on mount writes `meeting_state = 'in_meeting'`, `set('current_client', 'acme')`, emits `meeting:start` with `{ client_id: 'acme' }`. On unmount: `meeting_state = 'post_meeting'`, emit `meeting:end`. This is the same lifecycle Phase 2A's `useRecallLifecycle` listens to — no new event plumbing.
  - **Race with `meeting:start` emit**: React 18 StrictMode double-mounts in dev. The Phase 1 stub already uses a `cancelled` flag pattern to avoid double-emit; Phase 4.5 preserves that. Additionally — each `meeting:start` resets `userDismissed = false` in the recall panel (Phase 2A §5.8 rule), so a dev-double-mount sends two events 0-2 ms apart; both are idempotent from the recall side. No mitigation needed beyond the existing flag.
  - **Video autoplay policies**: `<video autoPlay muted loop playsInline src="/assets/fake_zoom.mp4">` — `muted` is non-negotiable (Chromium blocks audible autoplay in webviews without a user gesture). Phase 4.5 audio is empty anyway per tech-design §2.6 ("无音"). Add a `poster` attribute pointing to a first-frame-style static SVG in `public/assets/zoom-poster.svg` to avoid flash-of-black between DOM mount and first decoded frame.
  - **Fallback triggers**: attach `onError={() => setFallback(true)}` + `onCanPlay={() => setFallback(false)}` on the `<video>` element. Initial state checks via `fetch('/assets/fake_zoom.mp4', { method: 'HEAD' })` inside `useEffect` to pre-flag missing. Fallback in both cases renders the CSS placeholder.
  - **Sidebar collapse on meeting state**: Phase 1 `(main)/layout.tsx` sidebar already has a `data-collapsed` attribute tied to `meeting_state`. Verify (do not re-implement) — the existing sidebar collapse on `meeting_state === 'in_meeting'` should continue to work. If regression observed, document in bug backlog, don't patch here.
  - **SharedDeckPane**: renders a single `<article>` with title / bullets / footer, styled as a faux slide (16:9 aspect, border, drop shadow). No paging, no animations.
- **Acceptance criteria**:
  - Navigate to `/meeting/` → left pane plays the video loop (or CSS fallback if absent); right pane shows static slide.
  - Recall floating panel shows alongside (Phase 2A lifecycle picks up `meeting:start`).
  - Navigate away → video pauses (React unmount); `meeting:end` emitted; Recall panel hides.
  - With `fake_zoom.mp4` deleted from `public/assets/` → reload `/meeting/` → fallback placeholder renders + no console errors.
  - Phase 1 + Phase 2A lifecycle tests still green.

### 4.6 Thesis Memory toggle — NEW

- **Files**: `app/(main)/dashboard/ThesisMemoryToggle.tsx`, `ThesisMemoryToggle.test.tsx`, `fixtures/thesis_fixtures/thesis.json`, two fallback SVG files in the same dir. Component is mounted inside `DashboardPage.tsx` (after External Signals card) — dedicated surface NOT created, per impl-plan §4.6 "added somewhere (Dashboard or dedicated surface)".
- **Fixture dependency**: `public/assets/thesis/before-m1.png` + `before-m2.png` are content-owner deliverables (§3.A). **Fallback**: if PNG files missing, the component uses the committed SVG placeholders (`fixtures/thesis_fixtures/placeholder-before-m1.svg` / `before-m2.svg`) — simple 16:9 rectangles with labelled blocks visually conveying "Dominant Logic / Anchors Cited / Open Contradictions" three-column layout plus crimson/green diff highlights. SVGs ship in the engineering deliverable; PNGs swap in when content arrives.
- **Correctness callouts**:
  - **Implementation choice: single `<img>` swap, not `srcset`**: `srcset` is for responsive image density, not for toggling between conceptually-different images. A single controlled `<img src={...}>` with `currentId` React state + `onClick` toggle is simpler and keeps focus / keyboard behaviour obvious.
  - **Keyboard accessibility**: toggle button is a `<button type="button">` with `aria-pressed={currentId === 'before_m2'}` and `aria-label={\`Showing \${label}; press to switch\`}`. Left/Right arrow keys while the button has focus also swap (wraps `onKeyDown`). Escape clears focus.
  - **Image transition**: `opacity 0 → 1` 250 ms on swap via React state + CSS class. Preload the non-visible image on mount via a hidden `<img>` in a `position: absolute; visibility: hidden` box so the toggle feels instant (no flash-on-decode).
  - **Thesis diff semantics**: this is pure visual comparison per PRD §3.6.3 (b) "展示 Meeting 1 前 / Meeting 2 前两个时间点的真实 diff". Two images is sufficient; no overlay or cross-fade animation beyond the opacity swap.
  - **Dashboard mount position**: below External Signals card, above any later page content. Heading: `"Thesis Memory · Meeting 1 vs Meeting 2"`. Subtitle: `"Before ${label}"`. One-button toggle.
- **Acceptance criteria**:
  - Dashboard renders Thesis Memory section with initial image = Before Meeting 1.
  - Click toggle → image crossfades to Before Meeting 2; button `aria-pressed` flips.
  - Arrow Right / Left keys swap while button focused; unfocused keys are ignored.
  - With PNG files absent, SVG placeholders render; no console errors.
  - Tab order: button is reachable; focus-visible ring per Phase 1 `globals.css` tokens.

---

## 5. Dashboard orchestration detail

### 5.1 `RELOAD_TIMELINE` constant

Exact array — shipped verbatim per tech-design §2.5 (do not re-tune without a PRD sign-off):

```ts
export const RELOAD_TIMELINE: readonly ReloadTimelineSlot[] = Object.freeze([
  { delay: 0,     panel: 'client_identity' },       // F1 — immediate
  { delay: 5000,  panel: 'relationship_stage' },    // F2
  { delay: 12000, panel: 'interaction_timeline' },  // F3
  { delay: 18000, panel: 'ai_alerts' },             // F4
  { delay: 23000, panel: 'external_signals' },      // F5
  { delay: 28000, panel: 'context_loaded_badge' },  // final "Context loaded · 28s" chip
]);
```

### 5.2 Timer machinery

```ts
// app/(main)/dashboard/useDashboardOrchestration.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { RELOAD_TIMELINE, type ReloadTimelineSlot } from './dashboard-timeline';

export type OrchestrationState = {
  visible: Set<ReloadTimelineSlot['panel']>;
  elapsedMs: number;        // drives the top-right ms timer
};

export function useDashboardOrchestration(): OrchestrationState {
  const [visible, setVisible] = useState<Set<ReloadTimelineSlot['panel']>>(() => new Set());
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerHandles = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const startRef = useRef<number>(0);
  const rafHandle = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = performance.now();

    // Schedule reveals
    RELOAD_TIMELINE.forEach(({ delay, panel }) => {
      const h = setTimeout(() => {
        setVisible((prev) => {
          if (prev.has(panel)) return prev;
          const next = new Set(prev);
          next.add(panel);
          return next;
        });
      }, delay);
      timerHandles.current.add(h);
    });

    // Drive the ms timer via requestAnimationFrame (≤16 ms, GPU-synced).
    const tick = () => {
      setElapsedMs(performance.now() - startRef.current);
      rafHandle.current = requestAnimationFrame(tick);
    };
    rafHandle.current = requestAnimationFrame(tick);

    return () => {
      timerHandles.current.forEach(clearTimeout);
      timerHandles.current.clear();
      if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current);
      rafHandle.current = null;
    };
  }, []);

  return { visible, elapsedMs };
}
```

Design choices pinned:
- **`Set` semantics** prevent duplicate additions during StrictMode double-effect.
- **`requestAnimationFrame`**, not `setInterval(16)` — aligns with monitor refresh, no drift, cheaper on idle.
- **No external deps** (no zustand, no immer).

### 5.3 Fade-in CSS class + 300 ms transition

Added to `app/globals.css` under `/* §4.1 dashboard orchestration */`:

```css
.dashboard-panel {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 300ms ease-out, transform 300ms ease-out;
  will-change: opacity, transform;
}
.dashboard-panel[data-visible='1'] {
  opacity: 1;
  transform: translateY(0);
}
.dashboard-timer-chip {
  position: fixed;
  top: 16px;
  right: 20px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--gold);
  letter-spacing: 0.04em;
  z-index: 10;
  pointer-events: none;
}
```

Component-side:

```tsx
<section data-visible={visible.has('client_identity') ? 1 : 0} className="dashboard-panel">…</section>
```

### 5.4 Event-click routing table

```ts
// app/(main)/dashboard/dashboard-timeline.ts (continued)

import type { Router } from 'next/navigation';

export function routeEventToSurface(
  event: DashboardTimelineEvent,
  router: ReturnType<typeof useRouter>
): void {
  const target = event.route ?? EVENT_ROUTE_MAP[event.kind];
  const path = target === 'recall' ? '/meeting' : `/${target}`;
  // 'recall' is the floating panel — jumping to Recall from Dashboard
  // means "enter meeting state which summons the panel". The canonical
  // route is /meeting; the `recall` label is a UX affordance in the
  // timeline kind → surface vocabulary, NOT a router-addressable path.
  router.push(path);
}
```

**Route vocabulary**:
| Event kind | Default surface | Actual route |
|---|---|---|
| `meeting` | Meeting Recall | `/meeting` |
| `earnings` | Diagnostic | `/diagnostic` |
| `email` | Continuity | `/continuity` |
| `memo` | Diagnostic | `/diagnostic` |
| `project` | Diagnostic | `/diagnostic` |
| `signal` | Continuity | `/continuity` |

Test `routing-map.test.ts` asserts every `DashboardEventKind` literal has a `EVENT_ROUTE_MAP` entry (compiler would catch missing keys via `Record<DashboardEventKind, ...>`, but the test also verifies the values resolve to renderable routes to prevent a typo'd `/diangostic`).

---

## 6. Data Hub animation detail

### 6.1 CSS keyframe sequence

Added to `app/globals.css` under `/* §4.4 data hub push animation */`:

```css
.distribute-strip {
  display: flex;
  gap: 24px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--paper);
}
.distribute-strip[data-state='dim'] .distribute-light { opacity: 0.25; }
.distribute-strip[data-state='active'] .distribute-light {
  animation: distribute-light-on 400ms ease-out forwards;
  animation-delay: calc(var(--idx) * 400ms);
}
.distribute-light {
  position: relative;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--sage);
  opacity: 0.25;
}
.distribute-light::after {
  content: '';
  position: absolute; inset: -6px;
  border-radius: 50%;
  border: 2px solid var(--sage);
  opacity: 0;
}
.distribute-strip[data-state='active'] .distribute-light::after {
  animation: distribute-glow 600ms ease-out forwards;
  animation-delay: calc(var(--idx) * 400ms);
}
@keyframes distribute-light-on {
  from { opacity: 0.25; transform: scale(0.8); }
  to   { opacity: 1;    transform: scale(1); }
}
@keyframes distribute-glow {
  0%   { opacity: 0;   transform: scale(0.2); }
  50%  { opacity: 0.6; transform: scale(1.2); }
  100% { opacity: 0;   transform: scale(1); }
}
```

### 6.2 Downstream-surface indicator component

```tsx
// DistributeStrip.tsx
'use client';
import { useState } from 'react';

const DOWNSTREAM = [
  { id: 'dashboard',      label: '§5 Dashboard' },
  { id: 'collective',     label: '§1 Collective Brain' },
  { id: 'diagnostic',     label: '§2 Diagnostic' },
  { id: 'recall',         label: '§3 Meeting Recall' },
] as const;

export function DistributeStrip() {
  const [state, setState] = useState<'dim' | 'active'>('dim');
  const onPush = () => {
    // Flip to dim first to re-trigger the CSS animation if already active
    setState('dim');
    requestAnimationFrame(() => setState('active'));
  };
  return (
    <div className="distribute-strip" data-state={state}>
      <button className="btn primary" onClick={onPush}>Push</button>
      <div style={{ display: 'flex', gap: 32 }}>
        {DOWNSTREAM.map((d, idx) => (
          <div key={d.id} style={{ '--idx': idx } as React.CSSProperties}>
            <span className="distribute-light" />
            <span className="distribute-label">{d.label}</span>
          </div>
        ))}
      </div>
      <span className="distribute-status">
        {state === 'active' ? 'Connected · 4 sources' : 'Idle'}
      </span>
    </div>
  );
}
```

Test `DistributeStrip.test.tsx` uses Vitest fake-timers to advance 1600 ms and asserts `document.querySelectorAll('.distribute-light')` all reach computed `opacity: 1` via a proxy (jsdom does not execute CSS animations; test instead asserts the `data-state` attribute flips correctly on button click + on re-click).

---

## 7. Meeting state detail

### 7.1 Video element

```tsx
// FakeZoomPane.tsx
'use client';
import { useEffect, useState } from 'react';

export function FakeZoomPane() {
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/assets/fake_zoom.mp4', { method: 'HEAD' })
      .then((r) => { if (!cancelled && !r.ok) setFallback(true); })
      .catch(() => { if (!cancelled) setFallback(true); });
    return () => { cancelled = true; };
  }, []);

  if (fallback) {
    return (
      <div className="meeting-zoom-fallback" aria-label="Video placeholder · Zoom recording">
        <span className="live-dot" />
        <span>LIVE · Zoom · Recording</span>
      </div>
    );
  }
  return (
    <video
      className="meeting-zoom-video"
      src="/assets/fake_zoom.mp4"
      poster="/assets/zoom-poster.svg"
      autoPlay muted loop playsInline
      onError={() => setFallback(true)}
    />
  );
}
```

### 7.2 `meeting:start` emit on route enter; `meeting:end` on route leave

Preserves the existing Phase 1 `page.tsx` effect exactly — copied into `MeetingPage.tsx` with the same `cancelled` flag pattern. The existing stub's code is the reference implementation; Phase 4.5 only wraps the layout around it. No new race handling.

```tsx
// MeetingPage.tsx
'use client';
import { useEffect } from 'react';
import { EVENTS, emit } from '@/lib/events';
import { set } from '@/lib/store';
import { FakeZoomPane } from './FakeZoomPane';
import { SharedDeckPane } from './SharedDeckPane';

export function MeetingPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const start = async () => {
      if (cancelled) return;
      await set('current_client', 'acme');
      await set('meeting_state', 'in_meeting');
      await emit(EVENTS.MEETING_START, { client_id: 'acme' });
    };
    void start();
    return () => {
      cancelled = true;
      void (async () => {
        await set('meeting_state', 'post_meeting');
        await emit(EVENTS.MEETING_END, {});
      })();
    };
  }, []);

  return (
    <section className="page meeting-page meeting-split">
      <FakeZoomPane />
      <SharedDeckPane />
    </section>
  );
}
```

CSS split:

```css
.meeting-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: calc(100vh - 80px);
  padding: 0;
}
.meeting-zoom-video,
.meeting-zoom-fallback {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--navy);
}
```

---

## 8. Thesis Memory toggle detail

### 8.1 Single `<img>` swap (not srcset)

```tsx
// app/(main)/dashboard/ThesisMemoryToggle.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import thesisFixture from '@/fixtures/thesis_fixtures/thesis.json';

type ThesisId = 'before_m1' | 'before_m2';

export function ThesisMemoryToggle() {
  const [currentId, setCurrentId] = useState<ThesisId>(thesisFixture.defaultId);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = thesisFixture.screenshots.find((s) => s.id === currentId)!;
  const other = thesisFixture.screenshots.find((s) => s.id !== currentId)!;

  const swap = () => setCurrentId(currentId === 'before_m1' ? 'before_m2' : 'before_m1');

  useEffect(() => {
    // Preload the non-visible image for instant toggle.
    const pre = new Image();
    pre.src = other.imagePath;
  }, [other.imagePath]);

  return (
    <section className="card thesis-memory">
      <div className="card-h">
        <div className="t">Thesis Memory · Meeting 1 vs Meeting 2</div>
        <button
          ref={buttonRef}
          type="button"
          className="btn"
          aria-pressed={currentId === 'before_m2'}
          aria-label={`Showing ${current.label}; press to switch to ${other.label}`}
          onClick={swap}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              swap();
            }
          }}
        >
          Switch to {other.label}
        </button>
      </div>
      <div className="card-b">
        <img
          key={current.id}
          src={current.imagePath}
          alt={current.alt}
          className="thesis-memory-image thesis-memory-image-fade-in"
          onError={(e) => {
            // Swap to SVG placeholder bundled in fixtures if PNG missing.
            const img = e.currentTarget;
            const fallback = current.id === 'before_m1'
              ? '/fixtures/thesis_fixtures/placeholder-before-m1.svg'
              : '/fixtures/thesis_fixtures/placeholder-before-m2.svg';
            if (img.src !== fallback) img.src = fallback;
          }}
        />
        {current.caption && <p className="thesis-memory-caption">{current.caption}</p>}
      </div>
    </section>
  );
}
```

### 8.2 Keyboard accessibility

- Button is a native `<button type="button">` — automatic Tab reachability + Enter/Space activation.
- `aria-pressed` toggles between `false` (m1) and `true` (m2).
- `aria-label` describes current state and next action.
- Arrow Left / Arrow Right keys on focused button swap images (explicit `onKeyDown` handler).
- Escape clears focus via the browser-default behaviour — no code needed.

---

## 9. Risk callouts

### 9.1 Video autoplay policies on Tauri webview

Chromium (WebView2 on Windows) blocks audible autoplay without user gesture. `muted + playsInline` is the documented workaround — combined with `autoPlay`, the browser permits muted playback on page load. Our video has no audio anyway (tech-design §2.6), so this is the correct configuration. Risk: some corporate policies disable `playsInline`; mitigation is the existing fallback path. No Tauri-specific restriction exists beyond the Chromium default.

### 9.2 Fixture dependency on §3.A (content owner)

Phase 4.1 (Dashboard), 4.3 (Continuity E4/E5), 4.5 (fake_zoom.mp4), 4.6 (Thesis screenshots) nominally depend on §3.A content deliveries. Mitigation per each item: ship skeletal JSON + SVG placeholders + CSS video fallback so every route renders a coherent page without any §3.A asset. Content owner ships drop-in replacements later; code paths untouched.

### 9.3 React router navigation in Tauri (no SSR)

Next.js App Router in static-export mode: all `router.push(...)` calls run client-side. Phase 1 already verified `/preflight` → `/dashboard` navigation works inside Tauri. Phase 4.1 adds 3 more navigation surfaces (`/meeting`, `/diagnostic`, `/continuity`) — all already exist as real routes; no new dynamic route segments. No SSR branches, no `getStaticPaths` concerns.

### 9.4 CSS animation performance on Windows GPU

Known gotcha: WebView2 on low-spec integrated GPUs can jank on simultaneous `opacity + transform` on many elements. Mitigation:
- Phase 4.1 Dashboard: only 6 fade-ins, staggered 5+ seconds apart, each on a large container — not a concern.
- Phase 4.4 Data Hub: 4 lights with staggered 400 ms animations, each one ~600 ms total — 4 concurrent at peak, all tiny DOM; not a concern.
- Phase 4.6 Thesis swap: single element opacity crossfade; not a concern.
- Wheel 7-sector reveal (4.2): 7 SVG fills interpolating simultaneously for up to 2.8 s. `fill` is GPU-accelerated in Chromium ≥85. If jank observed on a specific demo machine, reduce to 3-sector groups via a `--reveal-group` custom property. Include this as a last-resort CSS-only mitigation — no JS change.

### 9.5 StrictMode double-mount corrupting orchestration

React 18 dev mode double-mounts every effect. The orchestration hook's cleanup (§5.2) must run between the first and second mount to cancel the first batch of setTimeouts. Verified by `useDashboardOrchestration.test.tsx` via `rerender` + fake timers. Production builds don't double-mount; risk is dev-only but the test pins the behaviour.

### 9.6 Meeting page `meeting:start` emit race with navigation clicks

Rapidly clicking a timeline item that routes to `/meeting` while Dashboard orchestration is still running can fire two `setState` updates in the same React tick. The route transition drops the Dashboard tree cleanly (timers cancelled on unmount per §5.2) and Meeting's `useEffect` fires its own `meeting:start`. Recall panel is idempotent on repeat `meeting:start` (Phase 2A §5.8) so no Fix needed.

### 9.7 Next.js static export + dynamic `<img>` fallback

`onError` handler swaps `img.src` to a local SVG path. In static export, `fixtures/thesis_fixtures/placeholder-*.svg` are NOT served by Next.js automatically (only files in `public/` are). **Fix**: copy the two placeholder SVG files into `public/assets/thesis/placeholder-*.svg` and reference those paths. Adjusting §2 directory deltas: SVG fallbacks live in `public/assets/thesis/`, not `fixtures/thesis_fixtures/`. Correction pinned here to pre-empt the implementation error.

### 9.8 Fixture schema validation in Phase 3 pipeline

New `dashboard.json` / `datahub.json` / `thesis.json` schemas must be added to `scripts/test-phase-0.js` ajv sweep. Without this, schema drift silently ships. Script extension is one-line per schema.

### 9.9 Industry neutrality enforcement

CLAUDE.md pin: Acme Industrial is industry-neutral; fixture text must avoid sector-specific terms. Phase 4.1 Dashboard alerts + external signals + timeline labels are demo-visible copy — all must be neutral. Plan states this as a content rule; no code gate. Manual review on fixture authoring is the mitigation.

### 9.10 Methodology tag alignment (demo red line per PRD §3.5.3)

Any CGS methodology tags rendered on Dashboard (alerts) / Data Hub (service lines) / Thesis screenshots must be 100% aligned with `lib/methodology/tags.ts` canonical vocabulary. `serviceLine` is constrained by TypeScript literal types. Alert `kind` values in `dashboard.json` don't overlap CGS tags but any alert `text` or `source` that cites methodology must use canonical labels — reviewer check during content authoring (no runtime validator for Dashboard fixture body copy since Tone Guard is scoped to outbound emails).

---

## 10. Order of implementation (numbered DAG)

Items 1-3 are shared scaffolding; 4-10 are per-surface implementations that can run in parallel pairs; 11-13 are integration and test sweep.

1. **Write `fixtures/*.schema.json`** for Dashboard / Data Hub / Thesis. Extend `scripts/test-phase-0.js` ajv sweep to include them. Validates against empty skeleton → green.
2. **Author skeletal fixtures**: `dashboard.json`, `datahub.json`, `thesis.json`, `e1-baseline.json`, `e4-replies.json`, `e5-escalations.json`. Industry-neutral copy; Acme + Globex + Initech; ≥3 timeline events; ≥2 alerts; ≥4 CRM rows; 2 Thesis screenshots. Copy `placeholder-before-m1.svg` + `placeholder-before-m2.svg` into `public/assets/thesis/` (per §9.7 correction).
3. **Write `app/(main)/dashboard/dashboard-timeline.ts`** — constants + routing helpers. Write `dashboard-timeline.test.ts` + `routing-map.test.ts`. Gate: both green.
4. **Write `app/(main)/dashboard/useDashboardOrchestration.ts`** + test. Fake-timers sweep; unmount cancellation; StrictMode double-mount.
5. **Port Dashboard UI components**: `ClientSwitcher`, `RelationshipStage`, `InteractionTimeline`, `AlertsCard`, `ExternalSignals`, `ContextLoadBanner`. Presentational; no timer logic. Add CSS under `/* §4.1 dashboard */`.
6. **Assemble `DashboardPage.tsx`** — wires the hook + components + routing; runs the orchestration. Write `DashboardPage.test.tsx`.
7. **Write `ThesisMemoryToggle.tsx`** + test. Mount inside `DashboardPage.tsx` below External Signals.
8. **Port Data Hub UI**: `UploadsCard`, `ClientTagTable`, `ClientFolder`. Presentational.
9. **Write `DistributeStrip.tsx` + `useDistributeAnimation.ts`** — CSS-driven via `data-state` attribute. Write test.
10. **Assemble `DataHubPage.tsx`** — wires components + datahub fixture.
11. **Port Meeting UI**: `FakeZoomPane.tsx` (with HEAD-check fallback), `SharedDeckPane.tsx`, assemble `MeetingPage.tsx` (copies Phase 1 stub effect verbatim). Write `MeetingPage.test.tsx`.
12. **Wire Diagnostic F1-F5 fixture reads**: `DiagnosticPage.tsx` modifications — conditional fixture load, graceful fallback to Phase 2B baseline. Wheel reveal animation CSS + sequence index assignment.
13. **Wire Continuity E1 / E4 / E5**: new `E1BaselineCard.tsx` / `E4ReplyExtractor.tsx` / `E5EscalationCard.tsx`; remove "Phase 4.3 placeholders" tag from `ContinuityPage.tsx`; mount below existing E2 + E3 blocks.
14. **Rewrite `app/(main)/dashboard/page.tsx`** / `datahub/page.tsx` / `meeting/page.tsx` to mount containers. Gates: each page's `<em>— Phase 4.X will fill this</em>` text is deleted.
15. **Run full test sweep**: `pnpm test:unit` (expect 657 + ~20-25 new tests), `pnpm test:phase-0` (schema sweep), `pnpm typecheck`, `pnpm lint`, `pnpm build` (static export succeeds).
16. **Manual Tauri smoke** — §12 exit-gate checklist.

Items 3–7 and 8–10 and 11 can run in parallel by separate implementers once item 2 lands. Item 12 depends on Phase 3.2 fixtures OR its fallback path. Item 13 depends on item 2 content. Item 14 is a cleanup sweep after all surfaces build.

---

## 11. Test strategy

### 11.1 Unit tests (Vitest)

| File | What it asserts |
|---|---|
| `app/(main)/dashboard/dashboard-timeline.test.ts` | `RELOAD_TIMELINE` has 6 entries in the correct order + timing; `EVENT_ROUTE_MAP` has every `DashboardEventKind` key |
| `tests/unit/routing-map.test.ts` | `routeEventToSurface(event, mockRouter)` calls `router.push('/...')` with the correct path for every kind; explicit `event.route` overrides the map |
| `app/(main)/dashboard/useDashboardOrchestration.test.tsx` | fake-timers: 0 ms visible set = {client_identity}; 5001 ms visible = {client_identity, relationship_stage}; etc.; unmount mid-schedule → no `setState on unmounted` warning (spy on console.error); StrictMode double-mount → ordered reveal unchanged |
| `app/(main)/dashboard/DashboardPage.test.tsx` (jsdom) | renders ClientSwitcher + header immediately; 6 panels exist in DOM; `data-visible` flips per timeline; timeline item click with `kind: 'meeting'` triggers router mock with `/meeting` |
| `app/(main)/dashboard/ThesisMemoryToggle.test.tsx` (jsdom) | initial img src === fixture.defaultId.imagePath; click button → img src swaps; aria-pressed flips; ArrowRight on focused button swaps; onError swaps to placeholder SVG path |
| `app/(main)/datahub/DistributeStrip.test.tsx` (jsdom) | initial `data-state='dim'`; click Push → `data-state='active'` via rAF; click again → dim then active (animation re-trigger); strip status text toggles |
| `app/(main)/meeting/MeetingPage.test.tsx` (jsdom) | on mount: `store.set('meeting_state', 'in_meeting')` + `emit('meeting:start', ...)` called; on unmount: `meeting:end` called; with `fetch` mocked 404, fallback div renders instead of `<video>`; with fetch OK, `<video>` renders with correct attrs (muted, loop, autoPlay, playsInline) |

### 11.2 Integration (jsdom)

No additional integration suite beyond per-page `*.test.tsx`. The Phase 2B/2C `DiagnosticPage.test.tsx` + `ContinuityPage.test.tsx` stay unchanged as regression gates — Phase 4.2 / 4.3 modifications must not break them.

### 11.3 E2E (Playwright)

**Explicitly out of scope** per impl-plan §测试策略 and consistent with Phases 2A–2D. Tauri shell does not run in Playwright; manual smoke is the exit-gate path for the full meeting-state → recall-panel coupling.

### 11.4 Schema validation

`scripts/test-phase-0.js` extended to ajv-validate the three new JSON Schemas. Per-fixture (dashboard/datahub/thesis) content is validated at load time via TypeScript (literal unions). Runtime ajv pass is the belt-and-suspenders for content-owner edits.

### 11.5 Regression gate

All prior 657 tests must stay green. New tests estimated at +20-25. Final count target ≈ 680.

---

## 12. Exit gate

Phase 4 is done when **every** box below is checked:

- [ ] `pnpm typecheck` exits 0 (includes all new `.tsx` + `.ts` under `app/(main)/*` + `fixtures/*`).
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm build` produces `out/dashboard/index.html`, `out/datahub/index.html`, `out/meeting/index.html`, `out/diagnostic/index.html`, `out/continuity/index.html` (all 5 main routes + existing `/preflight` + floating `/recall-panel`).
- [ ] `pnpm test:unit` passes; all new Phase 4 tests (dashboard-timeline, routing-map, useDashboardOrchestration, DashboardPage, ThesisMemoryToggle, DistributeStrip, MeetingPage) green.
- [ ] **Regression gate**: all prior 657 tests green; total count ≥ 677.
- [ ] `pnpm test:phase-0` validates new `dashboard.schema.json` / `datahub.schema.json` / `thesis.schema.json` against their fixtures.
- [ ] **No placeholder text**: grep `grep -r "Phase 4" app/(main)/` returns zero hits inside page render output (`.tsx` render bodies); `<em>— Phase 4.X will fill this</em>` text removed from every surface.
- [ ] **All 5 main routes render live** (manual Tauri smoke):
  - [ ] `/dashboard/` → ClientSwitcher + 30 s orchestration fires; top-right ms timer updates; timeline click navigates correctly for each kind.
  - [ ] `/diagnostic/` → Wheel 7-sector reveal animation fires; F1 signals highlight doc quotes; F3/F4/F5 populated (fixtures present) or baseline fallback (fixtures missing); F6 Override still cache-hits.
  - [ ] `/continuity/` → E1 baseline + E2 emails + E3 paste + E4 replies + E5 escalations all render; no "placeholder" tag.
  - [ ] `/datahub/` → uploads + CRM table + Acme folder + Push strip; click Push → 4 lights activate in sequence.
  - [ ] `/meeting/` → split layout; left pane plays video OR CSS fallback; right pane shows single static slide; Recall floating panel shows via `meeting:start` lifecycle; navigating away hides Recall.
- [ ] **Thesis toggle accessibility**: button reachable by Tab; Enter/Space activates; aria-pressed flips; Arrow Left/Right swaps; Escape clears focus.
- [ ] **Fallback paths work**: delete `public/assets/fake_zoom.mp4` → meeting page renders CSS placeholder; delete `public/assets/thesis/*.png` → SVG placeholders render.
- [ ] **Content-owner fixture gap**: real F1-F5 fixtures from Phase 3.2 flagged as **out-of-scope for Phase 4** — fallback path verified to render without them; reminders sent to content owner for `fake_zoom.mp4` + Thesis PNGs + real Dashboard/DataHub/Continuity content bodies.
- [ ] **Industry-neutral check**: every fixture body scanned for `same-store sales`, `production line`, `unit economics`, sector-specific SKU terms — zero hits (greppable manual check).
- [ ] **Methodology alignment check**: any CGS tag rendered on dashboard / datahub / thesis UI is a canonical from `lib/methodology/tags.ts`.
- [ ] This plan `docs/phase-plans/phase-4-plan.md` committed.

When all boxes are green: **Phase 4 ships → impl-plan Phase 0 → Phase 4 is complete → demo build done**. Post-Phase-4 work is content (§3.A), rehearsal, and the Phase 1 build-completion checklist at impl-plan §Build 完成标志 (visual alignment against artboards + LLM cache read assertion + retry toast smoke + Tone Guard verdict smoke — all of which are covered by existing Phase 2A–2C test paths plus this phase's exit gate).
