#!/usr/bin/env node
// Phase 2B smoke tests — file/schema/export/token assertions only (no runtime needed).
// Run: node scripts/test-phase-2b.js
// Exits 0 on all pass, 1 on any failure.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pass = [];
const fail = [];

function ok(name) { pass.push(name); console.log(`  PASS  ${name}`); }
function ko(name, reason) { fail.push(name); console.error(`  FAIL  ${name}\n        ${reason}`); }

// ---------------------------------------------------------------------------
// § 2B.1 — Core lib/override files exist
// ---------------------------------------------------------------------------
console.log('\n--- 2B.1  lib/override files ---');

const LIB_FILES = [
  'lib/override/dims.ts',
  'lib/override/override-chain.ts',
  'lib/override/cache-loader.ts',
  'lib/override/override-parser.ts',
  'lib/override/diff.ts',
];

for (const rel of LIB_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 2B.2 — UI components exist
// ---------------------------------------------------------------------------
console.log('\n--- 2B.2  Diagnostic UI components ---');

const UI_FILES = [
  'app/(main)/diagnostic/DiagnosticPage.tsx',
  'app/(main)/diagnostic/StrategyWheel.tsx',
  'app/(main)/diagnostic/hooks/useOverrideSession.ts',
];

for (const rel of UI_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 2B.3 — dims.ts exports + STRATEGY_WHEEL_DIMS is a 7-entry array
// ---------------------------------------------------------------------------
console.log('\n--- 2B.3  dims.ts exports ---');

const dimsPath = path.join(ROOT, 'lib/override/dims.ts');
try {
  const src = fs.readFileSync(dimsPath, 'utf8');
  if (src.includes('STRATEGY_WHEEL_DIMS')) ok('dims.ts exports STRATEGY_WHEEL_DIMS');
  else ko('dims.ts exports STRATEGY_WHEEL_DIMS', 'symbol not found in source');

  // Count 7 dimension entries by counting unique id strings in the const
  const idMatches = src.match(/'external_sensing'|'internal_sensing'|'strategy_formulation'|'transformation_concept'|'strategic_transformation'|'strategic_innovation'|'strategy_governance'/g);
  const uniqueIds = new Set(idMatches);
  if (uniqueIds.size === 7) ok('STRATEGY_WHEEL_DIMS has 7 unique dimension ids');
  else ko('STRATEGY_WHEEL_DIMS has 7 unique dimension ids', `found ${uniqueIds.size} unique ids`);

  if (src.includes('scoreToBucket')) ok('dims.ts exports scoreToBucket');
  else ko('dims.ts exports scoreToBucket', 'symbol not found in source');

  if (src.includes('toBucket')) ok('dims.ts exports toBucket');
  else ko('dims.ts exports toBucket', 'symbol not found in source');
} catch (e) {
  ko('dims.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2B.4 — cache-loader.ts exports lookupOverride
// ---------------------------------------------------------------------------
console.log('\n--- 2B.4  cache-loader.ts exports ---');

const cacheLoaderPath = path.join(ROOT, 'lib/override/cache-loader.ts');
try {
  const src = fs.readFileSync(cacheLoaderPath, 'utf8');
  if (src.includes('lookupOverride')) ok('cache-loader.ts exports lookupOverride');
  else ko('cache-loader.ts exports lookupOverride', 'symbol not found in source');
} catch (e) {
  ko('cache-loader.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2B.5 — override_cache.schema.json is valid JSON Schema draft-07
// ---------------------------------------------------------------------------
console.log('\n--- 2B.5  fixtures/override_cache.schema.json ---');

const schemaPath = path.join(ROOT, 'fixtures/override_cache.schema.json');
let schemaParsed;
try {
  schemaParsed = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  ok('fixtures/override_cache.schema.json is valid JSON');
} catch (e) {
  ko('fixtures/override_cache.schema.json is valid JSON', e.message);
}
if (schemaParsed) {
  const schemaDecl = schemaParsed['$schema'] ?? '';
  if (schemaDecl.includes('draft-07')) ok('override_cache.schema.json declares draft-07');
  else ko('override_cache.schema.json declares draft-07', `got: ${schemaDecl || '(none)'}`);
}

// ---------------------------------------------------------------------------
// § 2B.6 — override_cache.json validates against schema (structural check)
// ---------------------------------------------------------------------------
console.log('\n--- 2B.6  fixtures/override_cache.json validates against schema ---');

const cachePath = path.join(ROOT, 'fixtures/override_cache.json');
let cacheParsed;
try {
  cacheParsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  ok('fixtures/override_cache.json is valid JSON');
} catch (e) {
  ko('fixtures/override_cache.json is valid JSON', e.message);
}
if (cacheParsed) {
  if (typeof cacheParsed.version === 'number' && cacheParsed.version === 1)
    ok('override_cache.json has version: 1');
  else ko('override_cache.json has version: 1', `got: ${cacheParsed.version}`);

  if (Array.isArray(cacheParsed.entries))
    ok('override_cache.json has entries array (empty is valid)');
  else ko('override_cache.json has entries array', `entries is ${typeof cacheParsed.entries}`);
}

// ---------------------------------------------------------------------------
// § 2B.7 — globals.css contains required CSS tokens
// ---------------------------------------------------------------------------
console.log('\n--- 2B.7  app/globals.css CSS tokens ---');

const cssPath = path.join(ROOT, 'app/globals.css');
try {
  const css = fs.readFileSync(cssPath, 'utf8');
  const tokens = [
    '.hypothesis-card--baseline',
    '.hypothesis-card--incoming',
    '.is-fading-out',
  ];
  for (const token of tokens) {
    if (css.includes(token)) ok(`globals.css contains ${token}`);
    else ko(`globals.css contains ${token}`, 'token not found');
  }
} catch (e) {
  ko('globals.css readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2B.8 — override-parser.ts implements required grammar tags
// ---------------------------------------------------------------------------
console.log('\n--- 2B.8  override-parser.ts grammar tags ---');

const parserPath = path.join(ROOT, 'lib/override/override-parser.ts');
try {
  const src = fs.readFileSync(parserPath, 'utf8');
  const grammarTags = ['hypothesis_start', 'hypothesis_end', 'done'];
  for (const tag of grammarTags) {
    if (src.includes(`'${tag}'`) || src.includes(`"${tag}"`))
      ok(`override-parser.ts implements <${tag}> tag`);
    else ko(`override-parser.ts implements <${tag}> tag`, `tag string not found in source`);
  }
} catch (e) {
  ko('override-parser.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`Phase 2B smoke tests: ${pass.length} passed, ${fail.length} failed`);
if (fail.length > 0) {
  console.error(`\nFailed tests:\n${fail.map(f => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('All Phase 2B smoke tests GREEN.');
process.exit(0);
