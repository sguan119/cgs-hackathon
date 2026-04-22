/* @vitest-environment happy-dom */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitMock = vi.fn(async (..._args: unknown[]) => undefined);
const setMock = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock('@/lib/events', () => ({
  EVENTS: {
    MEETING_START: 'meeting:start',
    MEETING_END: 'meeting:end',
    RECALL_QUERY_COMPLETE: 'recall:query_complete',
    SHELL_MAIN_MOVED: 'shell:main_moved',
    SHELL_MAIN_RESIZED: 'shell:main_resized',
    SHELL_MODE_CHANGED: 'shell:mode_changed',
    SHELL_APP_QUIT: 'shell:app_quit',
    SHELL_REATTACH_REQUESTED: 'shell:reattach_requested',
  },
  emit: (name: string, payload: unknown) => emitMock(name, payload),
  listen: vi.fn(async () => () => undefined),
}));

vi.mock('@/lib/store', () => ({
  set: (k: string, v: unknown) => setMock(k, v),
  get: vi.fn(async () => null),
  subscribe: vi.fn(async () => () => undefined),
  resetSession: vi.fn(async () => undefined),
  SESSION_DEFAULTS: {
    current_client: null,
    meeting_state: 'idle',
    recall_history: [],
    thesis_diff_state: 'before_m1',
    wheel_scores: {},
  },
}));

import { MeetingPage } from '@/app/(main)/meeting/MeetingPage';

describe('MeetingPage', () => {
  beforeEach(() => {
    emitMock.mockClear();
    setMock.mockClear();
    // Mock fetch to resolve OK so video path is taken initially.
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(
      async () =>
        new Response(null, { status: 200 })
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('emits meeting:start + writes store on mount', async () => {
    render(<MeetingPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(setMock).toHaveBeenCalledWith('current_client', 'acme');
    expect(setMock).toHaveBeenCalledWith('meeting_state', 'in_meeting');
    expect(emitMock).toHaveBeenCalledWith('meeting:start', { client_id: 'acme' });
  });

  it('emits meeting:end on unmount', async () => {
    const { unmount } = render(<MeetingPage />);
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(emitMock).toHaveBeenCalledWith('meeting:end', {});
  });

  it('renders the SharedDeckPane', () => {
    render(<MeetingPage />);
    expect(screen.getByTestId('shared-deck-pane')).toBeTruthy();
  });

  it('falls back to CSS placeholder when HEAD returns 404', async () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(
      async () =>
        new Response(null, { status: 404 })
    ) as unknown as typeof fetch;
    render(<MeetingPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('fake-zoom-fallback')).toBeTruthy();
  });

  it('renders the <video> element by default when HEAD is OK', async () => {
    render(<MeetingPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const video = screen.getByTestId('fake-zoom-video') as HTMLVideoElement;
    expect(video).toBeTruthy();
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.autoplay).toBe(true);
  });

  it('unmount mid-mount emits meeting:end exactly once — HEAD-check IIFE cancel flag prevents double emit', async () => {
    const { unmount } = render(<MeetingPage />);
    // Flush the start IIFE but unmount immediately after.
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    // Drain the unmount IIFE's async chain.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const endCalls = emitMock.mock.calls.filter(
      (args) => args[0] === 'meeting:end'
    );
    expect(endCalls.length).toBe(1);
  });
});
