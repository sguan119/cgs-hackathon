'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/store';
import { useRecallLifecycle } from './hooks/useRecallLifecycle';
import { useRecallSession } from './hooks/useRecallSession';
import { NoAnchorCard } from './NoAnchorCard';
import { QueryInput } from './QueryInput';
import { RecallCard } from './RecallCard';
import { RecallChrome } from './RecallChrome';
import { ToastRail } from './ToastRail';

export function RecallPanel() {
  const lifecycle = useRecallLifecycle();
  const session = useRecallSession();
  const [clientLabel, setClientLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get('current_client')
      .then((cid) => {
        if (cancelled) return;
        // Demo: Acme Industrial is the only real name per PRD §3.7.
        setClientLabel(cid === 'acme' ? 'Acme Industrial' : cid);
      })
      .catch(() => {
        if (!cancelled) setClientLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="recall-panel">
      <RecallChrome clientLabel={clientLabel} onClose={() => void lifecycle.close()} />
      <div className="recall-feed">
        {session.turns.length === 0 ? (
          <div className="recall-empty">
            Ask recall — precedents surface within a couple of seconds.
          </div>
        ) : null}
        {session.turns.map((t) =>
          t.status === 'no_anchor' || t.card.no_anchor ? (
            <NoAnchorCard key={t.id} query={t.query} />
          ) : (
            <RecallCard
              key={t.id}
              card={t.card}
              status={t.status}
              query={t.query}
              path={t.path}
            />
          )
        )}
      </div>
      <div className="recall-footer">
        <QueryInput
          onSubmit={(args) => void session.submit(args)}
          focusSignal={lifecycle.state.focusTick}
        />
        <ToastRail entries={session.toasts} onDismiss={session.dismissToast} />
      </div>
    </div>
  );
}
