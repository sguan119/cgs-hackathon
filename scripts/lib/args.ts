// Minimal CLI arg parser for gen scripts — plan §5.2.
// Supports --flag, --key value, --key=value. No commander/yargs dep.

export type GenCliArgs = {
  dryRun: boolean;
  confirm: boolean;
  only?: string;
  verbose: boolean;
  help: boolean;
  json: boolean;
};

const KNOWN_FLAGS = new Set([
  '--dry-run',
  '--confirm',
  '--verbose',
  '--help',
  '-h',
  '--json',
]);
const KNOWN_VALUED = new Set(['--only']);

export function parseArgs(argv: string[]): GenCliArgs {
  const out: GenCliArgs = {
    dryRun: false,
    confirm: false,
    verbose: false,
    help: false,
    json: false,
  };

  let i = 0;
  while (i < argv.length) {
    const tok = argv[i]!;
    if (tok === '--dry-run') {
      out.dryRun = true;
      i++;
      continue;
    }
    if (tok === '--confirm') {
      out.confirm = true;
      i++;
      continue;
    }
    if (tok === '--verbose') {
      out.verbose = true;
      i++;
      continue;
    }
    if (tok === '--help' || tok === '-h') {
      out.help = true;
      i++;
      continue;
    }
    if (tok === '--json') {
      out.json = true;
      i++;
      continue;
    }
    // --key=value form
    const eq = tok.indexOf('=');
    if (tok.startsWith('--') && eq > 2) {
      const key = tok.slice(0, eq);
      const value = tok.slice(eq + 1);
      if (KNOWN_VALUED.has(key)) {
        if (key === '--only') out.only = value;
        i++;
        continue;
      }
      // unknown --key=value
      throw new Error(`Unknown flag: ${key}`);
    }
    // --key value form
    if (tok === '--only') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Error('--only requires a value');
      }
      out.only = next;
      i += 2;
      continue;
    }
    if (tok.startsWith('--') || tok.startsWith('-')) {
      if (!KNOWN_FLAGS.has(tok)) throw new Error(`Unknown flag: ${tok}`);
    }
    // positionals ignored
    i++;
  }

  return out;
}

export function printHelp(scriptLabel: string, doc: string): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: pnpm ${scriptLabel} [flags]\n\n${doc}`);
}
