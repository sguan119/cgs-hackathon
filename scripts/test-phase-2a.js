#!/usr/bin/env node
// Phase 2A smoke tests — file/schema assertions only (no runtime needed).
// Run: node scripts/test-phase-2a.js
// Exits 0 on all pass, 1 on any failure.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pass = [];
const fail = [];

function ok(name) { pass.push(name); console.log(`  PASS  ${name}`); }
function ko(name, reason) { fail.push(name); console.error(`  FAIL  ${name}\n        ${reason}`); }

// ---------------------------------------------------------------------------
// § 2A.1 — Core lib files
// ---------------------------------------------------------------------------
console.log('\n--- 2A.1  lib/llm files ---');

const LIB_FILES = [
  'lib/llm/stream-parser.ts',
  'lib/llm/recall-chain.ts',
];

for (const rel of LIB_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 2A.2 — JSON Schema files are valid draft-07
// ---------------------------------------------------------------------------
console.log('\n--- 2A.2  fixture JSON Schemas ---');

const SCHEMA_FILES = [
  'fixtures/scripted_queries.schema.json',
  'fixtures/offline_cache.schema.json',
];

for (const rel of SCHEMA_FILES) {
  const full = path.join(ROOT, rel);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
    ok(`${rel} is valid JSON`);
  } catch (e) {
    ko(`${rel} is valid JSON`, e.message);
    continue;
  }
  const schema = parsed['$schema'] ?? '';
  if (schema.includes('draft-07') || schema.includes('json-schema.org/schema')) {
    ok(`${rel} declares draft-07 $schema`);
  } else {
    ko(`${rel} declares draft-07 $schema`, `got: ${schema || '(none)'}`);
  }
}

// ---------------------------------------------------------------------------
// § 2A.3 — RecallPanel.tsx exists
// ---------------------------------------------------------------------------
console.log('\n--- 2A.3  RecallPanel component ---');

const recallPanelPath = path.join(ROOT, 'app/(floating)/recall-panel/RecallPanel.tsx');
if (fs.existsSync(recallPanelPath)) ok('app/(floating)/recall-panel/RecallPanel.tsx exists');
else ko('app/(floating)/recall-panel/RecallPanel.tsx exists', `file not found: ${recallPanelPath}`);

// ---------------------------------------------------------------------------
// § 2A.4 — RecallCard.tsx contains data-has-fellow attribute path
// ---------------------------------------------------------------------------
console.log('\n--- 2A.4  RecallCard data-has-fellow attribute ---');

const recallCardPath = path.join(ROOT, 'app/(floating)/recall-panel/RecallCard.tsx');
try {
  const src = fs.readFileSync(recallCardPath, 'utf8');
  if (src.includes('data-has-fellow')) ok('RecallCard.tsx contains data-has-fellow attribute');
  else ko('RecallCard.tsx contains data-has-fellow attribute', 'string not found in source');
} catch (e) {
  ko('RecallCard.tsx contains data-has-fellow attribute', e.message);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`Phase 2A smoke tests: ${pass.length} passed, ${fail.length} failed`);
if (fail.length > 0) {
  console.error(`\nFailed tests:\n${fail.map(f => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('All Phase 2A smoke tests GREEN.');
process.exit(0);
