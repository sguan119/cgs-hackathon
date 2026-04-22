// Timestamp helpers shared by check-fixture-mtimes and gen-scripts — plan §5.6.

import * as fs from 'node:fs';

export function getMtime(filePath: string): number | null {
  try {
    const st = fs.statSync(filePath);
    return st.mtimeMs;
  } catch {
    return null;
  }
}

export function isNewerThan(sourcePath: string, derivedPath: string): boolean {
  const src = getMtime(sourcePath);
  const der = getMtime(derivedPath);
  if (src === null) return false;
  if (der === null) return true;
  return src > der;
}

export type MtimePair = {
  source: string;
  derived: string;
  sourceMtimeMs: number | null;
  derivedMtimeMs: number | null;
  stale: boolean;
  genCommand: string;
  reason: 'missing' | 'newer-source' | 'ok';
};

export function classifyPair(
  source: string,
  derived: string,
  genCommand: string
): MtimePair {
  const sourceMtimeMs = getMtime(source);
  const derivedMtimeMs = getMtime(derived);
  if (derivedMtimeMs === null) {
    return {
      source,
      derived,
      sourceMtimeMs,
      derivedMtimeMs,
      stale: true,
      genCommand,
      reason: 'missing',
    };
  }
  if (sourceMtimeMs !== null && sourceMtimeMs > derivedMtimeMs) {
    return {
      source,
      derived,
      sourceMtimeMs,
      derivedMtimeMs,
      stale: true,
      genCommand,
      reason: 'newer-source',
    };
  }
  return {
    source,
    derived,
    sourceMtimeMs,
    derivedMtimeMs,
    stale: false,
    genCommand,
    reason: 'ok',
  };
}

export function sourceNewerPairs(pairs: MtimePair[]): MtimePair[] {
  return pairs.filter((p) => p.stale);
}
