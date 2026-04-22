/* @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { DashboardPage } from '@/app/(main)/dashboard/DashboardPage';
import { routeEventToSurface, type DashboardTimelineEvent } from '@/lib/dashboard/dashboard-timeline';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders ClientSwitcher + header immediately; timer chip appears after mount', () => {
    render(<DashboardPage />);
    // "Acme Industrial" appears in the client switcher chip and the H1 — at
    // least one match is the contract we care about.
    const acme = screen.getAllByText('Acme Industrial');
    expect(acme.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Clients · /)).toBeTruthy();
    // Timer chip mounts after the initial useEffect flush
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByTestId('dashboard-timer-chip')).toBeTruthy();
  });

  it('client_identity panel is visible at t=0; others are hidden until their slot', () => {
    render(<DashboardPage />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(
      screen.getByTestId('dashboard-panel-client_identity').getAttribute('data-visible')
    ).toBe('1');
    expect(
      screen.getByTestId('dashboard-panel-relationship_stage').getAttribute('data-visible')
    ).toBe('0');
  });

  it('panels flip data-visible at their scheduled slots', () => {
    render(<DashboardPage />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      screen.getByTestId('dashboard-panel-relationship_stage').getAttribute('data-visible')
    ).toBe('1');
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(
      screen.getByTestId('dashboard-panel-interaction_timeline').getAttribute('data-visible')
    ).toBe('1');
  });

  it('clicking a "meeting" kind timeline row pushes /meeting', () => {
    render(<DashboardPage />);
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    const row = screen.getByTestId('timeline-row-t1');
    fireEvent.click(row);
    expect(pushMock).toHaveBeenCalledWith('/meeting');
  });

  it('clicking a "signal" kind row pushes /continuity', () => {
    render(<DashboardPage />);
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    const row = screen.getByTestId('timeline-row-t6');
    fireEvent.click(row);
    expect(pushMock).toHaveBeenCalledWith('/continuity');
  });

  it('clicking a "earnings" kind row pushes /diagnostic', () => {
    render(<DashboardPage />);
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    const row = screen.getByTestId('timeline-row-t2');
    fireEvent.click(row);
    expect(pushMock).toHaveBeenCalledWith('/diagnostic');
  });

  it('does NOT render the Phase 4.1 placeholder text', () => {
    render(<DashboardPage />);
    expect(screen.queryByText(/Phase 4\.[0-9]+ will fill this/)).toBeNull();
  });

  it('event click with unknown DashboardEventKind does not throw', () => {
    // Cast to simulate an unknown kind at runtime (e.g. a future fixture entry).
    const unknownEvent = {
      id: 'evt-unknown',
      t: 'Apr 21',
      kind: 'unknown_kind_xyz' as DashboardTimelineEvent['kind'],
      label: 'Unknown event',
    };
    let threw = false;
    try {
      routeEventToSurface(unknownEvent, pushMock);
    } catch {
      threw = true;
    }
    // No throw is the contract — the resolved path may be unexpected but the
    // function must not crash the renderer.
    expect(threw).toBe(false);
  });
});
