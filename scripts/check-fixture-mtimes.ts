// scripts/check-fixture-mtimes.ts — impl-plan §3.5 / phase-3-plan §4.5.
//
// Read-only: inspects source → derived pairs, reports stale-ness. Always
// exits 0 (non-blocking per impl-plan "不 block — 只提醒"). Use `--json`
// for CI-parseable output.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs, printHelp } from '@/scripts/lib/args';
import { createLogger } from '@/scripts/lib/logger';
import { classifyPair, getMtime, type MtimePair } from '@/scripts/lib/mtime';

const LABEL = 'check:fixture-mtimes';
const ROOT = path.resolve(__dirname, '..');

type SpecialCheck = {
  label: string;
  source: string;
  derived: string;
  genCommand: string;
  reason: 'missing' | 'ok';
  note?: string;
};

function embeddingsReady(filePath: string): { ready: boolean; missing: number; total: number } {
  if (!fs.existsSync(filePath)) return { ready: false, missing: 0, total: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Array<{
      embedding?: number[];
    }>;
    if (!Array.isArray(data)) return { ready: true, missing: 0, total: 0 };
    const missing = data.filter((e) => !e.embedding || e.embedding.length === 0).length;
    return { ready: missing === 0, missing, total: data.length };
  } catch {
    return { ready: false, missing: 0, total: 0 };
  }
}

function strategicInnovationBaked(filePath: string): {
  ready: boolean;
  bucketsPresent: number;
} {
  if (!fs.existsSync(filePath)) return { ready: false, bucketsPresent: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      entries?: Array<{ dimension?: string; bucket?: string }>;
    };
    const present = new Set(
      (data.entries ?? [])
        .filter((e) => e.dimension === 'strategic_innovation')
        .map((e) => e.bucket)
    );
    return {
      ready: ['low', 'mid', 'high'].every((b) => present.has(b)),
      bucketsPresent: present.size,
    };
  } catch {
    return { ready: false, bucketsPresent: 0 };
  }
}

function buildReport(): {
  pairs: MtimePair[];
  specials: SpecialCheck[];
} {
  const pairs: MtimePair[] = [];
  const specials: SpecialCheck[] = [];

  // Precedent embeddings (in-file derived field).
  const precPath = path.join(ROOT, 'fixtures', 'precedents.json');
  const precStatus = embeddingsReady(precPath);
  specials.push({
    label: 'fixtures/precedents.json embeddings',
    source: precPath,
    derived: precPath,
    genCommand: 'pnpm gen:precedent-embeddings',
    reason: precStatus.ready ? 'ok' : 'missing',
    note: precStatus.ready
      ? `all ${precStatus.total} entries embedded`
      : `${precStatus.missing} of ${precStatus.total} entries missing 1536-d vectors`,
  });

  // Scripted-query embeddings.
  const sqPath = path.join(ROOT, 'fixtures', 'scripted_queries.json');
  const sqStatus = embeddingsReady(sqPath);
  specials.push({
    label: 'fixtures/scripted_queries.json embeddings',
    source: sqPath,
    derived: sqPath,
    genCommand: 'pnpm gen:scripted-query-embeddings',
    reason: sqStatus.ready ? 'ok' : 'missing',
    note: sqStatus.ready
      ? `all ${sqStatus.total} entries embedded`
      : `${sqStatus.missing} of ${sqStatus.total} entries missing vectors`,
  });

  // Diagnostic fixtures — any acme_fixtures/*.md newer than any F<x>.json.
  const acmeFiles = ['memo.md', 'org.md', 'call.md'].map((f) =>
    path.join(ROOT, 'fixtures', 'acme_fixtures', f)
  );
  const fFiles = ['f1', 'f2', 'f3', 'f4', 'f5'].map((f) =>
    path.join(ROOT, 'fixtures', 'diagnostic_fixtures', `${f}.json`)
  );
  for (const f of fFiles) {
    // Check each F against the newest acme source.
    const newestAcme = acmeFiles
      .map((a) => getMtime(a))
      .filter((v): v is number => v !== null)
      .reduce<number | null>((max, v) => (max === null || v > max ? v : max), null);
    const derMtime = getMtime(f);
    if (derMtime === null) {
      pairs.push({
        source: acmeFiles[0]!,
        derived: f,
        sourceMtimeMs: newestAcme,
        derivedMtimeMs: null,
        stale: true,
        genCommand: 'pnpm gen:diagnostic-fixtures',
        reason: 'missing',
      });
    } else if (newestAcme !== null && newestAcme > derMtime) {
      pairs.push({
        source: acmeFiles[0]!,
        derived: f,
        sourceMtimeMs: newestAcme,
        derivedMtimeMs: derMtime,
        stale: true,
        genCommand: `pnpm gen:diagnostic-fixtures --only ${path.basename(f, '.json')}`,
        reason: 'newer-source',
      });
    } else {
      pairs.push({
        source: acmeFiles[0]!,
        derived: f,
        sourceMtimeMs: newestAcme,
        derivedMtimeMs: derMtime,
        stale: false,
        genCommand: 'pnpm gen:diagnostic-fixtures',
        reason: 'ok',
      });
    }
  }

  // Override cache — Strategic Innovation coverage.
  const oc = path.join(ROOT, 'fixtures', 'override_cache.json');
  const ocStatus = strategicInnovationBaked(oc);
  specials.push({
    label: 'fixtures/override_cache.json (Strategic Innovation × {low,mid,high})',
    source: path.join(ROOT, 'lib', 'override', 'dims.ts'),
    derived: oc,
    genCommand: 'pnpm gen:override-cache',
    reason: ocStatus.ready ? 'ok' : 'missing',
    note: ocStatus.ready
      ? 'all 3 buckets baked'
      : `only ${ocStatus.bucketsPresent} of 3 Strategic-Innovation buckets present`,
  });

  // Offline cache — file existence + mtime vs sources.
  const offline = path.join(ROOT, 'fixtures', 'offline_cache.json');
  const offlineSource = sqPath;
  pairs.push(classifyPair(offlineSource, offline, 'pnpm gen:offline-cache'));

  return { pairs, specials };
}

function humanFormat(
  pairs: MtimePair[],
  specials: SpecialCheck[]
): string {
  const lines: string[] = [];
  const stalePairs = pairs.filter((p) => p.stale);
  const staleSpecials = specials.filter((s) => s.reason === 'missing');
  const total = stalePairs.length + staleSpecials.length;
  const totalPairs = pairs.length + specials.length;
  if (total === 0) {
    lines.push(`[${LABEL}] all ${totalPairs} derived artifacts appear fresh (exit 0).`);
    return lines.join('\n');
  }
  lines.push(`[${LABEL}] ${total} of ${totalPairs} derived artifacts are stale:`);
  lines.push('');
  for (const s of staleSpecials) {
    lines.push(`  ${path.relative(ROOT, s.derived)}`);
    if (s.note) lines.push(`    → ${s.note}`);
    lines.push(`    → run: ${s.genCommand}`);
    lines.push('');
  }
  for (const p of stalePairs) {
    lines.push(`  ${path.relative(ROOT, p.derived)}`);
    if (p.reason === 'missing') {
      lines.push('    → missing entirely');
    } else if (p.reason === 'newer-source') {
      const srcIso = p.sourceMtimeMs ? new Date(p.sourceMtimeMs).toISOString() : 'unknown';
      const derIso = p.derivedMtimeMs ? new Date(p.derivedMtimeMs).toISOString() : 'unknown';
      lines.push(`    → source ${path.relative(ROOT, p.source)} modified ${srcIso} (derived: ${derIso})`);
    }
    lines.push(`    → run: ${p.genCommand}`);
    lines.push('');
  }
  lines.push('Exit code: 0 (warnings only; re-run manually).');
  return lines.join('\n');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const logger = createLogger(LABEL, { verbose: args.verbose });
  if (args.help) {
    printHelp(
      LABEL,
      'Read-only: inspects source → derived pairs, prints stale ones. Always exits 0.\n' +
        'Flags: --verbose | --json'
    );
    return;
  }

  const { pairs, specials } = buildReport();

  if (args.json) {
    const report = {
      pairs,
      stalePairs: pairs.filter((p) => p.stale),
      specials,
      staleSpecials: specials.filter((s) => s.reason === 'missing'),
      ok: pairs.every((p) => !p.stale) && specials.every((s) => s.reason !== 'missing'),
      generatedAt: new Date().toISOString(),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
    return;
  }

  const msg = humanFormat(pairs, specials);
  // Warnings go to stderr per team-lead brief.
  if (pairs.some((p) => p.stale) || specials.some((s) => s.reason === 'missing')) {
    // eslint-disable-next-line no-console
    console.error(msg);
  } else {
    logger.info(msg);
  }
  process.exit(0);
}

try {
  main();
} catch (err) {
  // Even on unexpected error, still exit 0 — this is a non-blocking reporter.
  // eslint-disable-next-line no-console
  console.error(`[${LABEL}] internal error: ${(err as Error).message}`);
  process.exit(0);
}
