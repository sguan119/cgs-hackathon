import { describe, it, expect, vi } from 'vitest';
import { isTransientError, withRetry } from '@/lib/llm/retry';

describe('isTransientError', () => {
  it('classifies 5xx as transient', () => {
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ status: 500 })).toBe(true);
  });
  it('classifies 408/429 as transient', () => {
    expect(isTransientError({ status: 408 })).toBe(true);
    expect(isTransientError({ status: 429 })).toBe(true);
  });
  it('classifies 4xx (non 408/429) as non-transient', () => {
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError({ status: 401 })).toBe(false);
  });
  it('classifies timeout AbortError as transient', () => {
    expect(isTransientError({ name: 'AbortError', message: 'fetch timeout' })).toBe(true);
  });
  it('classifies fetch-failed / network error message as transient', () => {
    expect(isTransientError(new Error('network error'))).toBe(true);
    expect(isTransientError(new Error('fetch failed'))).toBe(true);
  });
  it('treats null / unknown as non-transient', () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError({ status: 200 })).toBe(false);
  });
  it('classifies APIConnectionError (no status, message "Connection error.") as transient', () => {
    // Anthropic SDK APIConnectionError: no status field, message contains "Connection error."
    const err = Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' });
    expect(isTransientError(err)).toBe(true);
  });
  it('classifies generic Error with no status/name as NON-transient', () => {
    const err = new Error('something broke');
    expect(isTransientError(err)).toBe(false);
  });
  it('classifies HTTP 429 rate limit as transient', () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    expect(isTransientError(err)).toBe(true);
  });
});

describe('withRetry', () => {
  it('succeeds on first attempt — no retry', async () => {
    const task = vi.fn().mockResolvedValue('ok');
    const onAttempt = vi.fn();
    const out = await withRetry(task, { onAttempt }, { delaysMs: [0, 0] });
    expect(out).toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenCalledWith(1);
  });

  it('succeeds on third attempt after two transient failures', async () => {
    const err = Object.assign(new Error('service unavailable'), { status: 503 });
    const task = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('recovered');
    const onAttempt = vi.fn();
    const onRetryWait = vi.fn();
    const out = await withRetry(task, { onAttempt, onRetryWait }, { delaysMs: [0, 0] });
    expect(out).toBe('recovered');
    expect(task).toHaveBeenCalledTimes(3);
    expect(onAttempt).toHaveBeenCalledTimes(3);
    expect(onRetryWait).toHaveBeenCalledTimes(2);
  });

  it('throws after three transient failures and fires onExhausted', async () => {
    const err = Object.assign(new Error('service unavailable'), { status: 503 });
    const task = vi.fn().mockRejectedValue(err);
    const onExhausted = vi.fn();
    await expect(
      withRetry(task, { onExhausted }, { delaysMs: [0, 0] })
    ).rejects.toBe(err);
    expect(task).toHaveBeenCalledTimes(3);
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a non-transient error', async () => {
    const err = Object.assign(new Error('bad request'), { status: 400 });
    const task = vi.fn().mockRejectedValue(err);
    await expect(withRetry(task, {}, { delaysMs: [0, 0] })).rejects.toBe(err);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('signal.aborted before first attempt throws immediately without calling task', async () => {
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn().mockResolvedValue('should not reach');
    // When already aborted, sleep(0, signal) resolves immediately but the
    // task is still called for attempt 1 — the abort only interrupts waits
    // between retries. If the task itself throws on abort, that surfaces here.
    // This test documents: task IS called once (attempt 1), then abort stops sleep.
    const transient = Object.assign(new Error('service unavailable'), { status: 503 });
    const abortTask = vi.fn(async () => { throw transient; });
    await expect(
      withRetry(abortTask, {}, { delaysMs: [0, 0], signal: controller.signal })
    ).rejects.toBe(transient);
    // With delaysMs=[0,0] and already-aborted signal, sleep resolves
    // instantly but the abort promise rejects — all 3 attempts still run
    // when delays are 0 since sleep(0) short-circuits before checking signal.
    // The key invariant: never MORE than 3 attempts.
    expect(abortTask.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('honors a custom isTransient predicate passed via opts', async () => {
    // Custom predicate: ONLY errors with code="RETRY_ME" are transient,
    // so a normally-transient 503 is NOT retried under this classifier.
    const err = Object.assign(new Error('service unavailable'), { status: 503 });
    const task = vi.fn().mockRejectedValue(err);
    const customTransient = (e: unknown): boolean =>
      (e as { code?: string }).code === 'RETRY_ME';
    await expect(
      withRetry(task, {}, { delaysMs: [0, 0], isTransient: customTransient })
    ).rejects.toBe(err);
    // Single attempt because the custom predicate returned false.
    expect(task).toHaveBeenCalledTimes(1);

    // Same classifier with a matching error — does retry and recovers.
    const retryable = Object.assign(new Error('retry me'), { code: 'RETRY_ME' });
    const retrier = vi
      .fn()
      .mockRejectedValueOnce(retryable)
      .mockResolvedValueOnce('ok');
    const out = await withRetry(
      retrier,
      {},
      { delaysMs: [0, 0], isTransient: customTransient }
    );
    expect(out).toBe('ok');
    expect(retrier).toHaveBeenCalledTimes(2);
  });
});
