#!/usr/bin/env node
// Phase 2C smoke tests — file/schema/export assertions only (no runtime needed).
// Run: node scripts/test-phase-2c.js
// Exits 0 on all pass, 1 on any failure.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pass = [];
const fail = [];

function ok(name) { pass.push(name); console.log(`  PASS  ${name}`); }
function ko(name, reason) { fail.push(name); console.error(`  FAIL  ${name}\n        ${reason}`); }

// ---------------------------------------------------------------------------
// § 2C.1 — Core lib files exist
// ---------------------------------------------------------------------------
console.log('\n--- 2C.1  lib/methodology + lib/toneguard files ---');

const LIB_FILES = [
  'lib/toneguard/types.ts',
  'lib/toneguard/validate.ts',
  'lib/toneguard/highlight.ts',
  'lib/methodology/tags.ts',
  'lib/methodology/sales-blacklist.ts',
];

for (const rel of LIB_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 2C.2 — UI components exist
// ---------------------------------------------------------------------------
console.log('\n--- 2C.2  Continuity UI components ---');

const UI_FILES = [
  'app/(main)/continuity/ContinuityPage.tsx',
  'app/(main)/continuity/EmailCard.tsx',
  'app/(main)/continuity/HighlightedBody.tsx',
  'app/(main)/continuity/ReasonPopover.tsx',
  'app/(main)/continuity/ToneGuardPaste.tsx',
  'app/(main)/continuity/page.tsx',
];

for (const rel of UI_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 2C.3 — Fixture files present + expected_verdict matches id
// ---------------------------------------------------------------------------
console.log('\n--- 2C.3  continuity fixtures ---');

const FIXTURE_FILES = ['pass', 'borderline', 'high-risk'];
const VALID_VERDICTS = ['pass', 'borderline', 'high-risk'];
for (const id of FIXTURE_FILES) {
  const rel = `fixtures/continuity_fixtures/${id}.json`;
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    ko(`${rel} exists`, `file not found: ${full}`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf8'));
    ok(`${rel} is valid JSON`);
  } catch (e) {
    ko(`${rel} is valid JSON`, e.message);
    continue;
  }
  // N1 (Reviewer #2): id-matches-filename is a Phase 2C seed convention
  // but not a structural invariant — future fixtures may add more than
  // one `pass` case, etc. Keep the filename/id check (it catches a
  // miscopied file), but only validate that `expected_verdict` is a
  // valid Verdict enum value, not that it equals the filename.
  if (data.id === id) ok(`${rel} id === "${id}"`);
  else ko(`${rel} id === "${id}"`, `got: ${data.id}`);
  if (VALID_VERDICTS.includes(data.expected_verdict))
    ok(`${rel} expected_verdict is a valid Verdict enum value`);
  else
    ko(`${rel} expected_verdict is a valid Verdict enum value`,
       `got: ${data.expected_verdict} — must be one of ${VALID_VERDICTS.join(', ')}`);
}

const schemaPath = path.join(ROOT, 'fixtures/continuity_fixtures/email-fixture.schema.json');
if (fs.existsSync(schemaPath)) ok('fixtures/continuity_fixtures/email-fixture.schema.json exists');
else ko('fixtures/continuity_fixtures/email-fixture.schema.json exists', `missing: ${schemaPath}`);

try {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  if (String(schema['$schema'] || '').includes('draft-07'))
    ok('email-fixture.schema.json declares draft-07');
  else
    ko('email-fixture.schema.json declares draft-07', `got: ${schema['$schema']}`);
} catch (e) {
  ko('email-fixture.schema.json readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2C.4 — tags.ts exports METHODOLOGY_TAGS with ≥10 canonical entries
// ---------------------------------------------------------------------------
console.log('\n--- 2C.4  tags.ts exports ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/methodology/tags.ts'), 'utf8');
  if (src.includes('METHODOLOGY_TAGS')) ok('tags.ts exports METHODOLOGY_TAGS');
  else ko('tags.ts exports METHODOLOGY_TAGS', 'symbol not found in source');

  if (src.includes('isCanonicalTag')) ok('tags.ts exports isCanonicalTag');
  else ko('tags.ts exports isCanonicalTag', 'symbol not found in source');

  const canonicalMatches = src.match(/canonical:\s*'[^']+'/g) || [];
  if (canonicalMatches.length >= 10) ok(`tags.ts declares ≥10 canonical entries (found ${canonicalMatches.length})`);
  else ko('tags.ts declares ≥10 canonical entries', `only found ${canonicalMatches.length}`);

  // 3 pillar categories represented
  for (const cat of ['strategy_wheel', 'inertia', 'first_mile']) {
    if (src.includes(`'${cat}'`)) ok(`tags.ts references category "${cat}"`);
    else ko(`tags.ts references category "${cat}"`, 'category not found');
  }
} catch (e) {
  ko('tags.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2C.5 — sales-blacklist.ts exports SALES_BLACKLIST with ≥15 entries
// ---------------------------------------------------------------------------
console.log('\n--- 2C.5  sales-blacklist.ts exports ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/methodology/sales-blacklist.ts'), 'utf8');
  if (src.includes('SALES_BLACKLIST')) ok('sales-blacklist.ts exports SALES_BLACKLIST');
  else ko('sales-blacklist.ts exports SALES_BLACKLIST', 'symbol not found in source');

  const idMatches = src.match(/id:\s*'bl-[^']+'/g) || [];
  if (idMatches.length >= 15) ok(`sales-blacklist.ts declares ≥15 entries (found ${idMatches.length})`);
  else ko('sales-blacklist.ts declares ≥15 entries', `only found ${idMatches.length}`);
} catch (e) {
  ko('sales-blacklist.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2C.6 — validate.ts exports validate() and references all 6 RuleIds
// ---------------------------------------------------------------------------
console.log('\n--- 2C.6  validate.ts rule coverage ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/toneguard/validate.ts'), 'utf8');
  if (src.includes('export function validate')) ok('validate.ts exports validate()');
  else ko('validate.ts exports validate()', 'signature not found in source');

  const RULES = [
    'sales_blacklist',
    'sales_soft_hit',
    'missing_section',
    'out_of_order_section',
    'unknown_methodology_tag',
    'no_methodology_tag',
  ];
  for (const rule of RULES) {
    if (src.includes(`'${rule}'`)) ok(`validate.ts emits rule "${rule}"`);
    else ko(`validate.ts emits rule "${rule}"`, 'rule id not found');
  }

  // U+2019 tolerance check per plan §4.2 / T10. Accept either the raw
  // codepoint OR the `\u2019` escape sequence in source.
  if (src.includes('\u2019') || src.includes('\\u2019'))
    ok('validate.ts tolerates U+2019 right single quote in section header');
  else
    ko('validate.ts tolerates U+2019 right single quote in section header', 'neither raw U+2019 nor \\u2019 escape found');
} catch (e) {
  ko('validate.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2C.7 — globals.css contains §2C tokens
// ---------------------------------------------------------------------------
console.log('\n--- 2C.7  globals.css tokens ---');

try {
  const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  const tokens = [
    '/* §2C tone guard',
    '.tg-email-card',
    '.tg-hl-high',
    '.tg-hl-borderline',
    '.tg-reasons',
    '.tg-paste-input',
  ];
  for (const t of tokens) {
    if (css.includes(t)) ok(`globals.css contains ${t}`);
    else ko(`globals.css contains ${t}`, 'token not found');
  }
} catch (e) {
  ko('globals.css readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2C.8 — dims.ts TODO banner cleared
// ---------------------------------------------------------------------------
console.log('\n--- 2C.8  dims.ts TODO banner cleared ---');

try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/override/dims.ts'), 'utf8');
  if (!/TODO\s*\(Phase 2C\)/.test(src))
    ok('dims.ts no longer carries TODO (Phase 2C) banner');
  else ko('dims.ts no longer carries TODO (Phase 2C) banner', 'banner still present');

  if (src.includes('lib/methodology/tags.ts'))
    ok('dims.ts points at lib/methodology/tags.ts for reconciliation');
  else ko('dims.ts points at lib/methodology/tags.ts', 'pointer comment not found');
} catch (e) {
  ko('dims.ts readable', e.message);
}

// ---------------------------------------------------------------------------
// § 2C.9 — Gap-close smoke assertions
// ---------------------------------------------------------------------------
console.log('\n--- 2C.9  gap-close assertions ---');

// A1: lib/toneguard/highlight.ts exists and exports buildHighlightRegions
try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/toneguard/highlight.ts'), 'utf8');
  if (fs.existsSync(path.join(ROOT, 'lib/toneguard/highlight.ts')))
    ok('lib/toneguard/highlight.ts exists and exports buildHighlightRegions');
  else
    ko('lib/toneguard/highlight.ts exists and exports buildHighlightRegions', 'file not found');
  if (src.includes('buildHighlightRegions'))
    ok('highlight.ts exports buildHighlightRegions symbol');
  else
    ko('highlight.ts exports buildHighlightRegions symbol', 'export not found in source');
} catch (e) {
  ko('highlight.ts readable', e.message);
}

// A2: fixtures have required schema fields (body, id, expected_verdict, to, subject)
{
  const REQUIRED = ['body', 'id', 'expected_verdict', 'to', 'subject'];
  const FIXTURE_IDS = ['pass', 'borderline', 'high-risk'];
  let allHaveFields = true;
  for (const id of FIXTURE_IDS) {
    const full = path.join(ROOT, `fixtures/continuity_fixtures/${id}.json`);
    try {
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      for (const field of REQUIRED) {
        if (!(field in data)) {
          ko(`fixture ${id}.json has field "${field}"`, `field missing`);
          allHaveFields = false;
        }
      }
    } catch (e) {
      ko(`fixture ${id}.json readable`, e.message);
      allHaveFields = false;
    }
  }
  if (allHaveFields)
    ok('all continuity fixtures have required schema fields (body, id, expected_verdict, to, subject)');
}

// A3: ContinuityPage.tsx imports EmailCard + ToneGuardPaste
try {
  const src = fs.readFileSync(path.join(ROOT, 'app/(main)/continuity/ContinuityPage.tsx'), 'utf8');
  if (src.includes('EmailCard'))
    ok('ContinuityPage.tsx imports EmailCard');
  else
    ko('ContinuityPage.tsx imports EmailCard', 'import not found');
  if (src.includes('ToneGuardPaste'))
    ok('ContinuityPage.tsx imports ToneGuardPaste');
  else
    ko('ContinuityPage.tsx imports ToneGuardPaste', 'import not found');
} catch (e) {
  ko('ContinuityPage.tsx readable', e.message);
}

// A4: ReasonPopover.tsx uses useId
try {
  const src = fs.readFileSync(path.join(ROOT, 'app/(main)/continuity/ReasonPopover.tsx'), 'utf8');
  if (src.includes('useId'))
    ok('ReasonPopover.tsx uses useId');
  else
    ko('ReasonPopover.tsx uses useId', 'useId not found in source');
} catch (e) {
  ko('ReasonPopover.tsx readable', e.message);
}

// A5: METHODOLOGY_TAGS contains "Structural" alias
try {
  const src = fs.readFileSync(path.join(ROOT, 'lib/methodology/tags.ts'), 'utf8');
  if (src.includes("'Structural'") || src.includes('"Structural"'))
    ok('METHODOLOGY_TAGS contains "Structural" alias (bare alias for Structural Inertia)');
  else
    ko('METHODOLOGY_TAGS contains "Structural" alias', '"Structural" alias string not found');
} catch (e) {
  ko('tags.ts readable for Structural alias check', e.message);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`Phase 2C smoke tests: ${pass.length} passed, ${fail.length} failed`);
if (fail.length > 0) {
  console.error(`\nFailed tests:\n${fail.map(f => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('All Phase 2C smoke tests GREEN.');
process.exit(0);
