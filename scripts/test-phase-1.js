#!/usr/bin/env node
// Phase 1 smoke tests — file/config assertions only (no Tauri runtime needed).
// Run: node scripts/test-phase-1.js
// Exits 0 on all pass, 1 on any failure.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pass = [];
const fail = [];

function ok(name) { pass.push(name); console.log(`  PASS  ${name}`); }
function ko(name, reason) { fail.push(name); console.error(`  FAIL  ${name}\n        ${reason}`); }

// ---------------------------------------------------------------------------
// § 1.1 — out/ HTML files
// ---------------------------------------------------------------------------
console.log('\n--- 1.1  out/ HTML files ---');

const EXPECTED_HTML = [
  'index.html',
  'preflight/index.html',
  'dashboard/index.html',
  'diagnostic/index.html',
  'continuity/index.html',
  'datahub/index.html',
  'meeting/index.html',
  'recall-panel/index.html',
];

for (const rel of EXPECTED_HTML) {
  const full = path.join(ROOT, 'out', rel);
  if (fs.existsSync(full)) ok(`out/${rel} exists`);
  else ko(`out/${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 1.2 — tauri.conf.json windows
// ---------------------------------------------------------------------------
console.log('\n--- 1.2  tauri.conf.json windows ---');

const tauriConfPath = path.join(ROOT, 'src-tauri', 'tauri.conf.json');
let tauriConf;
try {
  tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  ok('tauri.conf.json is valid JSON');
} catch (e) {
  ko('tauri.conf.json is valid JSON', e.message);
  process.exit(1);
}

const windows = tauriConf?.app?.windows ?? [];
if (windows.length === 2) ok('tauri.conf.json has exactly 2 windows');
else ko('tauri.conf.json has exactly 2 windows', `got ${windows.length}`);

const mainWin = windows.find(w => w.label === 'main');
const recallWin = windows.find(w => w.label === 'recall');

if (mainWin) ok('main window config present');
else ko('main window config present', 'no window with label "main"');

if (recallWin) ok('recall window config present');
else ko('recall window config present', 'no window with label "recall"');

if (recallWin) {
  if (recallWin.visible === false) ok('recall window visible:false');
  else ko('recall window visible:false', `got ${recallWin.visible}`);

  if (recallWin.alwaysOnTop === true) ok('recall window alwaysOnTop:true');
  else ko('recall window alwaysOnTop:true', `got ${recallWin.alwaysOnTop}`);

  if (recallWin.decorations === false) ok('recall window decorations:false');
  else ko('recall window decorations:false', `got ${recallWin.decorations}`);

  if (recallWin.transparent === true) ok('recall window transparent:true');
  else ko('recall window transparent:true', `got ${recallWin.transparent}`);
}

// ---------------------------------------------------------------------------
// § 1.3 — capabilities/main.json includes core:window:allow-set-focus
// ---------------------------------------------------------------------------
console.log('\n--- 1.3  capabilities/main.json ---');

const mainCapPath = path.join(ROOT, 'src-tauri', 'capabilities', 'main.json');
let mainCap;
try {
  mainCap = JSON.parse(fs.readFileSync(mainCapPath, 'utf8'));
  ok('capabilities/main.json is valid JSON');
} catch (e) {
  ko('capabilities/main.json is valid JSON', e.message);
  process.exit(1);
}

const perms = mainCap?.permissions ?? [];
if (perms.includes('core:window:allow-set-focus')) ok('main capability includes core:window:allow-set-focus');
else ko('main capability includes core:window:allow-set-focus', `permissions: ${JSON.stringify(perms)}`);

// ---------------------------------------------------------------------------
// § 1.4 — next.config.js env block declares all 4 private vars
// ---------------------------------------------------------------------------
console.log('\n--- 1.4  next.config.js env block ---');

const nextConfigPath = path.join(ROOT, 'next.config.js');
let nextConfigSrc;
try {
  nextConfigSrc = fs.readFileSync(nextConfigPath, 'utf8');
  ok('next.config.js exists');
} catch (e) {
  ko('next.config.js exists', e.message);
  process.exit(1);
}

const REQUIRED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_EMBED_MODEL',
];
for (const v of REQUIRED_ENV_VARS) {
  if (nextConfigSrc.includes(v)) ok(`next.config.js env declares ${v}`);
  else ko(`next.config.js env declares ${v}`, 'var not found in env block');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`Phase 1 smoke tests: ${pass.length} passed, ${fail.length} failed`);
if (fail.length > 0) {
  console.error(`\nFailed tests:\n${fail.map(f => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('All Phase 1 smoke tests GREEN.');
process.exit(0);
