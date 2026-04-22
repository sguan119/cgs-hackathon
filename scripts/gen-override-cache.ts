// scripts/gen-override-cache.ts — impl-plan §3.3 / phase-3-plan §4.3.
//
// Bakes Strategic Innovation × {low, mid, high} override entries via Claude.
// MERGE-preserving: existing non-Strategic-Innovation entries survive, and
// within Strategic Innovation, only the bucket(s) being regenerated are
// touched (the rest retain their baked_at timestamps).
//
// Usage: pnpm gen:override-cache [--dry-run] [--confirm] [--only low|mid|high] [--verbose]

import * as fs from 'node:fs';
import * as path from 'node:path';
import { withRetry } from '@/lib/llm/retry';
import type {
  OverrideBucket,
  OverrideCache,
  OverrideCacheEntry,
} from '@/lib/override/dims';
import { parseArgs, printHelp } from '@/scripts/lib/args';
import { callClaudeOnce, extractJson } from '@/scripts/lib/claude-call';
import { loadEnv, requireEnv } from '@/scripts/lib/env';
import { createLogger } from '@/scripts/lib/logger';
import { compileDefinition, loadSchema, validateOrThrow } from '@/scripts/lib/schema';
import { JSON_ONLY_REMINDER } from '@/scripts/lib/tags-prompt';

const LABEL = 'gen:override-cache';
const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'fixtures', 'override_cache.json');
const SCHEMA_PATH = path.join(ROOT, 'fixtures', 'override_cache.schema.json');
const GEN_CACHE = path.join(ROOT, 'scripts', '.gen-cache');
const DIMENSION = 'strategic_innovation' as const;
const BUCKETS: OverrideBucket[] = ['low', 'mid', 'high'];

function promptFor(bucket: OverrideBucket): string {
  return [
    `Simulate an override: wheel dimension "${DIMENSION}" set to bucket=${bucket} (low|mid|high).`,
    'Produce the replacement InertiaHypothesis[] + overall rationale.',
    'Scope discipline:',
    '  - Only hypotheses AFFECTED by this score change. Do not regenerate the entire diagnostic — this is a DELTA.',
    '  - Each hypothesis must cite evidence via source_id + verbatim quote from the precedent library or Acme context.',
    '  - Reference intervention ids from the canonical intervention catalog (prefix int-<slug>).',
    `Return ONLY JSON matching OverrideCacheEntry (dimension="${DIMENSION}", bucket="${bucket}"):`,
    '{ dimension, bucket, hypotheses: InertiaHypothesis[], rationale }',
    'Exclude the `baked_at` field — the build script fills it.',
    JSON_ONLY_REMINDER,
  ].join('\n');
}

type EntryDraft = Omit<OverrideCacheEntry, 'baked_at'>;

async function bakeOne(
  bucket: OverrideBucket,
  logger: ReturnType<typeof createLogger>
): Promise<EntryDraft> {
  const prompt = promptFor(bucket);
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
      onAttempt: (a) => logger.debug(`${bucket} attempt ${a}`),
      onRetryWait: (a, w) => logger.warn(`${bucket} transient — retry ${a} in ${w}ms`),
    }
  );
  logger.info(`${bucket} ok — ${res.latencyMs}ms usage=${JSON.stringify(res.usage)}`);
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(res.fullText) as Record<string, unknown>;
  } catch (err) {
    fs.mkdirSync(GEN_CACHE, { recursive: true });
    const dump = path.join(GEN_CACHE, `override-${bucket}-raw.txt`);
    fs.writeFileSync(dump, res.fullText, 'utf8');
    throw new Error(
      `[${LABEL}] ${bucket} JSON parse failed — raw output at ${dump}: ${(err as Error).message}`
    );
  }
  // Normalize in case Claude omitted dimension/bucket fields.
  parsed['dimension'] = DIMENSION;
  parsed['bucket'] = bucket;
  return parsed as unknown as EntryDraft;
}

function mergePreserving(
  existing: OverrideCache,
  newEntries: OverrideCacheEntry[],
  targeted: OverrideBucket[]
): OverrideCache {
  // Keep every existing entry that is NOT (DIMENSION, bucket∈targeted).
  // Every targeted bucket was baked before this filter runs, so a separate
  // newByKey lookup would be redundant.
  const preserved = existing.entries.filter(
    (e) => !(e.dimension === DIMENSION && targeted.includes(e.bucket))
  );
  return { version: 1, entries: [...preserved, ...newEntries] };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const logger = createLogger(LABEL, { verbose: args.verbose });
  if (args.help) {
    printHelp(
      LABEL,
      'Bakes Strategic Innovation × {low,mid,high} via Claude into override_cache.json.\n' +
        'Existing entries outside this set are preserved verbatim.\n' +
        'Flags: --dry-run | --confirm (required to overwrite existing entries) | --only low|mid|high | --verbose'
    );
    return;
  }

  loadEnv();
  requireEnv('ANTHROPIC_API_KEY', LABEL);

  const compiled = loadSchema(SCHEMA_PATH);
  const entryValidate = compileDefinition(compiled, 'OverrideCacheEntry');

  const raw = fs.readFileSync(CACHE_PATH, 'utf8');
  const existing = JSON.parse(raw) as OverrideCache;
  validateOrThrow(compiled.validate, existing, LABEL);

  const targets: OverrideBucket[] = args.only
    ? (() => {
        if (!BUCKETS.includes(args.only as OverrideBucket)) {
          throw new Error(`[${LABEL}] --only must be one of low|mid|high; got ${args.only}`);
        }
        return [args.only as OverrideBucket];
      })()
    : BUCKETS;

  // Overwrite guard on targeted entries.
  if (!args.dryRun && !args.confirm) {
    const clashes = existing.entries.filter(
      (e) => e.dimension === DIMENSION && targets.includes(e.bucket)
    );
    if (clashes.length > 0) {
      throw new Error(
        `[${LABEL}] existing entries present for ${clashes
          .map((c) => `${c.dimension}:${c.bucket}`)
          .join(', ')} — pass --confirm to overwrite or --dry-run to preview`
      );
    }
  }

  const drafts: EntryDraft[] = [];
  for (const b of targets) {
    drafts.push(await bakeOne(b, logger));
  }
  const now = new Date().toISOString();
  const newEntries: OverrideCacheEntry[] = drafts.map((d) => ({
    ...(d as OverrideCacheEntry),
    baked_at: now,
  }));
  for (const e of newEntries) {
    validateOrThrow(entryValidate, e, `${LABEL}:entry`);
  }

  const merged = mergePreserving(existing, newEntries, targets);
  validateOrThrow(compiled.validate, merged, LABEL);

  // Uniqueness guard — mergePreserving cannot produce dupes, but cheap check.
  const seen = new Set<string>();
  for (const e of merged.entries) {
    const key = `${e.dimension}:${e.bucket}`;
    if (seen.has(key)) {
      throw new Error(`[${LABEL}] post-merge duplicate: ${key}`);
    }
    seen.add(key);
  }

  if (args.dryRun) {
    logger.info(
      `DRY RUN — would write ${merged.entries.length} entries (was ${existing.entries.length}; +${merged.entries.length - existing.entries.length})`
    );
    for (const e of newEntries) {
      logger.info(`  baked ${e.dimension}:${e.bucket} | hypotheses=${e.hypotheses.length}`);
    }
    return;
  }

  const serialized = JSON.stringify(merged, null, 2) + '\n';
  const tmp = `${CACHE_PATH}.tmp`;
  fs.writeFileSync(tmp, serialized, 'utf8');
  fs.renameSync(tmp, CACHE_PATH);
  logger.info(`wrote ${merged.entries.length} entries (${Buffer.byteLength(serialized, 'utf8')} bytes)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[${LABEL}] ${(err as Error).message}`);
  process.exit(1);
});
