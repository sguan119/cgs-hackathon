// scripts/gen-precedent-embeddings.ts — impl-plan §3.1 / phase-3-plan §4.1.
//
// Manual one-shot: reads fixtures/precedents.json, sends each precedent's
// concatenated content to OpenAI text-embedding-3-small via batched
// /v1/embeddings, writes back the 1536-d vector on each entry. Deterministic
// given stable input + model.
//
// Usage: pnpm gen:precedent-embeddings [--dry-run] [--only <id>] [--verbose]
//
// Dry-run never writes. Non-transient errors (401 / 400) exit 1 with a
// clear message.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { withRetry } from '@/lib/llm/retry';
import { parseArgs, printHelp } from '@/scripts/lib/args';
import { embeddingDelta } from '@/scripts/lib/diff';
import { loadEnv, requireEnv } from '@/scripts/lib/env';
import { createLogger } from '@/scripts/lib/logger';
import { embedBatch } from '@/scripts/lib/openai-embed';
import { loadSchema, validateOrThrow } from '@/scripts/lib/schema';

const LABEL = 'gen:precedent-embeddings';
const ROOT = path.resolve(__dirname, '..');
const PRECEDENTS_PATH = path.join(ROOT, 'fixtures', 'precedents.json');
const SCHEMA_PATH = path.join(ROOT, 'fixtures', 'precedents.schema.json');

type Precedent = {
  id: string;
  client_name: string;
  year: number;
  industry: string;
  summary: string;
  scene: string;
  key_quotes: string[];
  cgs_tags: string[];
  source_id: string;
  embedding: number[];
  drilldown_layers: Array<{
    depth: 1 | 2 | 3;
    theme: string;
    quotes: string[];
    key_facts: Array<{ label: string; value: string }>;
  }>;
  metadata?: Record<string, unknown>;
};

function concatFields(p: Precedent): string {
  const drilldownQuotes = p.drilldown_layers.flatMap((l) => l.quotes).join(' / ');
  return [
    `${p.client_name} ${p.year} — ${p.scene}`,
    p.summary,
    `Tags: ${p.cgs_tags.join(', ')}`,
    p.key_quotes.join(' / '),
    drilldownQuotes,
  ].join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const logger = createLogger(LABEL, { verbose: args.verbose });
  if (args.help) {
    printHelp(
      LABEL,
      'Reads fixtures/precedents.json, computes OpenAI embeddings in one batch call, writes back.\n' +
        'Flags: --dry-run (no writes) | --only <precedent_id> | --verbose'
    );
    return;
  }

  loadEnv();
  const apiKey = requireEnv('OPENAI_API_KEY', LABEL);
  const model = process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small';

  const compiled = loadSchema(SCHEMA_PATH);
  const raw = fs.readFileSync(PRECEDENTS_PATH, 'utf8');
  const precedents = JSON.parse(raw) as Precedent[];
  validateOrThrow(compiled.validate, precedents, LABEL);

  const targetPrecedents = args.only
    ? precedents.filter((p) => p.id === args.only)
    : precedents;
  if (args.only && targetPrecedents.length === 0) {
    throw new Error(`[${LABEL}] --only ${args.only} did not match any precedent id`);
  }

  const items = targetPrecedents.map((p) => ({
    key: p.id,
    text: concatFields(p),
  }));

  logger.info(
    `embedding ${items.length} precedent${items.length === 1 ? '' : 's'} with model=${model}`
  );

  const started = Date.now();
  const result = await withRetry(
    () => embedBatch(items, { apiKey, model }),
    {
      onAttempt: (a) => logger.debug(`attempt ${a}`),
      onRetryWait: (a, w) => logger.warn(`transient error — retry ${a} in ${w}ms`),
    }
  );
  const elapsed = Date.now() - started;

  const byKey = new Map(result.embeddings.map((e) => [e.key, e.vector]));
  const updated: Precedent[] = precedents.map((p) => {
    const v = byKey.get(p.id);
    if (!v) return p;
    return { ...p, embedding: v };
  });
  validateOrThrow(compiled.validate, updated, LABEL);

  // Dry-run: report diff, don't write.
  for (const p of targetPrecedents) {
    const oldEmb = p.embedding;
    const newEmb = byKey.get(p.id) ?? [];
    logger.info(`  [${p.id}] ${embeddingDelta(oldEmb, newEmb)}`);
  }

  if (args.dryRun) {
    logger.info(`DRY RUN — no writes. usage=${JSON.stringify(result.usage)} elapsed=${elapsed}ms`);
    return;
  }

  // Atomic write: tmp + rename.
  const bytesBefore = Buffer.byteLength(raw, 'utf8');
  const serialized = JSON.stringify(updated, null, 2) + '\n';
  const tmp = `${PRECEDENTS_PATH}.tmp`;
  fs.writeFileSync(tmp, serialized, 'utf8');
  fs.renameSync(tmp, PRECEDENTS_PATH);
  const bytesAfter = Buffer.byteLength(serialized, 'utf8');

  const outOfRange = updated.filter((p) => p.embedding.length !== 1536);
  if (outOfRange.length > 0) {
    logger.warn(
      `${outOfRange.length} of ${updated.length} entries do not have 1536-d embeddings (ids: ${outOfRange.map((p) => p.id).join(', ')})`
    );
  }

  logger.info(
    `wrote ${updated.length} entries | ${bytesBefore} -> ${bytesAfter} bytes | usage=${JSON.stringify(
      result.usage
    )} | ${elapsed}ms`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[${LABEL}] ${(err as Error).message}`);
  process.exit(1);
});
