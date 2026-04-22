#!/usr/bin/env node
// Phase 0 acceptance-criteria tests.
// Run: node scripts/test-phase-0.js
// Exits 0 on all pass, 1 on any failure.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ROOT = path.resolve(__dirname, '..');
const pass = [];
const fail = [];

function ok(name) { pass.push(name); console.log(`  PASS  ${name}`); }
function ko(name, reason) { fail.push(name); console.error(`  FAIL  ${name}\n        ${reason}`); }

// ---------------------------------------------------------------------------
// § 0.1 — Schema validity + example validation
// ---------------------------------------------------------------------------
console.log('\n--- 0.1  Schema + example ---');

const schemaPath = path.join(ROOT, 'fixtures', 'precedents.schema.json');
const examplePath = path.join(ROOT, 'fixtures', 'precedents.example.json');

let schema, example;

try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  ok('schema file is valid JSON');
} catch (e) {
  ko('schema file is valid JSON', e.message);
  process.exit(1); // cannot continue
}

try {
  example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
  ok('example file is valid JSON');
} catch (e) {
  ko('example file is valid JSON', e.message);
  process.exit(1);
}

// ajv compile
const ajv = new Ajv({ strict: false });
let validate;
try {
  validate = ajv.compile(schema);
  ok('schema compiles under ajv draft-07');
} catch (e) {
  ko('schema compiles under ajv draft-07', e.message);
  process.exit(1);
}

// example validates
const valid = validate(example);
if (valid) {
  ok('precedents.example.json validates against schema (zero errors)');
} else {
  ko('precedents.example.json validates against schema', JSON.stringify(validate.errors, null, 2));
}

// schema permits embedding: []
const emptyEmbed = [{ ...example[0], embedding: [] }];
if (validate(emptyEmbed)) ok('schema permits embedding: []');
else ko('schema permits embedding: []', JSON.stringify(validate.errors));

// schema permits embedding: [1536 floats]
const fullEmbed = [{ ...example[0], embedding: Array(1536).fill(0.1) }];
if (validate(fullEmbed)) ok('schema permits embedding: [1536 floats]');
else ko('schema permits embedding: [1536 floats]', JSON.stringify(validate.errors));

// required fields present
const REQUIRED_FIELDS = ['id','client_name','year','industry','summary','scene',
                         'key_quotes','cgs_tags','source_id','embedding','drilldown_layers'];
const hero = example[0];
const missingFields = REQUIRED_FIELDS.filter(f => !(f in hero));
if (missingFields.length === 0) ok('all required fields present on hero precedent');
else ko('all required fields present on hero precedent', `missing: ${missingFields.join(', ')}`);

// depth constrained to [1,2,3] — schema rejects depth=0 and depth=4
const badDepth0 = [{ ...hero, drilldown_layers: [{ depth: 0, theme: 'x', quotes: ['q'], key_facts: [{label:'l',value:'v'}] }] }];
const badDepth4 = [{ ...hero, drilldown_layers: [{ depth: 4, theme: 'x', quotes: ['q'], key_facts: [{label:'l',value:'v'}] }] }];
if (!validate(badDepth0)) ok('schema rejects depth=0');
else ko('schema rejects depth=0', 'expected validation failure');
if (!validate(badDepth4)) ok('schema rejects depth=4');
else ko('schema rejects depth=4', 'expected validation failure');

// hero has exactly 3 drilldown layers
const heroLayerCount = hero.drilldown_layers.length;
if (heroLayerCount === 3) ok('hero precedent has exactly 3 drilldown layers');
else ko('hero precedent has exactly 3 drilldown layers', `got ${heroLayerCount}`);

// drilldown depth sequence is 1,2,3
const depths = hero.drilldown_layers.map(l => l.depth);
if (JSON.stringify(depths) === JSON.stringify([1,2,3])) ok('drilldown_layers depths are [1,2,3]');
else ko('drilldown_layers depths are [1,2,3]', `got ${JSON.stringify(depths)}`);

// schema rejects 0 drilldown layers (minItems:1)
const noLayers = [{ ...hero, drilldown_layers: [] }];
if (!validate(noLayers)) ok('schema rejects drilldown_layers: []');
else ko('schema rejects drilldown_layers: []', 'expected validation failure');

// schema rejects 4 drilldown layers (maxItems:3)
const layer = hero.drilldown_layers[0];
const fourLayers = [{ ...hero, drilldown_layers: [layer, layer, layer, layer] }];
if (!validate(fourLayers)) ok('schema rejects 4 drilldown layers');
else ko('schema rejects 4 drilldown layers', 'expected validation failure');

// additionalProperties: false — unknown field rejected
const withExtra = [{ ...hero, unknown_field: true }];
if (!validate(withExtra)) ok('schema rejects unknown top-level field (additionalProperties:false)');
else ko('schema rejects unknown top-level field (additionalProperties:false)', 'expected validation failure');

// metadata bag is optional and permits any shape
const withMeta = [{ ...hero, metadata: { anything: [1,2,3], nested: { ok: true } } }];
if (validate(withMeta)) ok('schema accepts optional metadata bag with any shape');
else ko('schema accepts optional metadata bag with any shape', JSON.stringify(validate.errors));

// year range: 2004 rejected, 2027 rejected
const badYear2004 = [{ ...hero, year: 2004 }];
const badYear2027 = [{ ...hero, year: 2027 }];
if (!validate(badYear2004)) ok('schema rejects year < 2005');
else ko('schema rejects year < 2005', 'expected validation failure');
if (!validate(badYear2027)) ok('schema rejects year > 2026');
else ko('schema rejects year > 2026', 'expected validation failure');

// key_quotes minItems:1
const noQuotes = [{ ...hero, key_quotes: [] }];
if (!validate(noQuotes)) ok('schema rejects key_quotes: []');
else ko('schema rejects key_quotes: []', 'expected validation failure');

// cgs_tags minItems:1
const noTags = [{ ...hero, cgs_tags: [] }];
if (!validate(noTags)) ok('schema rejects cgs_tags: []');
else ko('schema rejects cgs_tags: []', 'expected validation failure');

// ---------------------------------------------------------------------------
// § 2A — fixture schemas (scripted_queries.json, offline_cache.json, precedents.json)
// ---------------------------------------------------------------------------
console.log('\n--- 2A  fixture schemas ---');

function loadJson(p, label) {
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    ok(`${label} is valid JSON`);
    return raw;
  } catch (e) {
    ko(`${label} is valid JSON`, e.message);
    return null;
  }
}

function validateAgainst(schemaRelPath, dataRelPath, label) {
  const schemaFull = path.join(ROOT, 'fixtures', schemaRelPath);
  const dataFull = path.join(ROOT, 'fixtures', dataRelPath);
  if (!fs.existsSync(schemaFull)) {
    ko(`${label} schema exists`, `missing: ${schemaFull}`);
    return;
  }
  if (!fs.existsSync(dataFull)) {
    ko(`${label} data file exists`, `missing: ${dataFull}`);
    return;
  }
  const schemaObj = loadJson(schemaFull, `${label} schema JSON`);
  const dataObj = loadJson(dataFull, `${label} data JSON`);
  if (!schemaObj || dataObj === null) return;
  try {
    const v = ajv.compile(schemaObj);
    if (v(dataObj)) ok(`${label} validates against schema`);
    else ko(`${label} validates against schema`, JSON.stringify(v.errors, null, 2));
  } catch (e) {
    ko(`${label} schema compiles`, e.message);
  }
}

validateAgainst('scripted_queries.schema.json', 'scripted_queries.json', 'scripted_queries.json');
validateAgainst('offline_cache.schema.json', 'offline_cache.json', 'offline_cache.json');
validateAgainst('precedents.schema.json', 'precedents.json', 'precedents.json');
validateAgainst('override_cache.schema.json', 'override_cache.json', 'override_cache.json');

// --- Phase 2C continuity email fixtures ---
(function validateContinuityFixtures() {
  const schemaRel = 'continuity_fixtures/email-fixture.schema.json';
  const files = [
    'continuity_fixtures/pass.json',
    'continuity_fixtures/borderline.json',
    'continuity_fixtures/high-risk.json',
  ];
  const schemaFull = path.join(ROOT, 'fixtures', schemaRel);
  if (!fs.existsSync(schemaFull)) {
    ko('continuity email-fixture.schema.json exists', `missing: ${schemaFull}`);
    return;
  }
  let schemaObj;
  try {
    schemaObj = JSON.parse(fs.readFileSync(schemaFull, 'utf8'));
    ok('continuity email-fixture.schema.json is valid JSON');
  } catch (e) {
    ko('continuity email-fixture.schema.json is valid JSON', e.message);
    return;
  }
  let v;
  try {
    v = ajv.compile(schemaObj);
    ok('continuity email-fixture schema compiles under ajv');
  } catch (e) {
    ko('continuity email-fixture schema compiles under ajv', e.message);
    return;
  }
  for (const rel of files) {
    const full = path.join(ROOT, 'fixtures', rel);
    if (!fs.existsSync(full)) {
      ko(`${rel} exists`, `missing: ${full}`);
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
    if (v(data)) ok(`${rel} validates against email-fixture schema`);
    else ko(`${rel} validates against email-fixture schema`, JSON.stringify(v.errors, null, 2));
    // id matches expected_verdict
    if (data.id === data.expected_verdict)
      ok(`${rel} id matches expected_verdict`);
    else
      ko(`${rel} id matches expected_verdict`, `id=${data.id} verdict=${data.expected_verdict}`);
  }
})();

// Override-cache uniqueness invariant on (dimension, bucket) — plan §6.5
// correctness callout + cache-loader.ts runtime throw. Enforced here so
// CI catches a bad hand-edit before runtime.
try {
  const oc = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'override_cache.json'), 'utf8'));
  const entries = Array.isArray(oc.entries) ? oc.entries : [];
  const seen = new Set();
  const dupes = [];
  for (const e of entries) {
    const key = `${e.dimension}:${e.bucket}`;
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  if (dupes.length === 0) ok('override_cache entries have unique (dimension, bucket) keys');
  else ko('override_cache entries have unique (dimension, bucket) keys', `duplicates: ${dupes.join(', ')}`);
} catch (e) {
  ko('override_cache uniqueness check', e.message);
}

// Scripted-query uniqueness after trim (plan §5.9 risk §6.3 invariant).
try {
  const sqPath = path.join(ROOT, 'fixtures', 'scripted_queries.json');
  const sq = JSON.parse(fs.readFileSync(sqPath, 'utf8'));
  const trimmed = sq.map((e) => e.query.trim());
  const set = new Set(trimmed);
  if (set.size === trimmed.length) ok('scripted_queries[].query values are unique after trim');
  else ko('scripted_queries[].query values are unique after trim', `${trimmed.length} total / ${set.size} unique`);
} catch (e) {
  ko('scripted_queries uniqueness check', e.message);
}

// Offline-cache entries must share a .query with some scripted_queries entry
// (the lookup path is scripted-only per plan §5.9). Empty set is valid.
try {
  const sq = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'scripted_queries.json'), 'utf8'));
  const oc = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'offline_cache.json'), 'utf8'));
  const sqQueries = new Set(sq.map((e) => e.query.trim()));
  const orphan = oc.entries.filter((e) => !sqQueries.has(e.query.trim()));
  if (orphan.length === 0) ok('offline_cache entries all have a matching scripted_queries.query');
  else ko('offline_cache entries all have a matching scripted_queries.query', `orphan keys: ${orphan.map((o) => o.query).join(', ')}`);
} catch (e) {
  ko('offline_cache → scripted_queries linkage check', e.message);
}

// ---------------------------------------------------------------------------
// § 4.x — Phase 4 fixture schemas (dashboard / datahub / thesis)
// ---------------------------------------------------------------------------
console.log('\n--- 4.x  Phase 4 fixture schemas ---');

(function validatePhase4Fixtures() {
  const triples = [
    ['dashboard_fixtures/dashboard.schema.json', 'dashboard_fixtures/dashboard.json', 'dashboard.json'],
    ['datahub_fixtures/datahub.schema.json', 'datahub_fixtures/datahub.json', 'datahub.json'],
    ['thesis_fixtures/thesis.schema.json', 'thesis_fixtures/thesis.json', 'thesis.json'],
  ];
  for (const [schemaRel, dataRel, label] of triples) {
    const schemaFull = path.join(ROOT, 'fixtures', schemaRel);
    const dataFull = path.join(ROOT, 'fixtures', dataRel);
    if (!fs.existsSync(schemaFull)) {
      ko(`${label} schema exists`, `missing: ${schemaFull}`);
      continue;
    }
    if (!fs.existsSync(dataFull)) {
      ko(`${label} fixture exists`, `missing: ${dataFull}`);
      continue;
    }
    let schemaObj;
    try {
      schemaObj = JSON.parse(fs.readFileSync(schemaFull, 'utf8'));
      ok(`${label} schema is valid JSON`);
    } catch (e) {
      ko(`${label} schema is valid JSON`, e.message);
      continue;
    }
    let dataObj;
    try {
      dataObj = JSON.parse(fs.readFileSync(dataFull, 'utf8'));
      ok(`${label} fixture is valid JSON`);
    } catch (e) {
      ko(`${label} fixture is valid JSON`, e.message);
      continue;
    }
    try {
      const v = ajv.compile(schemaObj);
      if (v(dataObj)) ok(`${label} validates against schema`);
      else ko(`${label} validates against schema`, JSON.stringify(v.errors, null, 2));
    } catch (e) {
      ko(`${label} schema compiles`, e.message);
    }
  }
})();

// ---------------------------------------------------------------------------
// § 3.2 — Phase 3 diagnostic-fixture.schema.json (skip-when-missing for F1-F5)
// ---------------------------------------------------------------------------
console.log('\n--- 3.2  diagnostic-fixture schema (Phase 3) ---');

(function validateDiagnosticFixtures() {
  const schemaRel = 'diagnostic_fixtures/diagnostic-fixture.schema.json';
  const schemaFull = path.join(ROOT, 'fixtures', schemaRel);
  if (!fs.existsSync(schemaFull)) {
    ko('diagnostic-fixture.schema.json exists', `missing: ${schemaFull}`);
    return;
  }
  let schemaObj;
  try {
    schemaObj = JSON.parse(fs.readFileSync(schemaFull, 'utf8'));
    ok('diagnostic-fixture.schema.json is valid JSON');
  } catch (e) {
    ko('diagnostic-fixture.schema.json is valid JSON', e.message);
    return;
  }
  try {
    ajv.compile(schemaObj);
    ok('diagnostic-fixture schema compiles under ajv');
  } catch (e) {
    ko('diagnostic-fixture schema compiles under ajv', e.message);
    return;
  }
  // definitions F1-F5 + InertiaHypothesis exist
  const defs = schemaObj.definitions ?? {};
  for (const name of ['F1', 'F2', 'F3', 'F4', 'F5', 'InertiaHypothesis']) {
    if (defs[name]) ok(`diagnostic-fixture schema defines ${name}`);
    else ko(`diagnostic-fixture schema defines ${name}`, 'definition missing');
  }
  // Validate each file when present (skip when absent — pre-gen state).
  for (const F of ['f1', 'f2', 'f3', 'f4', 'f5']) {
    const p = path.join(ROOT, 'fixtures', 'diagnostic_fixtures', `${F}.json`);
    if (!fs.existsSync(p)) {
      ok(`${F}.json absent (Phase 3.2 gen pending) — skipping validation`);
      continue;
    }
    let data;
    try {
      data = JSON.parse(fs.readFileSync(p, 'utf8'));
      ok(`${F}.json is valid JSON`);
    } catch (e) {
      ko(`${F}.json is valid JSON`, e.message);
      continue;
    }
    try {
      const defName = F.toUpperCase();
      const sub = schemaObj.definitions?.[defName];
      if (!sub) {
        ko(`${F}.json definition ${defName} lookup`, 'not found in schema');
        continue;
      }
      const vDef = ajv.compile(sub);
      if (vDef(data)) ok(`${F}.json validates against ${defName}`);
      else ko(`${F}.json validates against ${defName}`, JSON.stringify(vDef.errors, null, 2));
    } catch (e) {
      ko(`${F}.json validation`, e.message);
    }
  }
})();

// ---------------------------------------------------------------------------
// § 0.3 — .env.local.example content
// ---------------------------------------------------------------------------
console.log('\n--- 0.3  .env.local.example ---');

const envPath = path.join(ROOT, '.env.local.example');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
  ok('.env.local.example exists');
} catch (e) {
  ko('.env.local.example exists', e.message);
}

const REQUIRED_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_EMBED_MODEL',
  'NEXT_PUBLIC_PREFLIGHT_TIMEOUT_MS',
];
for (const v of REQUIRED_VARS) {
  if (envContent.includes(v)) ok(`.env.local.example contains ${v}`);
  else ko(`.env.local.example contains ${v}`, 'variable not found');
}

// placeholders only — no real keys
const hasRealAnthropic = /ANTHROPIC_API_KEY=sk-ant-[A-Za-z0-9]{20,}/.test(envContent);
const hasRealOpenAI    = /OPENAI_API_KEY=sk-[A-Za-z0-9]{20,}/.test(envContent);
if (!hasRealAnthropic) ok('.env.local.example has no real Anthropic key (placeholder only)');
else ko('.env.local.example has no real Anthropic key', 'looks like a real key is present — remove it');
if (!hasRealOpenAI) ok('.env.local.example has no real OpenAI key (placeholder only)');
else ko('.env.local.example has no real OpenAI key', 'looks like a real key is present — remove it');

// ---------------------------------------------------------------------------
// § 0.3 — .gitignore
// ---------------------------------------------------------------------------
console.log('\n--- 0.3  .gitignore ---');

const gitignorePath = path.join(ROOT, '.gitignore');
let gitignore = '';
try {
  gitignore = fs.readFileSync(gitignorePath, 'utf8');
  ok('.gitignore exists');
} catch (e) {
  ko('.gitignore exists', e.message);
}

const REQUIRED_IGNORES = [
  ['.env.local',         /^\.env\.local$/m],
  ['.env*.local',        /^\.env\*\.local$/m],
  ['node_modules/',      /^node_modules\/$/m],
  ['.next/',             /^\.next\/$/m],
  ['dist/',              /^dist\/$/m],
  ['out/',               /^out\/$/m],
  ['src-tauri/target/',  /^src-tauri\/target\/$/m],
  ['*.log',              /^\*\.log$/m],
  ['.DS_Store',          /^\.DS_Store$/m],
];
for (const [label, re] of REQUIRED_IGNORES) {
  if (re.test(gitignore)) ok(`.gitignore contains ${label}`);
  else ko(`.gitignore contains ${label}`, `pattern not found: ${re}`);
}

// .env.local must NOT be committed (file should not exist in repo sense;
// we just verify .gitignore covers it — done above)

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`Phase 0 tests: ${pass.length} passed, ${fail.length} failed`);
if (fail.length > 0) {
  console.error(`\nFailed tests:\n${fail.map(f => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('All Phase 0 acceptance criteria GREEN.');
process.exit(0);
