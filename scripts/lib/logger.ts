// Prefixed structured stdout — plan §5.3.
// Levels gated by verbose; NO_COLOR respected (no codes emitted by default).

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export type Logger = {
  info: (_msg: string) => void;
  warn: (_msg: string) => void;
  error: (_msg: string) => void;
  debug: (_msg: string) => void;
};

export function createLogger(label: string, opts: { verbose?: boolean } = {}): Logger {
  const prefix = `[${label}]`;
  const verbose = opts.verbose ?? false;
  return {
    info: (msg) => {
      // eslint-disable-next-line no-console
      console.log(`${prefix} INFO ${msg}`);
    },
    warn: (msg) => {
      // eslint-disable-next-line no-console
      console.warn(`${prefix} WARN ${msg}`);
    },
    error: (msg) => {
      // eslint-disable-next-line no-console
      console.error(`${prefix} ERROR ${msg}`);
    },
    debug: (msg) => {
      if (!verbose) return;
      // eslint-disable-next-line no-console
      console.log(`${prefix} DEBUG ${msg}`);
    },
  };
}
