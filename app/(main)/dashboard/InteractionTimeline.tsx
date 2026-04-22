'use client';

import {
  resolveEventRoute,
  type DashboardTimelineEvent,
} from '@/lib/dashboard/dashboard-timeline';

const KIND_BADGE: Record<DashboardTimelineEvent['kind'], string> = {
  meeting: 'MTG',
  earnings: 'ERN',
  email: 'EML',
  memo: 'MEM',
  project: 'PRJ',
  signal: 'SIG',
};

const ROUTE_LABEL: Record<
  ReturnType<typeof resolveEventRoute>,
  string
> = {
  recall: 'Recall',
  diagnostic: 'Diagnostic',
  continuity: 'Continuity',
  meeting: 'Meeting',
};

export function InteractionTimeline({
  items,
  onItemClick,
}: {
  items: readonly DashboardTimelineEvent[];
  onItemClick: (_event: DashboardTimelineEvent) => void;
}) {
  return (
    <div className="dashboard-timeline">
      {items.map((item) => {
        const route = resolveEventRoute(item);
        return (
          <button
            type="button"
            key={item.id}
            className="dashboard-timeline-row"
            data-testid={`timeline-row-${item.id}`}
            onClick={() => onItemClick(item)}
          >
            <span className="dashboard-timeline-t">
              {item.t}
              <span className="dashboard-timeline-badge">{KIND_BADGE[item.kind]}</span>
            </span>
            <span className="dashboard-timeline-body">
              <span className="dashboard-timeline-label">{item.label}</span>
              {item.sub ? (
                <span className="dashboard-timeline-sub">{item.sub}</span>
              ) : null}
            </span>
            <span className="dashboard-timeline-route">→ {ROUTE_LABEL[route]}</span>
          </button>
        );
      })}
    </div>
  );
}
