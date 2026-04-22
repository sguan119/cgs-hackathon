'use client';

import { useEffect, useState } from 'react';
import { ContextStrip } from './ContextStrip';
import { useShellMode } from './hooks/useShellMode';
import { ReattachButton } from './ReattachButton';

type Props = {
  clientLabel: string | null;
  onClose: () => void;
};

function useLiveTimer(): string {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 1_000);
    return () => clearInterval(id);
  }, []);
  const mm = Math.floor(t / 60)
    .toString()
    .padStart(2, '0');
  const ss = (t % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function RecallChrome({ clientLabel, onClose }: Props) {
  const timer = useLiveTimer();
  const { mode, reattach } = useShellMode();
  return (
    <header className="recall-chrome">
      <div className="recall-chrome-top">
        <span className="recall-live">
          <span className="live-dot" />
          LIVE
        </span>
        <span className="recall-timer">{timer}</span>
        {clientLabel ? <span className="recall-client">· {clientLabel}</span> : null}
        {mode === 'detached' ? <ReattachButton onReattach={reattach} /> : null}
        <button
          type="button"
          className="recall-close"
          onClick={onClose}
          aria-label="Close recall panel"
        >
          ×
        </button>
      </div>
      <ContextStrip />
    </header>
  );
}
