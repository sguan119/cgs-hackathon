'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ToastRailEntry } from '@/app/(floating)/recall-panel/ToastRail';
import { INITIAL_DIFF_STATE, reduceDiff, type DiffState } from '@/lib/override/diff';
import type { InertiaHypothesis, StrategyDimensionId } from '@/lib/override/dims';
import { OVERRIDE_TURN_BUDGET_MS, runOverrideTurn } from '@/lib/override/override-chain';

// Turn-log state machine for the Fellow-Override session. The React state
// holds the running turn list + per-turn AbortController + the diff state
// being accumulated from the live event stream.
//
// Rules (plan §6.9):
//   - Concurrent dispatch on SAME dim → abort the in-flight turn, replace
//     with a fresh one. The earlier turn transitions to `aborted`.
//   - Concurrent dispatch on DIFFERENT dim → leave the in-flight turn
//     running; it becomes `superseded` once the new turn commits.
//   - 45s budget enforced via an AbortController timeout; on abort the
//     turn transitions to `failed` with a Toast.

export type OverrideTurnStatus =
  | 'pending'
  | 'hit'
  | 'streaming'
  | 'retrying'
  | 'superseded'
  | 'aborted'
  | 'complete'
  | 'failed';

export type OverrideTurn = {
  id: string;
  dimension: StrategyDimensionId;
  prevScore: number;
  nextScore: number;
  status: OverrideTurnStatus;
  path: 'cache' | 'stream' | null;
  latencyMs: number | null;
  startedAt: number;
  diff: DiffState;
  error?: string;
};

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `override-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useOverrideSession(clientId: string | null) {
  const [turns, setTurns] = useState<OverrideTurn[]>([]);
  const [toasts, setToasts] = useState<ToastRailEntry[]>([]);
  // Map of in-flight AbortControllers keyed by turn id so a dispatch can
  // abort either the same-dim predecessor or the 45s timeout.
  const abortsRef = useRef<Map<string, AbortController>>(new Map());
  // Synchronous turnId → dim map maintained alongside `abortsRef` so a
  // second dispatch in the same tick (before the render committing the
  // first turn flushes) can still find and abort it. Reviewer-3 B1:
  // `turnsRef` synced via `useEffect` runs AFTER the render, so a
  // same-tick double dispatch would otherwise miss the first turn.
  const turnDimsRef = useRef<Map<string, StrategyDimensionId>>(new Map());

  useEffect(() => {
    // Copy the refs on mount so the cleanup function doesn't capture a
    // later-reassigned Map (react-hooks/exhaustive-deps guidance).
    const aborts = abortsRef.current;
    const dims = turnDimsRef.current;
    return () => {
      for (const ctrl of aborts.values()) ctrl.abort();
      aborts.clear();
      dims.clear();
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const patchTurn = useCallback((id: string, patch: Partial<OverrideTurn>) => {
    setTurns((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const dispatch = useCallback(
    (args: { dimension: StrategyDimensionId; prevScore: number; nextScore: number }) => {
      // Abort any in-flight turn on the same dimension (plan §7.3).
      // Reviewer-3 B1: use the synchronously-maintained turnDimsRef so a
      // same-tick double dispatch reliably finds the predecessor (turnsRef
      // would still be pre-first-dispatch because useEffect runs after
      // render). Side effects live in the outer loop; setTurns is pure.
      const turnsToAbort: string[] = [];
      for (const [tid, dim] of turnDimsRef.current.entries()) {
        if (dim !== args.dimension) continue;
        const ctrlExisting = abortsRef.current.get(tid);
        if (!ctrlExisting) continue;
        turnsToAbort.push(tid);
        ctrlExisting.abort();
        abortsRef.current.delete(tid);
        turnDimsRef.current.delete(tid);
      }
      if (turnsToAbort.length > 0) {
        const toAbortSet = new Set(turnsToAbort);
        setTurns((prev) =>
          prev.map((t) =>
            toAbortSet.has(t.id) ? { ...t, status: 'aborted' as const } : t
          )
        );
      }

      const id = newId();
      const ctrl = new AbortController();
      abortsRef.current.set(id, ctrl);
      turnDimsRef.current.set(id, args.dimension);
      const startedAt =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();

      const turn: OverrideTurn = {
        id,
        dimension: args.dimension,
        prevScore: args.prevScore,
        nextScore: args.nextScore,
        status: 'pending',
        path: null,
        latencyMs: null,
        startedAt,
        diff: INITIAL_DIFF_STATE as DiffState,
      };
      setTurns((cur) => [...cur, turn]);

      // 45-second budget guard. If the chain hasn't resolved by then, abort
      // and mark failed. `budgetTripped` lets the catch-branch below skip
      // the generic error Toast — otherwise both a budget Toast AND an
      // error Toast would stack (reviewer N2).
      let budgetTripped = false;
      const budgetTimer = setTimeout(() => {
        if (!abortsRef.current.has(id)) return;
        budgetTripped = true;
        ctrl.abort();
        // Reviewer-4 N1: invariant promises both refs are cleared on
        // done / catch / budget / abort / unmount. Budget path was
        // missing the abortsRef delete — add it so later dispatches
        // don't see a stale entry between this callback and the
        // async catch that follows (which will no-op its own delete).
        abortsRef.current.delete(id);
        turnDimsRef.current.delete(id);
        patchTurn(id, { status: 'failed', error: 'budget-exceeded' });
        setToasts((cur) => [
          ...cur.filter((t) => t.id !== `override-${id}-budget`),
          {
            id: `override-${id}-budget`,
            variant: 'warning',
            text: 'Override exceeded 45s budget — showing partial result.',
          },
        ]);
      }, OVERRIDE_TURN_BUDGET_MS);

      const { events, done } = runOverrideTurn({
        dimension: args.dimension,
        prevScore: args.prevScore,
        nextScore: args.nextScore,
        clientId,
        signal: ctrl.signal,
        onAttempt: (attempt) => {
          if (attempt > 1) {
            patchTurn(id, { status: 'retrying' });
            setToasts((cur) => [
              ...cur.filter((t) => !t.id.startsWith(`retry-${id}`)),
              {
                id: `retry-${id}-${attempt}`,
                variant: 'loading',
                text: `Reconnecting override (attempt ${attempt}/3)…`,
              },
            ]);
          }
        },
        // Reviewer N5: thread the retry-wait callback so the Toast rail
        // shows "Retrying in Xs…" during backoff (mirrors Phase 2A
        // RecallPanel). Updates the existing retry banner in place.
        onRetryWait: (attempt, waitMs) => {
          const seconds = Math.ceil(waitMs / 1000);
          setToasts((cur) => [
            ...cur.filter((t) => !t.id.startsWith(`retry-${id}`)),
            {
              id: `retry-${id}-wait-${attempt}`,
              variant: 'loading',
              text: `Retrying in ${seconds}s (attempt ${attempt}/3)…`,
            },
          ]);
        },
      });

      let sawFirst = false;
      (async () => {
        try {
          for await (const ev of events) {
            if (!sawFirst) {
              sawFirst = true;
              patchTurn(id, { status: 'streaming' });
            }
            setTurns((cur) =>
              cur.map((t) => (t.id === id ? { ...t, diff: reduceDiff(t.diff, ev) } : t))
            );
          }
        } catch {
          // Consumer-side iteration errors are handled via `done`.
        }
      })();

      (async () => {
        try {
          const result = await done;
          clearTimeout(budgetTimer);
          abortsRef.current.delete(id);
          turnDimsRef.current.delete(id);
          // Demote older in-flight turns for OTHER dims to `superseded`
          // because the latest-dim-wins rule applies across the session.
          setTurns((cur) =>
            cur.map((t) => {
              if (t.id === id) {
                return {
                  ...t,
                  status: result.path === 'cache' ? 'hit' : 'complete',
                  path: result.path,
                  latencyMs: result.latencyMs,
                };
              }
              if (
                t.status === 'hit' ||
                t.status === 'complete' ||
                t.status === 'streaming' ||
                t.status === 'retrying'
              ) {
                return { ...t, status: 'superseded' };
              }
              return t;
            })
          );
          setToasts((cur) => cur.filter((t) => !t.id.startsWith(`retry-${id}`)));
        } catch (err) {
          clearTimeout(budgetTimer);
          // Reviewer-4 N3: abortsRef / turnDimsRef may already be empty
          // if the budget path ran first and cleaned up. Map.delete on a
          // missing key is a no-op — safe, no guard needed.
          abortsRef.current.delete(id);
          turnDimsRef.current.delete(id);
          // Budget timeout already patched the turn + emitted a warning
          // Toast above. Skip the generic error Toast to avoid stacking
          // two banners for the same failure (reviewer N2).
          if (budgetTripped) {
            setToasts((cur) => cur.filter((t) => !t.id.startsWith(`retry-${id}`)));
            return;
          }
          const message = err instanceof Error ? err.message : String(err);
          patchTurn(id, { status: 'failed', error: message });
          setToasts((cur) => [
            ...cur.filter((t) => !t.id.startsWith(`retry-${id}`)),
            {
              id: `override-${id}-err`,
              variant: 'error',
              text: 'Override failed — keeping prior assessment.',
            },
          ]);
        }
      })();

      return id;
    },
    [clientId, patchTurn]
  );

  // Active turn for the VISIBLE card list — the last non-aborted/failed
  // turn's diff.incoming drives the incoming card render, and its origin
  // dim is the one we crimson-pulse. Memoized (reviewer-3 N1) so the
  // IIFE doesn't re-run on every render for unrelated state updates.
  const activeTurn = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i]!;
      if (t.status === 'aborted' || t.status === 'failed') continue;
      return t;
    }
    return null;
  }, [turns]);

  const incomingHypotheses: Partial<InertiaHypothesis>[] = activeTurn
    ? activeTurn.diff.incoming
    : [];

  return {
    turns,
    toasts,
    dismissToast,
    dispatch,
    activeTurn,
    incomingHypotheses,
  };
}
