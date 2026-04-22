'use client';

import type { DashboardAlert } from './types';

const KIND_LABEL: Record<DashboardAlert['kind'], string> = {
  retainer_renewal_risk: 'Retainer renewal risk',
  exec_email_overdue: 'Unanswered exec email',
  pre_rfp_signal: 'Pre-RFP signal',
  prospect_cooling: 'Prospect cooling',
};

export function AlertsCard({ alerts }: { alerts: readonly DashboardAlert[] }) {
  const highCount = alerts.filter((a) => a.severity === 'high').length;
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Alerts</div>
        <span className={`tag${highCount > 0 ? ' crimson' : ''}`}>
          {highCount} high
        </span>
      </div>
      <div className="card-b dashboard-alerts-body">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`dashboard-alert dashboard-alert-${a.severity}`}
            data-testid={`dashboard-alert-${a.id}`}
          >
            <div className="dashboard-alert-kicker">{KIND_LABEL[a.kind]}</div>
            <div className="dashboard-alert-text">{a.text}</div>
            {a.source ? (
              <div className="dashboard-alert-source">source · {a.source}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
