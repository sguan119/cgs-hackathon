'use client';

import type { DashboardExternalSignal } from './types';

export function ExternalSignals({
  signals,
}: {
  signals: readonly DashboardExternalSignal[];
}) {
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">External signals</div>
        <span className="tag">auto</span>
      </div>
      <div className="card-b dashboard-signals-body">
        {signals.map((s) => (
          <div
            key={s.id}
            className="dashboard-signal-row"
            data-testid={`dashboard-signal-${s.id}`}
          >
            <div className="dashboard-signal-t">{s.t}</div>
            <div className="dashboard-signal-headline">{s.headline}</div>
            <div className="dashboard-signal-relevance">
              {Math.round(s.relevance * 100)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
