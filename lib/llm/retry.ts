// Retry + degrade ladder for the Claude recall stream.
// Architecture §5.2: 2× exponential-ish backoff (2s / 6s), then degrade
// to offline cache (scripted path only) or no-anchor synthesizer.

export type RetryCallbacks = {
  onAttempt?: (_attempt: 1 | 2 | 3) => void;
  onRetryWait?: (_attempt: 2 | 3, _waitMs: number) => void;
  onExhausted?: () => void;
};

// Durations exposed so tests can stub with 0 (avoid real-time waits).
export const RETRY_DELAYS_MS: ReadonlyArray<number> = [2_000, 6_000];

export function isTransientError(err: unknown): boolean {
  if (err == null) return false;
  const anyErr = err as { status?: number; name?: string; message?: string; code?: string };
  if (anyErr.name === 'AbortError' && (anyErr.message ?? '').includes('timeout')) return true;
  if (typeof anyErr.status === 'number') {
    if (anyErr.status >= 500) return true;
    if (anyErr.status === 408 || anyErr.status === 429) return true;
  }
  const msg = (anyErr.message ?? '').toLowerCase();
  if (msg.includes('timeout')) return true;
  if (msg.includes('network')) return true;
  if (msg.includes('fetch failed')) return true;
  // Anthropic SDK: APIConnectionError has no status and message === "Connection error."
  if (msg.includes('connection error')) return true;
  return false;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export type WithRetryOpts = {
  delaysMs?: ReadonlyArray<number>;
  signal?: AbortSignal;
  // Override the default `isTransientError` classifier. Plan §4.4 makes
  // this explicit so tests and callers can narrow the retry surface
  // without reaching into module internals.
  isTransient?: (_err: unknown) => boolean;
};

export async function withRetry<T>(
  task: (_attempt: 1 | 2 | 3) => Promise<T>,
  cb: RetryCallbacks = {},
  opts: WithRetryOpts = {}
): Promise<T> {
  const delays = opts.delaysMs ?? RETRY_DELAYS_MS;
  const classify = opts.isTransient ?? isTransientError;
  const attempts: Array<1 | 2 | 3> = [1, 2, 3];
  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]!;
    cb.onAttempt?.(attempt);
    try {
      return await task(attempt);
    } catch (err) {
      lastErr = err;
      if (!classify(err)) throw err;
      if (i === attempts.length - 1) break;
      const wait = delays[i] ?? 0;
      cb.onRetryWait?.((attempt + 1) as 2 | 3, wait);
      await sleep(wait, opts.signal);
    }
  }
  cb.onExhausted?.();
  throw lastErr ?? new Error('withRetry exhausted with no error');
}
