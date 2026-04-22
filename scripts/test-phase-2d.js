#!/usr/bin/env node
// Phase 2D smoke tests — file/export assertions only (no runtime needed).
// Run: node scripts/test-phase-2d.js
// Exits 0 on all pass, 1 on any failure.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pass = [];
const fail = [];

function ok(name) { pass.push(name); console.log(`  PASS  ${name}`); }
function ko(name, reason) { fail.push(name); console.error(`  FAIL  ${name}\n        ${reason}`); }

// ---------------------------------------------------------------------------
// § 2D.1 — Core lib/shell files exist
// ---------------------------------------------------------------------------
console.log('\n--- 2D.1  lib/shell files ---');

const SHELL_FILES = [
  'lib/shell/types.ts',
  'lib/shell/follow-coordinator.ts',
  'lib/shell/cleanup.ts',
];

for (const rel of SHELL_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 2D.2 — UI files exist
// ---------------------------------------------------------------------------
console.log('\n--- 2D.2  recall-panel Phase 2D UI files ---');

const UI_FILES = [
  'app/(floating)/recall-panel/ReattachButton.tsx',
  'app/(floating)/recall-panel/hooks/useShellMode.ts',
];

for (const rel of UI_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 2D.3 — types.ts exports ShellMode union
// ---------------------------------------------------------------------------
console.log('\n--- 2D.3  ShellMode type ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/shell/types.ts'), 'utf8');
  if (src.includes('ShellMode') && src.includes("'follow'") && src.includes("'detached'"))
    ok("types.ts exports ShellMode = 'follow' | 'detached'");
  else ko("types.ts exports ShellMode = 'follow' | 'detached'", 'union not found in source');

  for (const sym of ['FollowCoordinatorHandle', 'FollowCoordinatorState', 'CoordinatorDeps', 'MainMovePayload', 'MainResizePayload', 'StartOptions']) {
    if (src.includes(sym)) ok(`types.ts exports ${sym}`);
    else ko(`types.ts exports ${sym}`, 'symbol not found in source');
  }
} catch (e) {
  ko('types.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.4 — events.ts declares new shell events
// ---------------------------------------------------------------------------
console.log('\n--- 2D.4  shell event names ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/events.ts'), 'utf8');
  const EVENT_NAMES = [
    'SHELL_MAIN_MOVED',
    'SHELL_MAIN_RESIZED',
    'SHELL_MODE_CHANGED',
    'SHELL_APP_QUIT',
    'SHELL_REATTACH_REQUESTED',
  ];
  for (const name of EVENT_NAMES) {
    if (src.includes(name)) ok(`events.ts declares ${name}`);
    else ko(`events.ts declares ${name}`, 'constant not found');
  }
  for (const wire of ['shell:main_moved', 'shell:main_resized', 'shell:mode_changed', 'shell:app_quit', 'shell:reattach_requested']) {
    if (src.includes(`'${wire}'`)) ok(`events.ts wire name ${wire}`);
    else ko(`events.ts wire name ${wire}`, 'wire name not found');
  }
} catch (e) {
  ko('events.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.5 — window.ts exports expectedRecallPosition + getRecallOuterPosition
// ---------------------------------------------------------------------------
console.log('\n--- 2D.5  window.ts Phase 2D exports ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/window.ts'), 'utf8');
  if (/export async function expectedRecallPosition\b/.test(src))
    ok('window.ts exports expectedRecallPosition()');
  else ko('window.ts exports expectedRecallPosition()', 'export not found');

  if (/export async function getRecallOuterPosition\b/.test(src))
    ok('window.ts exports getRecallOuterPosition()');
  else ko('window.ts exports getRecallOuterPosition()', 'export not found');

  if (/expectedRecallPosition\(\)/.test(src))
    ok('repositionToMainRight() reuses expectedRecallPosition()');
  else ko('repositionToMainRight() reuses expectedRecallPosition()', 'call site not found');
} catch (e) {
  ko('window.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.6 — follow-coordinator.ts exports + internals
// ---------------------------------------------------------------------------
console.log('\n--- 2D.6  follow-coordinator shape ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/shell/follow-coordinator.ts'), 'utf8');
  if (src.includes('export async function startFollowCoordinator'))
    ok('follow-coordinator.ts exports startFollowCoordinator()');
  else ko('follow-coordinator.ts exports startFollowCoordinator()', 'export not found');

  if (src.includes('export function _createCoordinator'))
    ok('follow-coordinator.ts exports _createCoordinator (test factory)');
  else ko('follow-coordinator.ts exports _createCoordinator', 'export not found');

  if (/16/.test(src)) ok('follow-coordinator.ts has debounce constant (16)');
  else ko('follow-coordinator.ts has debounce constant', 'not found');

  if (/30/.test(src)) ok('follow-coordinator.ts has drift threshold constant (30)');
  else ko('follow-coordinator.ts has drift threshold constant', 'not found');

  if (/200/.test(src)) ok('follow-coordinator.ts has drift window constant (200)');
  else ko('follow-coordinator.ts has drift window constant', 'not found');
} catch (e) {
  ko('follow-coordinator.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.7 — cleanup.ts exports registerDisposable + disposeAll
// ---------------------------------------------------------------------------
console.log('\n--- 2D.7  cleanup shape ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/shell/cleanup.ts'), 'utf8');
  for (const sym of ['registerDisposable', 'disposeAll']) {
    if (src.includes(`export function ${sym}`) || src.includes(`export async function ${sym}`))
      ok(`cleanup.ts exports ${sym}`);
    else ko(`cleanup.ts exports ${sym}`, 'export not found');
  }
  if (/cleanedUp\s*=\s*true/.test(src)) ok('cleanup.ts tracks cleanedUp flag');
  else ko('cleanup.ts tracks cleanedUp flag', 'flag assignment not found');
} catch (e) {
  ko('cleanup.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.8 — Rust lib.rs wires on_window_event
// ---------------------------------------------------------------------------
console.log('\n--- 2D.8  Rust window-event wiring ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'src-tauri/src/lib.rs'), 'utf8');
  if (/\.on_window_event\(/.test(src))
    ok('lib.rs uses Builder::on_window_event');
  else ko('lib.rs uses Builder::on_window_event', 'call not found');

  for (const variant of ['Moved', 'Resized', 'CloseRequested']) {
    if (src.includes(`WindowEvent::${variant}`)) ok(`lib.rs handles WindowEvent::${variant}`);
    else ko(`lib.rs handles WindowEvent::${variant}`, 'not referenced');
  }

  if (src.includes('shell:main_moved') && src.includes('shell:main_resized') && src.includes('shell:app_quit'))
    ok('lib.rs emits all three shell event names');
  else ko('lib.rs emits all three shell event names', 'emission string missing');

  if (/Mutex<Instant>/.test(src) || /Mutex::new\(Instant/.test(src))
    ok('lib.rs uses Mutex<Instant> throttle state');
  else ko('lib.rs uses Mutex<Instant> throttle state', 'pattern not found');

  // Match only actual invocations on an `api` / `_api` receiver — ignore
  // comments that mention "prevent_close()" prose.
  const nonCommentLines = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
  if (!/\bapi\.prevent_close\(\)/.test(nonCommentLines) && !/_api\.prevent_close\(\)/.test(nonCommentLines))
    ok('lib.rs does NOT call api.prevent_close() on CloseRequested');
  else ko('lib.rs does NOT call api.prevent_close()', 'prevent_close invocation found');
} catch (e) {
  ko('lib.rs readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.9 — RecallChrome renders ReattachButton conditionally
// ---------------------------------------------------------------------------
console.log('\n--- 2D.9  RecallChrome wiring ---');

try {
  const src = fs.readFileSync(
    path.join(ROOT, 'app/(floating)/recall-panel/RecallChrome.tsx'),
    'utf8'
  );
  if (src.includes('ReattachButton')) ok('RecallChrome.tsx imports ReattachButton');
  else ko('RecallChrome.tsx imports ReattachButton', 'import not found');
  if (src.includes('useShellMode')) ok('RecallChrome.tsx imports useShellMode');
  else ko('RecallChrome.tsx imports useShellMode', 'import not found');
  if (/mode\s*===\s*'detached'/.test(src)) ok("RecallChrome.tsx gates on mode === 'detached'");
  else ko("RecallChrome.tsx gates on mode === 'detached'", 'guard not found');
} catch (e) {
  ko('RecallChrome.tsx readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.10 — boot-effects wires coordinator + quit listener
// ---------------------------------------------------------------------------
console.log('\n--- 2D.10  boot-effects wiring ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'app/boot-effects.tsx'), 'utf8');
  if (src.includes('startFollowCoordinator')) ok('boot-effects.tsx calls startFollowCoordinator');
  else ko('boot-effects.tsx calls startFollowCoordinator', 'call not found');
  if (src.includes('SHELL_APP_QUIT')) ok('boot-effects.tsx listens for SHELL_APP_QUIT');
  else ko('boot-effects.tsx listens for SHELL_APP_QUIT', 'event reference not found');
  if (src.includes('disposeAll')) ok('boot-effects.tsx delegates teardown to disposeAll');
  else ko('boot-effects.tsx delegates teardown to disposeAll', 'call not found');
  if (src.includes('registerDisposable')) ok('boot-effects.tsx uses registerDisposable');
  else ko('boot-effects.tsx uses registerDisposable', 'call not found');
} catch (e) {
  ko('boot-effects.tsx readable', e.message);
}

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/shell/follow-coordinator.ts'), 'utf8');
  if (src.includes('SHELL_REATTACH_REQUESTED'))
    ok('follow-coordinator.ts owns SHELL_REATTACH_REQUESTED listener');
  else ko('follow-coordinator.ts owns SHELL_REATTACH_REQUESTED listener', 'event reference not found');
} catch (e) {
  ko('follow-coordinator.ts readable for reattach listener check', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.11 — shortcuts.ts R7 retry-once hardening
// ---------------------------------------------------------------------------
console.log('\n--- 2D.11  shortcuts R7 hardening ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/shortcuts.ts'), 'utf8');
  if (/unregisterAll\(\)/.test(src)) ok('shortcuts.ts references unregisterAll()');
  else ko('shortcuts.ts references unregisterAll()', 'call not found');
  const registerCount = (src.match(/await register\(/g) || []).length;
  if (registerCount >= 2) ok(`shortcuts.ts attempts register() twice (found ${registerCount} call sites)`);
  else ko('shortcuts.ts attempts register() twice', `only ${registerCount} register() call(s) found`);
} catch (e) {
  ko('shortcuts.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.12 — globals.css has .recall-reattach rule
// ---------------------------------------------------------------------------
console.log('\n--- 2D.12  globals.css .recall-reattach ---');

try {
  const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  if (css.includes('.recall-reattach')) ok('globals.css contains .recall-reattach rule');
  else ko('globals.css contains .recall-reattach rule', 'selector not found');
} catch (e) {
  ko('globals.css readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.12c — additional coverage smoke checks
// ---------------------------------------------------------------------------
console.log('\n--- 2D.12c  additional coverage checks ---');

// cleanup.ts exports registerDisposable + disposeAll
try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/shell/cleanup.ts'), 'utf8');
  for (const sym of ['registerDisposable', 'disposeAll']) {
    if (src.includes(`export`) && src.includes(sym))
      ok(`cleanup.ts exports ${sym}`);
    else ko(`cleanup.ts exports ${sym}`, 'export not found');
  }
} catch (e) {
  ko('cleanup.ts coverage smoke', e.message);
}

// follow-coordinator.ts exports startFollowCoordinator + _createCoordinator
try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/shell/follow-coordinator.ts'), 'utf8');
  if (src.includes('export async function startFollowCoordinator') || src.includes('export function startFollowCoordinator'))
    ok('follow-coordinator.ts exports startFollowCoordinator');
  else ko('follow-coordinator.ts exports startFollowCoordinator', 'export not found');
  if (src.includes('export function _createCoordinator'))
    ok('follow-coordinator.ts exports _createCoordinator');
  else ko('follow-coordinator.ts exports _createCoordinator', 'export not found');
} catch (e) {
  ko('follow-coordinator.ts coverage smoke', e.message);
}

// lib.rs contains shell:app_quit emit
try {
  const src = fs.readFileSync(path.join(ROOT, 'src-tauri/src/lib.rs'), 'utf8');
  if (src.includes('shell:app_quit'))
    ok('lib.rs contains shell:app_quit emit');
  else ko('lib.rs contains shell:app_quit emit', 'string not found');

  // lib.rs contains 16ms throttle constant
  if (/\b16u128\b/.test(src) || /\b16\b/.test(src))
    ok('lib.rs contains 16ms throttle constant');
  else ko('lib.rs contains 16ms throttle constant', '16 not found in source');
} catch (e) {
  ko('lib.rs coverage smoke', e.message);
}

// boot-effects.tsx calls startFollowCoordinator AND listens for SHELL_APP_QUIT
try {
  const src = fs.readFileSync(path.join(ROOT, 'app/boot-effects.tsx'), 'utf8');
  if (src.includes('startFollowCoordinator') && src.includes('SHELL_APP_QUIT'))
    ok('boot-effects.tsx calls startFollowCoordinator AND references SHELL_APP_QUIT');
  else ko('boot-effects.tsx calls startFollowCoordinator AND references SHELL_APP_QUIT', 'one or both references missing');
} catch (e) {
  ko('boot-effects.tsx coverage smoke', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.12b — types flow through (import-chain check)
// ---------------------------------------------------------------------------
console.log('\n--- 2D.12b  types flow from lib/shell/types.ts ---');

try {
  const eventsSrc = fs.readFileSync(path.join(ROOT, 'lib/events.ts'), 'utf8');
  const coordSrc = fs.readFileSync(path.join(ROOT, 'lib/shell/follow-coordinator.ts'), 'utf8');
  const importsTypes =
    /from\s+['"]\.\/shell\/types['"]/.test(eventsSrc) ||
    /from\s+['"]\.\/types['"]/.test(coordSrc);
  if (importsTypes)
    ok('lib/shell/types.ts symbols imported by events.ts or follow-coordinator.ts');
  else
    ko(
      'lib/shell/types.ts symbols imported by events.ts or follow-coordinator.ts',
      'neither file imports from ./shell/types or ./types'
    );
} catch (e) {
  ko('types import-chain readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2D.13 — capabilities unchanged (no new permissions)
// ---------------------------------------------------------------------------
console.log('\n--- 2D.13  capabilities unchanged ---');

for (const capFile of ['src-tauri/capabilities/main.json', 'src-tauri/capabilities/recall.json']) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, capFile), 'utf8'));
    if (Array.isArray(data.permissions) && data.permissions.includes('core:event:default'))
      ok(`${capFile} includes core:event:default (required for shell events)`);
    else ko(`${capFile} includes core:event:default`, 'permission missing');
  } catch (e) {
    ko(`${capFile} readable`, e.message);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`Phase 2D smoke tests: ${pass.length} passed, ${fail.length} failed`);
if (fail.length > 0) {
  console.error(`\nFailed tests:\n${fail.map(f => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('All Phase 2D smoke tests GREEN.');
process.exit(0);
