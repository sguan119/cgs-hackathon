// Prompt-cache warmers. Boot heartbeat warms the no-Seg-3 cache path on
// app start; keep-alive re-fires every 4.5 minutes to stay under
// Anthropic's ~5-minute ephemeral-cache TTL.
//
// `warmAcmeContextOnce()` is fired exactly once when `current_client`
// flips to 'acme' so the with-Seg-3 cache path is warm before the first
// user-facing Acme call. The guard is a module-level boolean — do NOT put
// it in React state or a dependency array; multiple renders must collapse
// to one network call.

import { streamCompletion } from './client';

const KEEPALIVE_INTERVAL_MS = 270_000; // 4.5 min

let bootFired = false;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let acmeWarmed = false;
let currentClientId: string | null = null;

function noop(): void {
  /* intentional no-op for heartbeat delta stream */
}

async function fireHeartbeat(clientId: string | null, tag: string): Promise<void> {
  try {
    const result = await streamCompletion({
      mode: 'heartbeat',
      clientId,
      query: 'ping',
      onDelta: noop,
      onComplete: () => {
        /* summary consumed from return value below */
      },
    });
    // eslint-disable-next-line no-console
    console.info(
      `[heartbeat:${tag}] cache_read=${result.usage.cacheReadInputTokens} ` +
        `cache_create=${result.usage.cacheCreationInputTokens} ` +
        `out=${result.usage.outputTokens}`
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[heartbeat:${tag}] failed`, err);
  }
}

export async function startBootHeartbeat(): Promise<void> {
  if (bootFired) return;
  bootFired = true;
  await fireHeartbeat(null, 'boot');
}

export function startKeepAliveHeartbeat(): void {
  if (keepaliveTimer) return;
  keepaliveTimer = setInterval(() => {
    void fireHeartbeat(currentClientId, 'keepalive');
  }, KEEPALIVE_INTERVAL_MS);
}

export function stopKeepAliveHeartbeat(): void {
  if (!keepaliveTimer) return;
  clearInterval(keepaliveTimer);
  keepaliveTimer = null;
}

export function setActiveClientId(clientId: string | null): void {
  currentClientId = clientId;
}

export async function warmAcmeContextOnce(): Promise<void> {
  if (acmeWarmed) return;
  acmeWarmed = true;
  await fireHeartbeat('acme', 'acme-warm');
}
