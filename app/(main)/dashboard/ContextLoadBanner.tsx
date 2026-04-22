'use client';

import { formatElapsedMs } from './hooks/useDashboardOrchestration';

export function ContextLoadBanner({
  seconds,
  visible,
  elapsedMs,
}: {
  seconds: number;
  visible: boolean;
  elapsedMs: number;
}) {
  return (
    <div
      className="dashboard-context-banner"
      data-visible={visible ? 1 : 0}
      role="status"
      aria-live="polite"
    >
      <span className="live-dot dashboard-context-banner-dot" />
      <span>
        <strong>Context loaded</strong> · {seconds}s · 217 artefacts
      </span>
      <span className="dashboard-context-banner-meta">
        under 30s · <span data-testid="dashboard-ms-timer">{formatElapsedMs(elapsedMs)}</span>
      </span>
    </div>
  );
}
