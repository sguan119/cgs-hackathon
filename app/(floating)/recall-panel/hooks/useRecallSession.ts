'use client';

import { useCallback, useRef, useState } from 'react';
import { EVENTS, emit } from '@/lib/events';
import type { FollowupTurn } from '@/lib/llm/followup';
import { runRecallTurn, type RecallChainSource } from '@/lib/llm/recall-chain';
import type { ParserEvent, TagName } from '@/lib/llm/stream-parser';
import { get, set } from '@/lib/store';
import {
  emptyCard,
  type RecallCardFields,
  type RecallTurn,
  type RecallTurnStatus,
} from '../session-types';
import type { ToastRailEntry } from '../ToastRail';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function applyEvent(card: RecallCardFields, ev: ParserEvent): RecallCardFields {
  const field = ev.field as TagName;
  const next: RecallCardFields = { ...card, partial: { ...card.partial } };

  switch (field) {
    case 'year':
    case 'client':
    case 'scene':
      if (ev.isComplete) {
        next[field] = String(ev.value);
        delete next.partial[field];
      } else {
        next.partial[field] = String(ev.value);
      }
      return next;
    case 'fellow_voice':
      if (ev.isComplete) {
        next.fellow_voice = String(ev.value);
        delete next.partial.fellow_voice;
      } else {
        next.partial.fellow_voice = String(ev.value);
      }
      return next;
    case 'tag':
      if (ev.isComplete) next.tags = [...next.tags, String(ev.value)];
      return next;
    case 'quote':
      if (ev.isComplete) next.quotes = [...next.quotes, String(ev.value)];
      return next;
    case 'source_id':
      if (ev.isComplete) next.source_id = String(ev.value);
      return next;
    case 'no_anchor':
      next.no_anchor = true;
      return next;
    case 'done':
      return next;
    default:
      return card;
  }
}

function toFollowupTurn(t: RecallTurn): FollowupTurn {
  return {
    query: t.query,
    card: {
      year: t.card.year,
      client: t.card.client,
      scene: t.card.scene,
      quotes: t.card.quotes,
      tags: t.card.tags,
    },
    precedentId: t.precedentId,
  };
}

export function useRecallSession() {
  const [turns, setTurns] = useState<RecallTurn[]>([]);
  const [toasts, setToasts] = useState<ToastRailEntry[]>([]);
  const activeAbort = useRef<AbortController | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const submit = useCallback(
    async (args: { query: string; source: 'scripted' | 'free-text'; scriptedId?: string }) => {
      // Served-from-cache turns are semantically complete for follow-up
      // context purposes (reviewer N1) — the card shape is identical.
      const priorTurns = turns
        .filter((t) => t.status === 'complete' || t.status === 'offline')
        .map(toFollowupTurn);
      // Preserve the inbound source so the chain can still use the
      // pre-baked scripted embedding and offline-cache path after turn 1
      // (reviewer B4). "Is follow-up" is derived from priorTurns.length
      // inside recall-chain, not from source.
      const source: RecallChainSource = args.source;

      const id = newId();
      const turn: RecallTurn = {
        id,
        query: args.query,
        status: 'pending',
        latencyMs: null,
        source,
        path: null,
        card: emptyCard(),
        precedentId: null,
      };
      setTurns((cur) => [...cur, turn]);

      // Reviewer-4 B2: abort any in-flight chain from a previous submit
      // so rapid double-submits don't run concurrent chains racing on
      // setTurns.
      activeAbort.current?.abort();
      const ctrl = new AbortController();
      activeAbort.current = ctrl;

      const clientId = await get('current_client').catch(() => null);
      const updateStatus = (status: RecallTurnStatus): void =>
        setTurns((cur) => cur.map((t) => (t.id === id ? { ...t, status } : t)));

      updateStatus('retrieving');

      const chain = runRecallTurn({
        query: args.query,
        source,
        scriptedId: args.scriptedId,
        priorTurns,
        clientId,
        signal: ctrl.signal,
        onAttempt: (attempt) => {
          if (attempt > 1) {
            updateStatus('retrying');
            setToasts((cur) => [
              ...cur.filter((t) => !t.id.startsWith(`retry-${id}`)),
              {
                id: `retry-${id}-${attempt}`,
                variant: 'loading',
                text: `Reconnecting to recall (attempt ${attempt}/3)…`,
              },
            ]);
          }
        },
        onDegrade: (reason) => {
          updateStatus(reason === 'offline' ? 'offline' : 'no_anchor');
        },
      });

      let sawFirst = false;
      (async () => {
        try {
          for await (const ev of chain.events) {
            if (!sawFirst) {
              sawFirst = true;
              setTurns((cur) =>
                cur.map((t) =>
                  t.id === id && t.status === 'retrieving'
                    ? { ...t, status: 'streaming' }
                    : t
                )
              );
            }
            setTurns((cur) =>
              cur.map((t) => (t.id === id ? { ...t, card: applyEvent(t.card, ev) } : t))
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setTurns((cur) =>
            cur.map((t) => (t.id === id ? { ...t, status: 'failed', error: message } : t))
          );
        }
      })();

      try {
        const result = await chain.done;
        setToasts((cur) => cur.filter((t) => !t.id.startsWith(`retry-${id}`)));
        setTurns((cur) =>
          cur.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status:
                    result.path === 'offline'
                      ? 'offline'
                      : result.path === 'no-anchor'
                        ? 'no_anchor'
                        : 'complete',
                  latencyMs: result.latencyMs,
                  path: result.path,
                  precedentId: result.precedentId,
                }
              : t
          )
        );
        // Write recall_history only when we have a precedent id (plan §5.11
        // guidance — skip null writes so the demo history looks clean).
        if (result.precedentId) {
          try {
            const hist = await get('recall_history');
            await set('recall_history', [
              ...hist,
              { query: args.query, precedent_id: result.precedentId, ts: Date.now() },
            ]);
            await emit(EVENTS.RECALL_QUERY_COMPLETE, {
              query: args.query,
              precedent_id: result.precedentId,
            });
          } catch {
            // Store writes can fail outside Tauri — non-fatal.
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setToasts((cur) => cur.filter((t) => !t.id.startsWith(`retry-${id}`)));
        setTurns((cur) =>
          cur.map((t) => (t.id === id ? { ...t, status: 'failed', error: message } : t))
        );
      } finally {
        if (activeAbort.current === ctrl) activeAbort.current = null;
      }
    },
    [turns]
  );

  return { turns, toasts, dismissToast, submit };
}
