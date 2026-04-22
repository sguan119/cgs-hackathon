import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  disposeAll,
  isCleanedUpForTest,
  registerDisposable,
  resetCleanupForTest,
} from '@/lib/shell/cleanup';

describe('lib/shell/cleanup', () => {
  beforeEach(() => {
    resetCleanupForTest();
    // Silence the expected warn from [C3] so the test output stays clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    resetCleanupForTest();
  });

  // [C1]
  it('disposeAll runs every registered disposable exactly once', async () => {
    const a = vi.fn();
    const b = vi.fn(async () => {});
    const c = vi.fn();
    registerDisposable(a);
    registerDisposable(b);
    registerDisposable(c);
    await disposeAll('unmount');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
    expect(isCleanedUpForTest()).toBe(true);
  });

  // [C2]
  it('second disposeAll call is a no-op', async () => {
    const a = vi.fn();
    registerDisposable(a);
    await disposeAll('app_quit');
    await disposeAll('app_quit');
    expect(a).toHaveBeenCalledTimes(1);
  });

  // [C3]
  it('a throwing disposer does not block subsequent disposers', async () => {
    const thrower = vi.fn(() => {
      throw new Error('boom');
    });
    const second = vi.fn();
    const asyncRejected = vi.fn(async () => {
      throw new Error('async boom');
    });
    const third = vi.fn();
    registerDisposable(thrower);
    registerDisposable(second);
    registerDisposable(asyncRejected);
    registerDisposable(third);
    await expect(disposeAll('app_quit')).resolves.toBeUndefined();
    expect(thrower).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(asyncRejected).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
  });

  // [C4]
  it('registerDisposable after disposeAll has started is a no-op', async () => {
    const lateFn = vi.fn();
    await disposeAll('unmount');
    registerDisposable(lateFn);
    // No second disposeAll pass runs, so lateFn is never invoked.
    expect(lateFn).not.toHaveBeenCalled();
  });

  // [C6] Disposer that returns a rejecting Promise — disposeAll continues
  it('disposer returning a rejecting Promise does not block subsequent disposers', async () => {
    const asyncRejecter = vi.fn(async () => {
      return Promise.reject(new Error('async reject'));
    });
    const after = vi.fn();
    registerDisposable(asyncRejecter);
    registerDisposable(after);
    await expect(disposeAll('app_quit')).resolves.toBeUndefined();
    expect(asyncRejecter).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  // [C7] Disposer that throws synchronously — disposeAll catches and continues
  it('disposer that throws synchronously does not block subsequent disposers', async () => {
    const syncThrower = vi.fn(() => {
      throw new TypeError('sync error');
    });
    const after = vi.fn();
    registerDisposable(syncThrower);
    registerDisposable(after);
    await expect(disposeAll('unmount')).resolves.toBeUndefined();
    expect(syncThrower).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  // [C5]
  it('disposers run sequentially in registration order', async () => {
    const order: string[] = [];
    registerDisposable(async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push('first');
    });
    registerDisposable(() => {
      order.push('second');
    });
    registerDisposable(async () => {
      order.push('third');
    });
    await disposeAll('app_quit');
    expect(order).toEqual(['first', 'second', 'third']);
  });
});
