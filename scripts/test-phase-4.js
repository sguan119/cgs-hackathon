#!/usr/bin/env node
// Phase 4 smoke tests — structural checks on the fake-surface port.
// Run: node scripts/test-phase-4.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pass = [];
const fail = [];

function ok(name) {
  pass.push(name);
  console.log(`  PASS  ${name}`);
}
function ko(name, reason) {
  fail.push(name);
  console.error(`  FAIL  ${name}\n        ${reason}`);
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

console.log('\n--- 4.x  Phase 4 structural smoke ---');

// 4.A — new fixtures + schemas present.
const REQUIRED_FILES = [
  'fixtures/dashboard_fixtures/dashboard.json',
  'fixtures/dashboard_fixtures/dashboard.schema.json',
  'fixtures/datahub_fixtures/datahub.json',
  'fixtures/datahub_fixtures/datahub.schema.json',
  'fixtures/thesis_fixtures/thesis.json',
  'fixtures/thesis_fixtures/thesis.schema.json',
  'fixtures/continuity_fixtures/e1.json',
  'fixtures/continuity_fixtures/e4.json',
  'fixtures/continuity_fixtures/e5.json',
  'public/assets/thesis/placeholder-before-m1.svg',
  'public/assets/thesis/placeholder-before-m2.svg',
  'public/assets/zoom-poster.svg',
  'lib/dashboard/dashboard-timeline.ts',
  'app/(main)/dashboard/DashboardPage.tsx',
  'app/(main)/dashboard/ClientSwitcher.tsx',
  'app/(main)/dashboard/RelationshipStage.tsx',
  'app/(main)/dashboard/InteractionTimeline.tsx',
  'app/(main)/dashboard/AlertsCard.tsx',
  'app/(main)/dashboard/ExternalSignals.tsx',
  'app/(main)/dashboard/ContextLoadBanner.tsx',
  'app/(main)/dashboard/ThesisMemoryToggle.tsx',
  'app/(main)/dashboard/hooks/useDashboardOrchestration.ts',
  'app/(main)/datahub/DataHubPage.tsx',
  'app/(main)/datahub/UploadsCard.tsx',
  'app/(main)/datahub/ClientTagTable.tsx',
  'app/(main)/datahub/ClientFolder.tsx',
  'app/(main)/datahub/DistributeStrip.tsx',
  'app/(main)/datahub/useDistributeAnimation.ts',
  'app/(main)/meeting/MeetingPage.tsx',
  'app/(main)/meeting/FakeZoomPane.tsx',
  'app/(main)/meeting/SharedDeckPane.tsx',
  'app/(main)/continuity/E1BaselineCard.tsx',
  'app/(main)/continuity/E4ReplyExtractor.tsx',
  'app/(main)/continuity/E5EscalationCard.tsx',
];

for (const rel of REQUIRED_FILES) {
  if (exists(rel)) ok(`exists · ${rel}`);
  else ko(`exists · ${rel}`, 'file missing');
}

// 4.B — page stubs no longer carry the Phase 4 placeholder text.
const STUBS = [
  'app/(main)/dashboard/page.tsx',
  'app/(main)/datahub/page.tsx',
  'app/(main)/meeting/page.tsx',
];
for (const rel of STUBS) {
  const src = readText(rel);
  if (/Phase 4\.[0-9]+/i.test(src)) {
    ko(`${rel} free of 'Phase 4.X will fill this' tag`, src);
  } else {
    ok(`${rel} free of Phase 4 placeholder tag`);
  }
}

// Continuity placeholder line removed.
const cont = readText('app/(main)/continuity/ContinuityPage.tsx');
if (/Phase 4\.3 placeholders?/i.test(cont)) {
  ko('ContinuityPage.tsx free of Phase 4.3 placeholders tag', 'tag still present');
} else {
  ok('ContinuityPage.tsx free of Phase 4.3 placeholders tag');
}

// 4.C — RELOAD_TIMELINE has the six slots at the pinned delays.
const tlSrc = readText('lib/dashboard/dashboard-timeline.ts');
const SLOTS = [
  [0, 'client_identity'],
  [5000, 'relationship_stage'],
  [12000, 'interaction_timeline'],
  [18000, 'ai_alerts'],
  [23000, 'external_signals'],
  [28000, 'context_loaded_badge'],
];
for (const [delay, panel] of SLOTS) {
  const re = new RegExp(`\\{\\s*delay:\\s*${delay}\\s*,\\s*panel:\\s*'${panel}'\\s*\\}`);
  if (re.test(tlSrc)) ok(`RELOAD_TIMELINE has ${delay}ms → ${panel}`);
  else ko(`RELOAD_TIMELINE has ${delay}ms → ${panel}`, 'not found in source');
}

// 4.D — EVENT_ROUTE_MAP covers all 6 kinds.
for (const kind of ['meeting', 'earnings', 'email', 'memo', 'project', 'signal']) {
  if (new RegExp(`${kind}:\\s*'[a-z]+'`).test(tlSrc))
    ok(`EVENT_ROUTE_MAP covers kind ${kind}`);
  else ko(`EVENT_ROUTE_MAP covers kind ${kind}`, 'not in source');
}

// 4.E — globals.css has the §4.1 / §4.4 / §4.5 banner markers.
const css = readText('app/globals.css');
for (const marker of ['§4.1 dashboard', '§4.4 data hub', '§4.5 meeting split', '§4.3 continuity']) {
  if (css.includes(marker)) ok(`globals.css contains marker · ${marker}`);
  else ko(`globals.css contains marker · ${marker}`, 'banner missing');
}

// 4.F — thesis fixture has exactly two screenshots + both ids.
try {
  const thesis = JSON.parse(readText('fixtures/thesis_fixtures/thesis.json'));
  if (thesis.screenshots && thesis.screenshots.length === 2) {
    ok('thesis.json has exactly 2 screenshots');
  } else {
    ko('thesis.json has exactly 2 screenshots', `got ${thesis.screenshots?.length}`);
  }
  const ids = new Set(thesis.screenshots.map((s) => s.id));
  if (ids.has('before_m1') && ids.has('before_m2')) {
    ok('thesis.json covers both screenshot ids');
  } else {
    ko('thesis.json covers both screenshot ids', JSON.stringify([...ids]));
  }
} catch (e) {
  ko('thesis.json parse', e.message);
}

// 4.G — dashboard fixture industry-neutrality check.
try {
  const dash = readText('fixtures/dashboard_fixtures/dashboard.json');
  for (const banned of ['same-store sales', 'unit economics', 'production line']) {
    if (dash.toLowerCase().includes(banned.toLowerCase())) {
      ko(`dashboard fixture free of sector-specific term · "${banned}"`, 'banned term present');
    } else {
      ok(`dashboard fixture free of sector-specific term · "${banned}"`);
    }
  }
} catch (e) {
  ko('dashboard fixture read', e.message);
}

// 4.H — three new schemas exist + compile (already partly covered by 4.A; extra
//        explicit check grouped here for the smoke-expansion deliverable).
const NEW_SCHEMAS = [
  'fixtures/dashboard_fixtures/dashboard.schema.json',
  'fixtures/datahub_fixtures/datahub.schema.json',
  'fixtures/thesis_fixtures/thesis.schema.json',
];
for (const rel of NEW_SCHEMAS) {
  if (!exists(rel)) {
    ko(`schema exists · ${rel}`, 'file missing');
    continue;
  }
  try {
    JSON.parse(readText(rel));
    ok(`schema parses · ${rel}`);
  } catch (e) {
    ko(`schema parses · ${rel}`, e.message);
  }
}

// 4.I — all 6 main route source files exist.
const ROUTE_FILES = [
  'app/(main)/dashboard/DashboardPage.tsx',
  'app/(main)/datahub/DataHubPage.tsx',
  'app/(main)/meeting/MeetingPage.tsx',
  'app/(main)/diagnostic/DiagnosticPage.tsx',
  'app/(main)/continuity/ContinuityPage.tsx',
  'app/(floating)/recall-panel/RecallPanel.tsx',
];
for (const rel of ROUTE_FILES) {
  if (exists(rel)) ok(`route source exists · ${rel}`);
  else ko(`route source exists · ${rel}`, 'file missing');
}

// 4.J — dashboard-timeline.ts exports RELOAD_TIMELINE.
const tlSrc2 = readText('lib/dashboard/dashboard-timeline.ts');
if (/export\s+const\s+RELOAD_TIMELINE/.test(tlSrc2)) {
  ok('dashboard-timeline.ts exports RELOAD_TIMELINE');
} else {
  ko('dashboard-timeline.ts exports RELOAD_TIMELINE', 'export not found');
}

// 4.K — useDistributeAnimation.ts exists.
if (exists('app/(main)/datahub/useDistributeAnimation.ts')) {
  ok('useDistributeAnimation.ts exists');
} else {
  ko('useDistributeAnimation.ts exists', 'file missing');
}

// 4.L — public/assets/thesis/ has ≥2 placeholder SVG files.
const thesisDir = path.join(ROOT, 'public/assets/thesis');
let svgCount = 0;
if (fs.existsSync(thesisDir)) {
  svgCount = fs.readdirSync(thesisDir).filter((f) => f.startsWith('placeholder-') && f.endsWith('.svg')).length;
}
if (svgCount >= 2) {
  ok(`public/assets/thesis has ≥2 placeholder SVGs (found ${svgCount})`);
} else {
  ko(`public/assets/thesis has ≥2 placeholder SVGs`, `found ${svgCount}`);
}

// 4.M — MeetingPage.tsx emits both meeting:start AND meeting:end.
const meetingSrc = readText('app/(main)/meeting/MeetingPage.tsx');
if (/MEETING_START/.test(meetingSrc)) {
  ok('MeetingPage.tsx references MEETING_START');
} else {
  ko('MeetingPage.tsx references MEETING_START', 'not found');
}
if (/MEETING_END/.test(meetingSrc)) {
  ok('MeetingPage.tsx references MEETING_END');
} else {
  ko('MeetingPage.tsx references MEETING_END', 'not found');
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Phase 4 tests: ${pass.length} passed, ${fail.length} failed`);
if (fail.length > 0) {
  console.error(`\nFailed tests:\n${fail.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('All Phase 4 structural smoke checks GREEN.');
process.exit(0);
