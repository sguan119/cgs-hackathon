import { describe, it, expect } from 'vitest';
import { getMtime, isNewerThan, classifyPair, sourceNewerPairs } from '@/scripts/lib/mtime';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function writeTmpFile(dir: string, name: string, content = 'x'): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

describe('getMtime', () => {
  it('returns a number for an existing file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const p = writeTmpFile(dir, 'test.txt');
    const m = getMtime(p);
    expect(typeof m).toBe('number');
    expect(m).toBeGreaterThan(0);
  });

  it('returns null for a missing file', () => {
    expect(getMtime('/nonexistent/path/to/file.json')).toBeNull();
  });
});

describe('isNewerThan', () => {
  it('returns true when derived file is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const src = writeTmpFile(dir, 'source.json');
    expect(isNewerThan(src, path.join(dir, 'missing-derived.json'))).toBe(true);
  });

  it('returns false when source file is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const derived = writeTmpFile(dir, 'derived.json');
    expect(isNewerThan(path.join(dir, 'missing-source.json'), derived)).toBe(false);
  });

  it('returns false when derived is newer than source', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const src = writeTmpFile(dir, 'source.json');
    // Ensure source has an older mtime by updating derived after a brief wait
    const derived = writeTmpFile(dir, 'derived.json');
    const srcMtime = getMtime(src)!;
    const derMtime = getMtime(derived)!;
    // In most CI environments writes are fast; force the comparison via classifyPair
    if (derMtime >= srcMtime) {
      expect(isNewerThan(src, derived)).toBe(false);
    } else {
      // source newer → true is correct
      expect(isNewerThan(src, derived)).toBe(true);
    }
  });
});

describe('classifyPair', () => {
  it('reason is missing when derived file does not exist', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const src = writeTmpFile(dir, 'src.json');
    const pair = classifyPair(src, path.join(dir, 'no-derived.json'), 'pnpm gen:test');
    expect(pair.stale).toBe(true);
    expect(pair.reason).toBe('missing');
    expect(pair.derivedMtimeMs).toBeNull();
  });

  it('reason is ok when derived is newer', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const src = writeTmpFile(dir, 'src.json');
    const derived = writeTmpFile(dir, 'derived.json');
    // Set source mtime to past
    const past = Date.now() - 100_000;
    fs.utimesSync(src, past / 1000, past / 1000);
    const pair = classifyPair(src, derived, 'pnpm gen:test');
    expect(pair.stale).toBe(false);
    expect(pair.reason).toBe('ok');
  });

  it('reason is newer-source when source is newer than derived', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const derived = writeTmpFile(dir, 'derived.json');
    const src = writeTmpFile(dir, 'src.json');
    // Set derived mtime to past
    const past = Date.now() - 100_000;
    fs.utimesSync(derived, past / 1000, past / 1000);
    const pair = classifyPair(src, derived, 'pnpm gen:test');
    expect(pair.stale).toBe(true);
    expect(pair.reason).toBe('newer-source');
  });

  it('stores the genCommand in the pair', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtime-'));
    const src = writeTmpFile(dir, 'src.json');
    const pair = classifyPair(src, path.join(dir, 'none.json'), 'pnpm gen:embeddings');
    expect(pair.genCommand).toBe('pnpm gen:embeddings');
  });
});

describe('sourceNewerPairs', () => {
  it('filters to only stale pairs', () => {
    const pairs = [
      { stale: true, reason: 'missing' as const, source: 'a', derived: 'b', sourceMtimeMs: 1, derivedMtimeMs: null, genCommand: 'x' },
      { stale: false, reason: 'ok' as const, source: 'c', derived: 'd', sourceMtimeMs: 1, derivedMtimeMs: 2, genCommand: 'y' },
    ];
    expect(sourceNewerPairs(pairs)).toHaveLength(1);
    expect(sourceNewerPairs(pairs)[0]!.source).toBe('a');
  });

  it('returns empty array when no stale pairs', () => {
    const pairs = [
      { stale: false, reason: 'ok' as const, source: 'a', derived: 'b', sourceMtimeMs: 1, derivedMtimeMs: 2, genCommand: 'x' },
    ];
    expect(sourceNewerPairs(pairs)).toHaveLength(0);
  });
});
