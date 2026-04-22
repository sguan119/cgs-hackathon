'use client';

import type { DataHubCrmRow } from './types';

export function ClientSwitcher({
  clients,
  activeName,
}: {
  clients: readonly DataHubCrmRow[];
  activeName: string;
}) {
  return (
    <div className="dashboard-client-switcher">
      <span className="dashboard-client-switcher-kicker">
        Clients · {clients.length}
      </span>
      {clients.map((c) => {
        const active = c.name === activeName;
        return (
          <span
            key={c.id}
            className={`dashboard-client-chip${active ? ' is-active' : ''}`}
            data-client-id={c.id}
            data-active={active ? 1 : 0}
          >
            {active ? <span className="dashboard-client-chip-dot" /> : null}
            {c.name}
            <span className="dashboard-client-chip-stage">· {c.stage}</span>
          </span>
        );
      })}
      <span className="dashboard-client-switcher-add">+ add · Q</span>
    </div>
  );
}
