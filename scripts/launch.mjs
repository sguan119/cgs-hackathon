// One-command launcher for the Tauri desktop app.
//
// Handles three real-world papercuts before handing off to `tauri dev`:
//   1. Ensures `~/.cargo/bin` is on PATH — rustup updates the Windows user
//      PATH but Git Bash sessions started before install don't see it.
//   2. Auto-seeds `.env.local` from `.env.local.example` so Next.js boots
//      even when the user hasn't filled in Claude/OpenAI keys yet.
//   3. Frees port 3000 if something is already listening — Tauri's
//      beforeDevCommand can't start Next on its expected port otherwise,
//      and two Next servers sharing `.next/` corrupts the route cache.

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = platform() === 'win32';

function log(msg) {
  process.stdout.write(`[launch] ${msg}\n`);
}

function ensureCargoOnPath() {
  const cargoBin = path.join(homedir(), '.cargo', 'bin');
  if (existsSync(cargoBin) && !process.env.PATH?.split(path.delimiter).includes(cargoBin)) {
    process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH ?? ''}`;
  }
}

function checkCargo() {
  const probe = spawnSync(isWin ? 'cargo.exe' : 'cargo', ['--version'], { stdio: 'ignore' });
  if (probe.status !== 0) {
    console.error('\n[launch] cargo not found on PATH.');
    console.error('[launch] Install the Rust toolchain from https://rustup.rs and re-run.');
    process.exit(1);
  }
}

function ensureEnvLocal() {
  const envPath = path.join(root, '.env.local');
  const examplePath = path.join(root, '.env.local.example');
  if (!existsSync(envPath) && existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    log('.env.local seeded from .env.local.example — replace the REPLACE_ME keys to enable live LLM calls.');
  }
}

function freePort3000() {
  if (!isWin) return;
  const out = spawnSync('cmd', ['/c', 'netstat -ano | findstr :3000'], { encoding: 'utf8' });
  if (out.status !== 0 || !out.stdout) return;
  const pids = new Set();
  for (const line of out.stdout.split(/\r?\n/)) {
    const match = line.match(/LISTENING\s+(\d+)/);
    if (match) pids.add(match[1]);
  }
  if (pids.size === 0) return;
  log(`port 3000 held by pid(s) ${[...pids].join(', ')} — killing`);
  for (const pid of pids) {
    spawnSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
  }
}

function main() {
  ensureCargoOnPath();
  checkCargo();
  ensureEnvLocal();
  freePort3000();

  // Invoke the tauri CLI's Node entry directly — avoids the `.cmd` shim
  // spawn quirks on Windows (EINVAL / path-with-spaces quoting).
  const cli = path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
  const child = spawn(process.execPath, [cli, 'dev'], { stdio: 'inherit', cwd: root, env: process.env });
  child.on('exit', (code) => process.exit(code ?? 0));
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => child.kill(sig));
  }
}

main();
