// .env.local loader — zero-dep, handles KEY=value and # comments.
//
// Phase 3 scripts reuse this to pull ANTHROPIC_API_KEY / OPENAI_API_KEY
// at script start. Missing keys throw a clear, actionable error (plan §5.1).

import * as fs from 'node:fs';
import * as path from 'node:path';

const QUOTED = /^(['"])(.*)\1$/;

function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq < 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  const m = QUOTED.exec(value);
  if (m) value = m[2]!;
  return [key, value];
}

let envLoaded = false;

export function loadEnv(envPath?: string): void {
  if (envLoaded) return;
  const resolved = envPath ?? path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(resolved)) {
    envLoaded = true;
    return;
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const entry = parseLine(line);
    if (!entry) continue;
    const [key, value] = entry;
    if (process.env[key] === undefined) process.env[key] = value;
  }
  envLoaded = true;
}

export function requireEnv(name: string, scriptLabel: string): string {
  loadEnv();
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `[${scriptLabel}] ${name} missing in .env.local — aborting. See .env.local.example.`
    );
  }
  return value;
}

// Test seam — reset cache flag so subsequent loadEnv() calls re-read the file.
export function __resetEnvForTests(): void {
  envLoaded = false;
}
