/* @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributeStrip } from '@/app/(main)/datahub/DistributeStrip';

describe('DistributeStrip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('initial state is dim with status "Idle"', () => {
    render(<DistributeStrip />);
    const strip = screen.getByTestId('distribute-strip');
    expect(strip.getAttribute('data-state')).toBe('dim');
    expect(strip.getAttribute('data-status')).toBe('idle');
    expect(screen.getByTestId('distribute-status').textContent).toBe('Idle');
  });

  it('click Push shows "Distributing…" BEFORE the 1600ms tick, "Connected" AFTER', () => {
    render(<DistributeStrip />);
    const push = screen.getByTestId('distribute-push');
    fireEvent.click(push);
    // Synchronously on click: status flips to distributing with its label.
    expect(screen.getByTestId('distribute-status').textContent).toBe(
      'Distributing…'
    );
    const strip = screen.getByTestId('distribute-strip');
    expect(strip.getAttribute('data-status')).toBe('distributing');

    // rAF + partial wait < 1600ms — still "Distributing…"
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(strip.getAttribute('data-state')).toBe('active');
    expect(screen.getByTestId('distribute-status').textContent).toBe(
      'Distributing…'
    );
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('distribute-status').textContent).toBe(
      'Distributing…'
    );

    // Cross the 1600ms threshold — now "Connected".
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(strip.getAttribute('data-status')).toBe('connected');
    expect(screen.getByTestId('distribute-status').textContent).toBe(
      'Connected · 4 sources'
    );
  });

  it('second Push resets to Distributing and re-triggers the 1600ms delay', () => {
    render(<DistributeStrip />);
    const push = screen.getByTestId('distribute-push');
    fireEvent.click(push);
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(screen.getByTestId('distribute-status').textContent).toBe(
      'Connected · 4 sources'
    );

    // Second click — status flips back to distributing synchronously.
    fireEvent.click(push);
    expect(screen.getByTestId('distribute-status').textContent).toBe(
      'Distributing…'
    );
    const strip = screen.getByTestId('distribute-strip');
    expect(strip.getAttribute('data-state')).toBe('dim');
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(strip.getAttribute('data-state')).toBe('active');
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByTestId('distribute-status').textContent).toBe(
      'Connected · 4 sources'
    );
  });

  it('renders exactly 4 downstream lights', () => {
    render(<DistributeStrip />);
    const cells = document.querySelectorAll('.distribute-lights-cell');
    expect(cells.length).toBe(4);
  });

  it('unmount before 1600ms completes leaves no dangling timer — no console error', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<DistributeStrip />);
    const push = screen.getByTestId('distribute-push');
    fireEvent.click(push);
    // Advance past rAF tick but before the 1600ms connected timeout.
    act(() => {
      vi.advanceTimersByTime(20);
    });
    // Unmount while the 1600ms timer is still pending.
    unmount();
    // Drain remaining fake time — the pending timer must be cancelled; no
    // setState-on-unmounted React warning should appear.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(errSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('setState on an unmounted'),
      ...[]
    );
    errSpy.mockRestore();
  });
});
