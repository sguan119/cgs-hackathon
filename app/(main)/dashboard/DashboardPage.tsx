'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import dashboardFixture from '@/fixtures/dashboard_fixtures/dashboard.json';
import datahubFixture from '@/fixtures/datahub_fixtures/datahub.json';
import {
  routeEventToSurface,
  type DashboardTimelineEvent,
} from '@/lib/dashboard/dashboard-timeline';
import { AlertsCard } from './AlertsCard';
import { ClientSwitcher } from './ClientSwitcher';
import { ContextLoadBanner } from './ContextLoadBanner';
import { ExternalSignals } from './ExternalSignals';
import { useDashboardOrchestration } from './hooks/useDashboardOrchestration';
import { InteractionTimeline } from './InteractionTimeline';
import { RelationshipStage } from './RelationshipStage';
import { ThesisMemoryToggle } from './ThesisMemoryToggle';
import type { DashboardFixture, DataHubFixture } from './types';
import { formatElapsedMs } from './hooks/useDashboardOrchestration';

const DASHBOARD = dashboardFixture as DashboardFixture;
const DATAHUB = datahubFixture as DataHubFixture;

export function DashboardPage() {
  const router = useRouter();
  const { visible, elapsedMs } = useDashboardOrchestration();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onTimelineClick = useCallback(
    (event: DashboardTimelineEvent) => {
      routeEventToSurface(event, (path) => router.push(path));
    },
    [router]
  );

  return (
    <section className="page dashboard-page">
      {mounted ? (
        <div
          className="dashboard-timer-chip"
          aria-hidden="true"
          data-testid="dashboard-timer-chip"
        >
          {formatElapsedMs(elapsedMs)}
        </div>
      ) : null}

      <ClientSwitcher
        clients={DATAHUB.crmRows}
        activeName={DASHBOARD.client.name}
      />

      <section
        className="dashboard-panel"
        data-panel="client_identity"
        data-visible={visible.has('client_identity') ? 1 : 0}
        data-testid="dashboard-panel-client_identity"
      >
        <div className="page-header">
          <div>
            <div className="crumb">§5 · Dashboard</div>
            <h1>
              {DASHBOARD.client.name} <em>— client workspace</em>
            </h1>
            <div className="dashboard-client-tags">
              <span className="tag">{DASHBOARD.client.industry}</span>
              <span className="tag sage">● {DASHBOARD.client.retainer}</span>
            </div>
          </div>
          <div className="dashboard-header-meta">
            <div className="meta">
              Next · <span className="dashboard-header-next">{DASHBOARD.client.nextContact}</span>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => router.push('/meeting')}
              >
                Enter meeting <span className="kbd">⌘K</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <ContextLoadBanner
        seconds={DASHBOARD.contextLoadSec}
        visible={visible.has('context_loaded_badge')}
        elapsedMs={elapsedMs}
      />

      <section
        className="dashboard-panel"
        data-panel="relationship_stage"
        data-visible={visible.has('relationship_stage') ? 1 : 0}
        data-testid="dashboard-panel-relationship_stage"
      >
        <div className="card">
          <div className="card-h">
            <div className="t">Relationship stage</div>
            <span className="tag">{DASHBOARD.client.retainer}</span>
          </div>
          <div className="card-b">
            <RelationshipStage
              stages={DASHBOARD.stages}
              current={DASHBOARD.client.relationshipStage}
            />
          </div>
        </div>
      </section>

      <div className="dashboard-grid-2">
        <section
          className="dashboard-panel"
          data-panel="interaction_timeline"
          data-visible={visible.has('interaction_timeline') ? 1 : 0}
          data-testid="dashboard-panel-interaction_timeline"
        >
          <div className="card">
            <div className="card-h">
              <div className="t">Interaction timeline</div>
              <span className="tag">{DASHBOARD.timeline.length} events</span>
            </div>
            <div className="card-b dashboard-timeline-body">
              <InteractionTimeline
                items={DASHBOARD.timeline}
                onItemClick={onTimelineClick}
              />
            </div>
          </div>
        </section>

        <section
          className="dashboard-panel"
          data-panel="ai_alerts"
          data-visible={visible.has('ai_alerts') ? 1 : 0}
          data-testid="dashboard-panel-ai_alerts"
        >
          <AlertsCard alerts={DASHBOARD.alerts} />
        </section>
      </div>

      <section
        className="dashboard-panel"
        data-panel="external_signals"
        data-visible={visible.has('external_signals') ? 1 : 0}
        data-testid="dashboard-panel-external_signals"
      >
        <ExternalSignals signals={DASHBOARD.externalSignals} />
      </section>

      <ThesisMemoryToggle />
    </section>
  );
}
