/* @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock `@/lib/store` before importing the component — DiagnosticPage reads
// `wheel_scores` and `current_client` via the Tauri plugin-store wrapper,
// which is not available in happy-dom. The mock keeps an in-memory map so
// O21 (refresh preserves scores) can assert round-trip behaviour.
const storeMem: Record<string, unknown> = {};
vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/store')>('@/lib/store');
  return {
    ...actual,
    get: vi.fn(async (key: string) => storeMem[key] ?? actual.SESSION_DEFAULTS[key as keyof typeof actual.SESSION_DEFAULTS]),
    set: vi.fn(async (key: string, value: unknown) => {
      storeMem[key] = value;
    }),
    subscribe: vi.fn(async () => () => undefined),
    resetSession: vi.fn(async () => {
      for (const k of Object.keys(storeMem)) delete storeMem[k];
    }),
  };
});

// Mock the override-chain so the test doesn't attempt to hit Anthropic.
vi.mock('@/lib/override/override-chain', async () => {
  const actual = await vi.importActual<typeof import('@/lib/override/override-chain')>(
    '@/lib/override/override-chain'
  );
  return {
    ...actual,
    runOverrideTurn: vi.fn(() => {
      // Iterable that yields a single <done/> event so the diff resolves
      // deterministically without hitting the cache or the stream.
      const iterable: AsyncIterable<unknown> = {
        async *[Symbol.asyncIterator]() {
          // no events — the test cares about the wheel + card structure
        },
      };
      return {
        events: iterable,
        done: Promise.resolve({
          path: 'stream' as const,
          bucket: 'mid' as const,
          latencyMs: 0,
          rationale: null,
          hypotheses: [],
        }),
      };
    }),
  };
});

import { DiagnosticPage } from '@/app/(main)/diagnostic/DiagnosticPage';

afterEach(() => {
  cleanup();
  for (const k of Object.keys(storeMem)) delete storeMem[k];
  vi.clearAllMocks();
});

describe('DiagnosticPage — B4 jsdom coverage (O19, O20, O21)', () => {
  it('O19: wheel renders 7 sector spinbuttons and they are focusable', async () => {
    render(<DiagnosticPage />);
    const sectors = await screen.findAllByRole('spinbutton');
    // Seven strategy dims + the ScoreEditor's number input is a
    // spinbutton too when it opens; before any click we expect exactly 7.
    expect(sectors).toHaveLength(7);
    sectors[0]?.focus();
    expect(document.activeElement).toBe(sectors[0]);
  });

  it('O19: Enter on a focused sector opens the ScoreEditor', async () => {
    render(<DiagnosticPage />);
    const sectors = await screen.findAllByRole('spinbutton');
    const first = sectors[0]!;
    first.focus();
    fireEvent.keyDown(first, { key: 'Enter' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-label')).toMatch(/edit .* score/i);
  });

  it('O19: ArrowUp on a focused sector commits a +1 increment (fast-path)', async () => {
    render(<DiagnosticPage />);
    const sectors = await screen.findAllByRole('spinbutton');
    // external_sensing is the first dim per STRATEGY_WHEEL_DIMS; default 4.
    const first = sectors[0]!;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    // The sector's aria-valuenow should reflect the new score.
    await act(async () => {
      /* flush scheduled setState */
    });
    const updatedLabel = first.getAttribute('aria-valuetext') ?? '';
    expect(updatedLabel).toMatch(/External Sensing: 5/);
  });

  it('O20: baseline hypothesis cards render by default with the baseline mode class', async () => {
    // Reviewer-3 N2: structural assertion on class + count, not fixture
    // text — Phase 3.2 content can land without breaking this test.
    const { container } = render(<DiagnosticPage />);
    await act(async () => {
      /* flush useEffect */
    });
    const baselineCards = container.querySelectorAll('.hypothesis-card--baseline');
    expect(baselineCards.length).toBeGreaterThanOrEqual(1);
  });

  it('B2 fallback: dispatching on a dim with no stored score does not crash (prevScore defaults to 1)', async () => {
    // Seed wheel_scores with a partial map that is missing one dim to
    // force the `scores[dim] ?? 1` branch. commitScore → dispatch should
    // proceed without throwing.
    storeMem.wheel_scores = { strategic_innovation: 2 } as Record<string, number>;
    render(<DiagnosticPage />);
    await act(async () => {
      /* flush useEffect */
    });
    const sectors = await screen.findAllByRole('spinbutton');
    const first = sectors[0]!;
    first.focus();
    expect(() => fireEvent.keyDown(first, { key: 'ArrowUp' })).not.toThrow();
  });

  it('O21: wheel_scores persist via the mocked store across remount', async () => {
    const { unmount } = render(<DiagnosticPage />);
    // First mount seeds DEFAULT_WHEEL_SCORES into the store.
    await act(async () => {
      /* flush useEffect */
    });
    expect(storeMem.wheel_scores).toBeDefined();
    const seeded = { ...(storeMem.wheel_scores as Record<string, number>) };
    unmount();
    // Remount — the stored value must survive.
    render(<DiagnosticPage />);
    expect(storeMem.wheel_scores).toEqual(seeded);
  });
});
