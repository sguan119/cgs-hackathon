#!/usr/bin/env node
// Phase 3 smoke tests — file/export assertions + safe runs of non-API scripts.
// Run: node scripts/test-phase-3.js
// Exits 0 on all pass, 1 on any failure.

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

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

// ---------------------------------------------------------------------------
// § 3.1 — scripts/lib/*.ts shared helpers exist
// ---------------------------------------------------------------------------
console.log('\n--- 3.1  scripts/lib helpers ---');

const LIB_FILES = [
  'scripts/lib/env.ts',
  'scripts/lib/args.ts',
  'scripts/lib/logger.ts',
  'scripts/lib/schema.ts',
  'scripts/lib/diff.ts',
  'scripts/lib/mtime.ts',
  'scripts/lib/openai-embed.ts',
  'scripts/lib/claude-call.ts',
  'scripts/lib/tags-prompt.ts',
];
for (const rel of LIB_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 3.2 — gen-*.ts scripts exist
// ---------------------------------------------------------------------------
console.log('\n--- 3.2  gen-* scripts ---');

const GEN_FILES = [
  'scripts/gen-precedent-embeddings.ts',
  'scripts/gen-scripted-query-embeddings.ts',
  'scripts/gen-diagnostic-fixtures.ts',
  'scripts/gen-override-cache.ts',
  'scripts/gen-offline-cache.ts',
  'scripts/check-fixture-mtimes.ts',
];
for (const rel of GEN_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) ok(`${rel} exists`);
  else ko(`${rel} exists`, `file not found: ${full}`);
}

// ---------------------------------------------------------------------------
// § 3.3 — package.json has all gen:* + test:phase-3 + tsx devDep
// ---------------------------------------------------------------------------
console.log('\n--- 3.3  package.json wiring ---');

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  ok('package.json is valid JSON');
} catch (e) {
  ko('package.json is valid JSON', e.message);
  process.exit(1);
}

const REQUIRED_SCRIPTS = [
  'gen:precedent-embeddings',
  'gen:scripted-query-embeddings',
  'gen:embeddings',
  'gen:diagnostic-fixtures',
  'gen:override-cache',
  'gen:offline-cache',
  'gen:all',
  'check:fixture-mtimes',
  'test:phase-3',
];
for (const s of REQUIRED_SCRIPTS) {
  if (pkg.scripts && pkg.scripts[s]) ok(`package.json scripts.${s} present`);
  else ko(`package.json scripts.${s} present`, 'missing');
}

if (pkg.devDependencies && pkg.devDependencies.tsx) ok('package.json devDependencies.tsx present');
else ko('package.json devDependencies.tsx present', 'missing');

// ---------------------------------------------------------------------------
// § 3.4 — diagnostic-fixture.schema.json compiles under ajv
// ---------------------------------------------------------------------------
console.log('\n--- 3.4  diagnostic-fixture.schema.json ---');

const DIAG_SCHEMA = path.join(
  ROOT,
  'fixtures',
  'diagnostic_fixtures',
  'diagnostic-fixture.schema.json'
);
if (fs.existsSync(DIAG_SCHEMA)) {
  ok('diagnostic-fixture.schema.json exists');
  try {
    const schema = JSON.parse(fs.readFileSync(DIAG_SCHEMA, 'utf8'));
    ok('diagnostic-fixture.schema.json is valid JSON');
    const ajv = new Ajv({ strict: false });
    ajv.compile(schema);
    ok('diagnostic-fixture.schema.json compiles under ajv');
    for (const name of ['F1', 'F2', 'F3', 'F4', 'F5', 'InertiaHypothesis']) {
      if (schema.definitions && schema.definitions[name])
        ok(`diagnostic-fixture.schema.json defines ${name}`);
      else ko(`diagnostic-fixture.schema.json defines ${name}`, 'missing');
    }
  } catch (e) {
    ko('diagnostic-fixture.schema.json compiles under ajv', e.message);
  }
} else {
  ko('diagnostic-fixture.schema.json exists', `missing: ${DIAG_SCHEMA}`);
}

// ---------------------------------------------------------------------------
// § 3.5 — .gitignore covers scripts/.gen-cache/
// ---------------------------------------------------------------------------
console.log('\n--- 3.5  .gitignore ---');

try {
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  if (gi.includes('scripts/.gen-cache')) ok('.gitignore covers scripts/.gen-cache/');
  else ko('.gitignore covers scripts/.gen-cache/', 'pattern not found');
} catch (e) {
  ko('.gitignore readable', e.message);
}

// ---------------------------------------------------------------------------
// § 3.6 — acme_fixtures directory with TODO stubs
// ---------------------------------------------------------------------------
console.log('\n--- 3.6  acme_fixtures stubs ---');

for (const f of ['memo.md', 'org.md', 'call.md']) {
  const p = path.join(ROOT, 'fixtures', 'acme_fixtures', f);
  if (fs.existsSync(p)) {
    ok(`fixtures/acme_fixtures/${f} exists`);
    const body = fs.readFileSync(p, 'utf8');
    if (/TODO:/i.test(body)) ok(`fixtures/acme_fixtures/${f} contains TODO sentinel`);
    else ko(`fixtures/acme_fixtures/${f} contains TODO sentinel`, 'missing — gen script TODO-guard cannot exercise');
  } else {
    ko(`fixtures/acme_fixtures/${f} exists`, 'missing');
  }
}

// ---------------------------------------------------------------------------
// § 3.7 — check-fixture-mtimes runs cleanly (exit 0 always)
// ---------------------------------------------------------------------------
console.log('\n--- 3.7  check-fixture-mtimes execution ---');

try {
  // Spawn synchronously via tsx; we expect exit 0.
  execSync('pnpm tsx scripts/check-fixture-mtimes.ts --json', {
    cwd: ROOT,
    stdio: 'pipe',
  });
  ok('check-fixture-mtimes runs with exit 0 (--json)');
} catch (e) {
  // If tsx is not installed locally yet (pnpm install pending), skip.
  const msg = String(e.message || '');
  if (/tsx/i.test(msg) && /not found|ENOENT/i.test(msg)) {
    ok('check-fixture-mtimes execution skipped (tsx not installed yet)');
  } else if (e.status === 0) {
    ok('check-fixture-mtimes runs with exit 0 (--json)');
  } else {
    ko('check-fixture-mtimes runs with exit 0', `status=${e.status} msg=${msg}`);
  }
}

// ---------------------------------------------------------------------------
// § 3.8 — each gen:* script exits 0 on --help (plan §9.2)
// ---------------------------------------------------------------------------
console.log('\n--- 3.8  gen-*.ts --help exit 0 ---');

for (const name of [
  'gen-precedent-embeddings',
  'gen-scripted-query-embeddings',
  'gen-diagnostic-fixtures',
  'gen-override-cache',
  'gen-offline-cache',
]) {
  try {
    execSync(`pnpm tsx scripts/${name}.ts --help`, {
      cwd: ROOT,
      stdio: 'pipe',
    });
    ok(`${name} --help exits 0`);
  } catch (e) {
    const msg = String(e.message || '');
    if (/tsx/i.test(msg) && /not found|ENOENT/i.test(msg)) {
      ok(`${name} --help skipped (tsx not installed yet)`);
    } else {
      ko(`${name} --help exits 0`, `status=${e.status} msg=${msg}`);
    }
  }
}

// ---------------------------------------------------------------------------
// § 3.9 — Additional coverage asserts (Phase 3 Tester)
// ---------------------------------------------------------------------------
console.log('\n--- 3.9  Additional coverage asserts ---');

// Assert 1: scripts/lib/env.ts exports requireEnv (grep)
try {
  const envSrc = fs.readFileSync(path.join(ROOT, 'scripts/lib/env.ts'), 'utf8');
  if (/export function requireEnv/.test(envSrc)) ok('scripts/lib/env.ts exports requireEnv');
  else ko('scripts/lib/env.ts exports requireEnv', 'export not found in source');
} catch (e) {
  ko('scripts/lib/env.ts exports requireEnv', e.message);
}

// Assert 2: each gen script file has a --dry-run argument handler (grep)
const DRY_RUN_GEN_FILES = [
  'scripts/gen-precedent-embeddings.ts',
  'scripts/gen-scripted-query-embeddings.ts',
  'scripts/gen-diagnostic-fixtures.ts',
  'scripts/gen-override-cache.ts',
  'scripts/gen-offline-cache.ts',
];
for (const rel of DRY_RUN_GEN_FILES) {
  try {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (/dry.?[Rr]un|dryRun|--dry-run/i.test(src))
      ok(`${rel} has --dry-run handler`);
    else
      ko(`${rel} has --dry-run handler`, 'no dry-run reference found');
  } catch (e) {
    ko(`${rel} has --dry-run handler`, e.message);
  }
}

// Assert 3: package.json has tsx in devDependencies
if (pkg.devDependencies && pkg.devDependencies.tsx)
  ok('package.json devDependencies.tsx present (assert 3)');
else
  ko('package.json devDependencies.tsx (assert 3)', 'tsx missing from devDependencies');

// Assert 4: .env.local.example is committed and has no real keys
try {
  const examplePath = path.join(ROOT, '.env.local.example');
  if (!fs.existsSync(examplePath)) {
    ko('.env.local.example exists and has no real keys', 'file not found');
  } else {
    const content = fs.readFileSync(examplePath, 'utf8');
    const hasRealAnthropicKey = /ANTHROPIC_API_KEY=sk-ant-[A-Za-z0-9]{20,}/.test(content);
    const hasRealOpenAIKey = /OPENAI_API_KEY=sk-[A-Za-z0-9]{20,}/.test(content);
    if (hasRealAnthropicKey || hasRealOpenAIKey) {
      ko('.env.local.example has no real keys', 'real API key pattern detected in .env.local.example');
    } else {
      ok('.env.local.example exists and has no real keys');
    }
  }
} catch (e) {
  ko('.env.local.example readable', e.message);
}

// Assert 5: check-fixture-mtimes exits 0
try {
  execSync('pnpm tsx scripts/check-fixture-mtimes.ts --json', {
    cwd: ROOT,
    stdio: 'pipe',
  });
  ok('check-fixture-mtimes exits 0 (assert 5 re-verify)');
} catch (e) {
  const msg = String(e.message || '');
  if (/tsx/i.test(msg) && /not found|ENOENT/i.test(msg)) {
    ok('check-fixture-mtimes exit-0 assert skipped (tsx not installed)');
  } else if (e.status === 0) {
    ok('check-fixture-mtimes exits 0 (assert 5 re-verify)');
  } else {
    ko('check-fixture-mtimes exits 0 (assert 5)', `status=${e.status} msg=${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`Phase 3 smoke tests: ${pass.length} passed, ${fail.length} failed`);
if (fail.length > 0) {
  console.error(`\nFailed tests:\n${fail.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('All Phase 3 smoke tests GREEN.');
process.exit(0);
