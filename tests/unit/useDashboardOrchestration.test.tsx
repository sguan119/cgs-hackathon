/* @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardOrchestration } from '@/app/(main)/dashboard/hooks/useDashboardOrchestration';

describe('useDashboardOrchestration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reveals panels in order at the pinned offsets', () => {
    const { result } = renderHook(() => useDashboardOrchestration());

    expect(result.current.visible.size).toBe(0);

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.visible.has('client_identity')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.visible.has('relationship_stage')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(result.current.visible.has('interaction_timeline')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current.visible.has('ai_alerts')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.visible.has('external_signals')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.visible.has('context_loaded_badge')).toBe(true);
    expect(result.current.visible.size).toBe(6);
  });

  it('cancels pending timers on unmount without throwing setState warnings', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useDashboardOrchestration());

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(errSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('setState on an unmounted'),
      ...[]
    );
    // visible never flips past what was set before unmount
    expect(result.current.visible.has('ai_alerts')).toBe(false);
    errSpy.mockRestore();
  });

  it('elapsedMs advances from 0 to ≥28000 after full 28s timeline completes', () => {
    const { result } = renderHook(() => useDashboardOrchestration());
    expect(result.current.elapsedMs).toBe(0);
    act(() => {
      vi.advanceTimersByTime(28000);
    });
    // elapsedMs is driven by the fallback setTimeout tick (jsdom lacks rAF);
    // after 28s of fake-timer advances it must be ≥28000.
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(28000);
  });

  it('scroll/keyboard interactions do not interfere with the panel reveal sequence', () => {
    const { result } = renderHook(() => useDashboardOrchestration());
    // Simulate external DOM events that have no relationship to the hook.
    act(() => {
      vi.advanceTimersByTime(5000);
      // Dispatching synthetic events on document does not affect orchestration.
      document.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });
    expect(result.current.visible.has('client_identity')).toBe(true);
    expect(result.current.visible.has('relationship_stage')).toBe(true);
    // No extra panels beyond what the timeline dictates at this point.
    expect(result.current.visible.has('ai_alerts')).toBe(false);
  });

  it('StrictMode-style unmount → remount produces a single ordered reveal', () => {
    // Exercise the full unmount → remount cycle that React 18 StrictMode
    // runs in dev. The first mount must cancel its timers on unmount; the
    // second mount starts fresh from Set<empty>() and ends at exactly 6
    // panels, not 12 (which would indicate the old schedules leaked past
    // unmount and double-added).
    const first = renderHook(() => useDashboardOrchestration());
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(first.result.current.visible.size).toBe(2);
    first.unmount();

    const second = renderHook(() => useDashboardOrchestration());
    expect(second.result.current.visible.size).toBe(0);
    act(() => {
      vi.advanceTimersByTime(28000);
    });
    expect(second.result.current.visible.size).toBe(6);
    second.unmount();
  });
});
