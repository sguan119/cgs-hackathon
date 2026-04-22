// scripts/gen-scripted-query-embeddings.ts — phase-3-plan §4.1b.
//
// Sibling of gen-precedent-embeddings: same batched OpenAI embed path,
// different source fixture. Text to embed is ScriptedQuery.query verbatim.
//
// Usage: pnpm gen:scripted-query-embeddings [--dry-run] [--only <id>] [--verbose]

import * as fs from 'node:fs';
import * as path from 'node:path';
import { withRetry } from '@/lib/llm/retry';
import { parseArgs, printHelp } from '@/scripts/lib/args';
import { embeddingDelta } from '@/scripts/lib/diff';
import { loadEnv, requireEnv } from '@/scripts/lib/env';
import { createLogger } from '@/scripts/lib/logger';
import { embedBatch } from '@/scripts/lib/openai-embed';
import { loadSchema, validateOrThrow } from '@/scripts/lib/schema';

const LABEL = 'gen:scripted-query-embeddings';
const ROOT = path.resolve(__dirname, '..');
const QUERIES_PATH = path.join(ROOT, 'fixtures', 'scripted_queries.json');
const SCHEMA_PATH = path.join(ROOT, 'fixtures', 'scripted_queries.schema.json');

type ScriptedQuery = {
  id: string;
  query: string;
  embedding: number[];
  expected_precedent_ids?: string[];
  category: 'first-hit' | 'follow-up' | 'fallback-trigger' | 'safety-net';
  notes?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const logger = createLogger(LABEL, { verbose: args.verbose });
  if (args.help) {
    printHelp(
      LABEL,
      'Reads fixtures/scripted_queries.json, batch-embeds each query via OpenAI, writes back.\n' +
        'Flags: --dry-run | --only <query_id> | --verbose'
    );
    return;
  }

  loadEnv();
  const apiKey = requireEnv('OPENAI_API_KEY', LABEL);
  const model = process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small';

  const compiled = loadSchema(SCHEMA_PATH);
  const raw = fs.readFileSync(QUERIES_PATH, 'utf8');
  const queries = JSON.parse(raw) as ScriptedQuery[];
  validateOrThrow(compiled.validate, queries, LABEL);

  // Fail fast when a source query contains a TODO sentinel — content owner
  // incomplete (plan §7.1).
  const todoQueries = queries.filter((q) => /TODO/i.test(q.query));
  if (todoQueries.length > 0) {
    throw new Error(
      `[${LABEL}] scripted_queries.json has ${todoQueries.length} entries containing TODO — complete content first: ${todoQueries.map((q) => q.id).join(', ')}`
    );
  }

  const targets = args.only ? queries.filter((q) => q.id === args.only) : queries;
  if (args.only && targets.length === 0) {
    throw new Error(`[${LABEL}] --only ${args.only} did not match any scripted_query id`);
  }

  const items = targets.map((q) => ({ key: q.id, text: q.query.trim() }));

  logger.info(
    `embedding ${items.length} scripted_quer${items.length === 1 ? 'y' : 'ies'} with model=${model}`
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
  const updated = queries.map((q) => {
    const v = byKey.get(q.id);
    if (!v) return q;
    return { ...q, embedding: v };
  });
  validateOrThrow(compiled.validate, updated, LABEL);

  for (const q of targets) {
    const newEmb = byKey.get(q.id) ?? [];
    logger.info(`  [${q.id}] ${embeddingDelta(q.embedding, newEmb)}`);
  }

  if (args.dryRun) {
    logger.info(`DRY RUN — no writes. usage=${JSON.stringify(result.usage)} elapsed=${elapsed}ms`);
    return;
  }

  const serialized = JSON.stringify(updated, null, 2) + '\n';
  const tmp = `${QUERIES_PATH}.tmp`;
  fs.writeFileSync(tmp, serialized, 'utf8');
  fs.renameSync(tmp, QUERIES_PATH);
  logger.info(
    `wrote ${updated.length} entries | usage=${JSON.stringify(result.usage)} | ${elapsed}ms`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[${LABEL}] ${(err as Error).message}`);
  process.exit(1);
});
