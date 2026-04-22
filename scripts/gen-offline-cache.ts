// scripts/gen-offline-cache.ts — impl-plan §3.4 / phase-3-plan §4.4.
//
// Pre-runs Claude Recall against each scripted query using in-process
// cosineTopK over the precedent library (reusing lib/retrieval/cosine.ts).
// Writes fixtures/offline_cache.json keyed by the exact scripted query
// string, used by Phase 2A when Anthropic is unreachable.
//
// Cost warning banner on start (plan §4.4) — do not re-run casually.
//
// Usage: pnpm gen:offline-cache [--dry-run] [--confirm] [--only <scripted_query_id>] [--verbose]

import * as fs from 'node:fs';
import * as path from 'node:path';
import { withRetry } from '@/lib/llm/retry';
import { cosineTopK } from '@/lib/retrieval/cosine';
import type { Precedent } from '@/lib/retrieval/types';
import { parseArgs, printHelp } from '@/scripts/lib/args';
import { callClaudeOnce } from '@/scripts/lib/claude-call';
import { loadEnv, requireEnv } from '@/scripts/lib/env';
import { createLogger } from '@/scripts/lib/logger';
import { loadSchema, validateOrThrow } from '@/scripts/lib/schema';

const LABEL = 'gen:offline-cache';
const ROOT = path.resolve(__dirname, '..');
const QUERIES_PATH = path.join(ROOT, 'fixtures', 'scripted_queries.json');
const PRECEDENTS_PATH = path.join(ROOT, 'fixtures', 'precedents.json');
const OFFLINE_PATH = path.join(ROOT, 'fixtures', 'offline_cache.json');
const OFFLINE_SCHEMA_PATH = path.join(ROOT, 'fixtures', 'offline_cache.schema.json');

type ScriptedQuery = {
  id: string;
  query: string;
  embedding: number[];
  expected_precedent_ids?: string[];
  category: string;
  notes?: string;
};

type OfflineCacheEntry = {
  query: string;
  tagged_stream: string;
  precedent_id: string;
};

type OfflineCache = { entries: OfflineCacheEntry[] };

function assertEmbeddingsReady(
  precedents: Precedent[],
  queries: ScriptedQuery[]
): void {
  const missingP = precedents.filter((p) => p.embedding.length === 0);
  if (missingP.length > 0) {
    throw new Error(
      `[${LABEL}] ${missingP.length} precedents missing embeddings — run 'pnpm gen:precedent-embeddings' first (first missing: ${missingP[0]!.id})`
    );
  }
  const missingQ = queries.filter((q) => q.embedding.length === 0);
  if (missingQ.length > 0) {
    throw new Error(
      `[${LABEL}] ${missingQ.length} scripted queries missing embeddings — run 'pnpm gen:scripted-query-embeddings' first (first missing: ${missingQ[0]!.id})`
    );
  }
  const todoQ = queries.filter((q) => /TODO/i.test(q.query));
  if (todoQ.length > 0) {
    throw new Error(
      `[${LABEL}] scripted queries contain TODO sentinel: ${todoQ.map((q) => q.id).join(', ')} — content-owner fill required`
    );
  }
}

async function bakeOne(
  q: ScriptedQuery,
  precedents: Precedent[],
  logger: ReturnType<typeof createLogger>
): Promise<OfflineCacheEntry> {
  const top3 = cosineTopK(q.embedding, precedents, 3);
  if (top3.length === 0) {
    throw new Error(`[${LABEL}] ${q.id}: cosineTopK returned 0 hits (embedding dimension mismatch?)`);
  }
  const top1Id = top3[0]!.precedent.id;
  const top3Ids = top3.map((t) => t.precedent.id);

  const res = await withRetry(
    () =>
      callClaudeOnce({
        mode: 'recall',
        clientId: 'acme',
        precedentIds: top3Ids,
        query: q.query,
        maxTokens: 2048,
        timeoutMs: 45_000,
      }),
    {
      onAttempt: (a) => logger.debug(`${q.id} attempt ${a}`),
      onRetryWait: (a, w) => logger.warn(`${q.id} transient — retry ${a} in ${w}ms`),
    }
  );
  logger.info(
    `${q.id} ok — ${res.latencyMs}ms usage=${JSON.stringify(res.usage)} top1=${top1Id}`
  );
  if (!res.fullText.includes('<done/>')) {
    logger.warn(`${q.id}: tagged_stream missing <done/> terminal — writing anyway (render-time parser enforces)`);
  }
  return {
    query: q.query.trim(),
    tagged_stream: res.fullText,
    precedent_id: top1Id,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const logger = createLogger(LABEL, { verbose: args.verbose });
  if (args.help) {
    printHelp(
      LABEL,
      'Pre-runs Claude Recall per scripted query, caches the tagged stream in offline_cache.json.\n' +
        'Requires gen:precedent-embeddings and gen:scripted-query-embeddings to have run first.\n' +
        'Flags: --dry-run | --confirm (required to overwrite entries) | --only <query_id> | --verbose'
    );
    return;
  }

  loadEnv();
  requireEnv('ANTHROPIC_API_KEY', LABEL);

  logger.warn(
    'COST WARNING — this script runs ~N Claude calls with full Seg 1+2+3 context.'
  );
  logger.warn(
    'Expected usage: ~50K write tokens on first call, ~5K read + ~1K output on subsequent.'
  );
  logger.warn('Do not re-run frequently; lock scripted_queries.json before baking.');

  const precedents = JSON.parse(
    fs.readFileSync(PRECEDENTS_PATH, 'utf8')
  ) as Precedent[];
  const queries = JSON.parse(
    fs.readFileSync(QUERIES_PATH, 'utf8')
  ) as ScriptedQuery[];
  assertEmbeddingsReady(precedents, queries);

  const offlineSchema = loadSchema(OFFLINE_SCHEMA_PATH);
  let existing: OfflineCache = { entries: [] };
  if (fs.existsSync(OFFLINE_PATH)) {
    existing = JSON.parse(fs.readFileSync(OFFLINE_PATH, 'utf8')) as OfflineCache;
    validateOrThrow(offlineSchema.validate, existing, LABEL);
  }

  const targets = args.only ? queries.filter((q) => q.id === args.only) : queries;
  if (args.only && targets.length === 0) {
    throw new Error(`[${LABEL}] --only ${args.only} did not match any scripted_query id`);
  }

  // Overwrite guard: --only partial preserves; full re-run replaces ALL.
  if (!args.dryRun && !args.confirm) {
    const targetQueryStrings = new Set(targets.map((q) => q.query.trim()));
    const clashes = existing.entries.filter((e) => targetQueryStrings.has(e.query.trim()));
    if (clashes.length > 0) {
      throw new Error(
        `[${LABEL}] existing offline_cache entries would be overwritten (${clashes.length}) — pass --confirm to proceed`
      );
    }
  }

  const newEntries: OfflineCacheEntry[] = [];
  const added: string[] = [];
  const replaced: string[] = [];
  for (const q of targets) {
    const entry = await bakeOne(q, precedents, logger);
    newEntries.push(entry);
    const isReplacement = existing.entries.some((e) => e.query.trim() === entry.query);
    (isReplacement ? replaced : added).push(q.id);
  }

  // Merge: when --only is set, preserve non-targeted entries. When absent,
  // replace all (default behavior per plan §4.4).
  let merged: OfflineCache;
  if (args.only) {
    const targetedStrings = new Set(targets.map((q) => q.query.trim()));
    const preserved = existing.entries.filter((e) => !targetedStrings.has(e.query.trim()));
    merged = { entries: [...preserved, ...newEntries] };
  } else {
    merged = { entries: newEntries };
  }

  validateOrThrow(offlineSchema.validate, merged, LABEL);

  if (args.dryRun) {
    logger.info(
      `DRY RUN — would write ${merged.entries.length} entries | added=[${added.join(', ')}] replaced=[${replaced.join(', ')}]`
    );
    return;
  }

  const serialized = JSON.stringify(merged, null, 2) + '\n';
  const tmp = `${OFFLINE_PATH}.tmp`;
  fs.writeFileSync(tmp, serialized, 'utf8');
  fs.renameSync(tmp, OFFLINE_PATH);
  logger.info(
    `wrote ${merged.entries.length} entries (${Buffer.byteLength(serialized, 'utf8')} bytes) | added=${added.length} replaced=${replaced.length}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[${LABEL}] ${(err as Error).message}`);
  process.exit(1);
});
