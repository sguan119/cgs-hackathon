import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Capture the SHELL_MODE_CHANGED listener so tests can fire it manually.
let capturedListener: ((payload: unknown) => void) | null = null;
let capturedUnlisten: (() => void) | null = null;

vi.mock('@/lib/events', () => {
  return {
    EVENTS: {
      SHELL_MODE_CHANGED: 'shell:mode_changed',
      SHELL_REATTACH_REQUESTED: 'shell:reattach_requested',
    },
    emit: vi.fn(async () => {}),
    listen: vi.fn(async (_name: string, cb: (payload: unknown) => void) => {
      capturedListener = cb;
      const unlisten = vi.fn(() => {
        capturedListener = null;
      });
      capturedUnlisten = unlisten;
      return unlisten;
    }),
  };
});

describe('useShellMode hook', () => {
  beforeEach(() => {
    capturedListener = null;
    capturedUnlisten = null;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // [S1] Mock SHELL_MODE_CHANGED emission — hook updates state
  it('updates mode when SHELL_MODE_CHANGED event fires', async () => {
    const { useShellMode } = await import('@/app/(floating)/recall-panel/hooks/useShellMode');
    const { result } = renderHook(() => useShellMode());

    expect(result.current.mode).toBe('follow');

    // Wait for the async listen() to register
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      capturedListener?.({ mode: 'detached' });
    });

    expect(result.current.mode).toBe('detached');

    act(() => {
      capturedListener?.({ mode: 'follow' });
    });

    expect(result.current.mode).toBe('follow');
  });

  // [S2] Malformed payload (missing `mode`) — falls back to 'follow'
  it('falls back to follow when payload has no mode field', async () => {
    const { useShellMode } = await import('@/app/(floating)/recall-panel/hooks/useShellMode');
    const { result } = renderHook(() => useShellMode());

    await act(async () => {
      await Promise.resolve();
    });

    // Drive to detached first so we have a non-default state
    act(() => {
      capturedListener?.({ mode: 'detached' });
    });
    expect(result.current.mode).toBe('detached');

    // Malformed payload missing `mode` — should reset to 'follow'
    act(() => {
      capturedListener?.({});
    });
    expect(result.current.mode).toBe('follow');
  });

  // [S3] Unmount cleans up listener
  it('unmount calls the unlisten function returned by listen()', async () => {
    const { useShellMode } = await import('@/app/(floating)/recall-panel/hooks/useShellMode');
    const { unmount } = renderHook(() => useShellMode());

    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedUnlisten).not.toBeNull();
    unmount();

    // After unmount, capturedUnlisten should have been called (captured listener is cleared)
    expect(capturedListener).toBeNull();
  });
});
