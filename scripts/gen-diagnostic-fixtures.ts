// scripts/gen-diagnostic-fixtures.ts — impl-plan §3.2 / phase-3-plan §4.2.
//
// Reads fixtures/acme_fixtures/{memo,org,call}.md + fixtures/precedents.json,
// calls Claude sequentially F1 → F2 → F3 → F4 → F5, writes each output to
// fixtures/diagnostic_fixtures/<F>.json. Each call validated against the
// corresponding diagnostic-fixture.schema.json definition before write.
//
// NOTE: Claude outputs are non-deterministic even at temperature=0.
// Re-running this script produces semantically similar but textually
// different fixtures. Engineer reviews + commits the output; the committed
// JSON is the source of truth for Phase 4.2 rendering.
//
// Usage: pnpm gen:diagnostic-fixtures [--dry-run] [--confirm] [--only f1..f5] [--verbose]

import * as fs from 'node:fs';
import * as path from 'node:path';
import { withRetry } from '@/lib/llm/retry';
import { parseArgs, printHelp } from '@/scripts/lib/args';
import { callClaudeOnce, extractJson } from '@/scripts/lib/claude-call';
import { loadEnv, requireEnv } from '@/scripts/lib/env';
import { createLogger } from '@/scripts/lib/logger';
import { compileDefinition, loadSchema, validateOrThrow } from '@/scripts/lib/schema';
import { JSON_ONLY_REMINDER } from '@/scripts/lib/tags-prompt';

const LABEL = 'gen:diagnostic-fixtures';
const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(
  ROOT,
  'fixtures',
  'diagnostic_fixtures',
  'diagnostic-fixture.schema.json'
);
const OUT_DIR = path.join(ROOT, 'fixtures', 'diagnostic_fixtures');
const ACME_DIR = path.join(ROOT, 'fixtures', 'acme_fixtures');
const GEN_CACHE = path.join(ROOT, 'scripts', '.gen-cache');

type FKey = 'f1' | 'f2' | 'f3' | 'f4' | 'f5';
const ORDER: FKey[] = ['f1', 'f2', 'f3', 'f4', 'f5'];
const DEF_NAME: Record<FKey, string> = {
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  f4: 'F4',
  f5: 'F5',
};

function assertNoTodos(): void {
  const files = ['memo.md', 'org.md', 'call.md'];
  const todo: string[] = [];
  for (const f of files) {
    const p = path.join(ACME_DIR, f);
    if (!fs.existsSync(p)) {
      throw new Error(
        `[${LABEL}] acme_fixtures/${f} missing — content-owner deliverable pending (impl-plan §3.A)`
      );
    }
    const body = fs.readFileSync(p, 'utf8');
    if (/TODO:/i.test(body)) todo.push(f);
  }
  if (todo.length > 0) {
    throw new Error(
      `[${LABEL}] TODO sentinel present in: ${todo.join(', ')} — content-owner fill required before gen`
    );
  }
}

function promptFor(f: FKey): string {
  switch (f) {
    case 'f1':
      return [
        'Using only the attached Acme materials (memo.md, org.md, call.md) and the precedent library,',
        'produce F1 external-pressure signals.',
        'Extract 3–5 verbatim quotes attributable to specific source_ids.',
        'Do not invent signals not grounded in the source text.',
        'Return JSON: { headline: string, signals: [{source_id, quote, observed_at}], generated_at, model }',
        JSON_ONLY_REMINDER,
      ].join('\n');
    case 'f2':
      return [
        'Produce F2 wheel re-color map for the 7 Strategy Wheel dimensions.',
        'Scores are integers 1-7 per dimension (strategic_innovation is the hero-low cell).',
        'color_sequence is the animation order the Diagnostic page replays on mount.',
        'Return JSON: { scores, color_sequence, generated_at, model }',
        JSON_ONLY_REMINDER,
      ].join('\n');
    case 'f3':
      return [
        'Produce F3 authored inertia hypotheses.',
        'Each hypothesis must cite evidence via source_id + verbatim quote.',
        'intervention_ids reference F4 intervention slugs (prefix int-).',
        'Return JSON: { hypotheses: InertiaHypothesis[], rationale, generated_at, model }',
        JSON_ONLY_REMINDER,
      ].join('\n');
    case 'f4':
      return [
        'Produce F4 intervention candidates linked to F3 hypotheses.',
        'Each has id (slug with int- prefix), label, body, linked_hypotheses, horizon.',
        'Return JSON: { interventions, generated_at, model }',
        JSON_ONLY_REMINDER,
      ].join('\n');
    case 'f5':
      return [
        'Produce F5 interview questions menu covering key stakeholders.',
        'Each question links_to_hypothesis (F3 id) or null.',
        'Return JSON: { questions, generated_at, model }',
        JSON_ONLY_REMINDER,
      ].join('\n');
  }
}

async function runOne(
  f: FKey,
  modelLabel: string,
  logger: ReturnType<typeof createLogger>
): Promise<Record<string, unknown>> {
  const prompt = promptFor(f);
  const res = await withRetry(
    () =>
      callClaudeOnce({
        mode: 'override',
        clientId: 'acme',
        query: prompt,
        maxTokens: 4096,
        timeoutMs: 60_000,
      }),
    {
      onAttempt: (a) => logger.debug(`${f} attempt ${a}`),
      onRetryWait: (a, w) => logger.warn(`${f} transient — retry ${a} in ${w}ms`),
    }
  );
  logger.info(
    `${f} ok — ${res.latencyMs}ms usage=${JSON.stringify(res.usage)} model=${modelLabel}`
  );
  let parsed: unknown;
  try {
    parsed = extractJson(res.fullText);
  } catch (err) {
    fs.mkdirSync(GEN_CACHE, { recursive: true });
    const dump = path.join(GEN_CACHE, `${f}-raw.txt`);
    fs.writeFileSync(dump, res.fullText, 'utf8');
    throw new Error(
      `[${LABEL}] ${f} JSON parse failed — raw output at ${dump}: ${(err as Error).message}`
    );
  }
  const obj = parsed as Record<string, unknown>;
  obj['generated_at'] = obj['generated_at'] ?? new Date().toISOString();
  obj['model'] = obj['model'] ?? modelLabel;
  return obj;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const logger = createLogger(LABEL, { verbose: args.verbose });
  if (args.help) {
    printHelp(
      LABEL,
      'Runs F1→F5 Claude pre-compute over Acme fixtures, writes diagnostic_fixtures/<F>.json.\n' +
        'Flags: --dry-run | --confirm (required to overwrite) | --only f1|..|f5 | --verbose'
    );
    return;
  }

  loadEnv();
  requireEnv('ANTHROPIC_API_KEY', LABEL);
  assertNoTodos();

  const modelLabel = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
  const compiled = loadSchema(SCHEMA_PATH);

  const targets: FKey[] = args.only
    ? (() => {
        const t = args.only as FKey;
        if (!ORDER.includes(t)) {
          throw new Error(`[${LABEL}] --only must be one of f1|f2|f3|f4|f5; got ${args.only}`);
        }
        return [t];
      })()
    : ORDER;

  // Upstream dependency check for --only f3/f4/f5.
  if (args.only) {
    const t = args.only as FKey;
    const upstream: Record<FKey, FKey[]> = {
      f1: [],
      f2: [],
      f3: ['f1', 'f2'],
      f4: ['f3'],
      f5: ['f3', 'f4'],
    };
    for (const up of upstream[t]) {
      const p = path.join(OUT_DIR, `${up}.json`);
      if (!fs.existsSync(p)) {
        throw new Error(
          `[${LABEL}] --only ${t} requires ${up}.json to exist; run upstream gen first`
        );
      }
    }
  }

  // Refuse to clobber an existing file without --confirm.
  if (!args.dryRun && !args.confirm) {
    const existing = targets.filter((f) => fs.existsSync(path.join(OUT_DIR, `${f}.json`)));
    if (existing.length > 0) {
      throw new Error(
        `[${LABEL}] target file(s) already exist: ${existing
          .map((f) => `${f}.json`)
          .join(', ')} — pass --confirm to overwrite or --dry-run to preview`
      );
    }
  }

  for (const f of targets) {
    const obj = await runOne(f, modelLabel, logger);
    const subValidate = compileDefinition(compiled, DEF_NAME[f]);
    validateOrThrow(subValidate, obj, `${LABEL}:${f}`);
    const outPath = path.join(OUT_DIR, `${f}.json`);
    if (args.dryRun) {
      logger.info(`DRY RUN — ${f}.json would be written (${Object.keys(obj).length} top-level keys)`);
      continue;
    }
    const serialized = JSON.stringify(obj, null, 2) + '\n';
    const tmp = `${outPath}.tmp`;
    fs.writeFileSync(tmp, serialized, 'utf8');
    fs.renameSync(tmp, outPath);
    logger.info(`wrote ${f}.json (${Buffer.byteLength(serialized, 'utf8')} bytes)`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[${LABEL}] ${(err as Error).message}`);
  process.exit(1);
});
