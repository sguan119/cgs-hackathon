'use client';

import type {
  DataHubCrmRow,
  DataHubFolderFile,
} from '@/app/(main)/dashboard/types';
import { ClientFolder } from './ClientFolder';

const STAGE_CLASS: Record<DataHubCrmRow['stage'], string> = {
  Signal: 'datahub-stage-signal',
  Retainer: 'datahub-stage-retainer',
  'Pre-RFP': 'datahub-stage-prerfp',
  Renewal: 'datahub-stage-renewal',
  'Active Delivery': 'datahub-stage-active',
};

export function ClientTagTable({
  rows,
  expandedName,
  expandedFolder,
  sourceLabel,
}: {
  rows: readonly DataHubCrmRow[];
  expandedName: string;
  expandedFolder: readonly DataHubFolderFile[];
  sourceLabel?: string;
}) {
  const tagLabel = sourceLabel
    ? `${sourceLabel} · ${rows.length} rows`
    : `${rows.length} rows`;
  return (
    <div className="card datahub-crm">
      <div className="card-h">
        <div className="t">
          Clients · tagged <em>— industry / size / region</em>
        </div>
        <span className="tag">{tagLabel}</span>
      </div>
      <div className="card-b datahub-crm-body">
        <div className="datahub-crm-head" role="row">
          <span>Client</span>
          <span>Industry</span>
          <span>Size</span>
          <span>Region</span>
          <span>Service line</span>
          <span>Stage</span>
          <span />
        </div>
        {rows.map((r) => {
          const expanded = r.name === expandedName;
          return (
            <div
              key={r.id}
              className={`datahub-crm-row-group${expanded ? ' is-expanded' : ''}`}
            >
              <div
                className="datahub-crm-row"
                data-testid={`datahub-crm-${r.id}`}
              >
                <span className="datahub-crm-name">
                  {r.flag === 'new' ? (
                    <span className="datahub-crm-flag" aria-label="new" />
                  ) : null}
                  {r.name}
                </span>
                <span>
                  <span className="tag">{r.industry}</span>
                </span>
                <span className="datahub-crm-mono">{r.size}</span>
                <span className="datahub-crm-mono">{r.region}</span>
                <span>
                  <span className="tag navy">{r.serviceLine}</span>
                </span>
                <span className={`datahub-crm-stage ${STAGE_CLASS[r.stage]}`}>
                  {r.stage}
                </span>
                <span className="datahub-crm-expand">
                  {expanded ? 'less ▾' : 'more ▸'}
                </span>
              </div>
              {expanded ? (
                <ClientFolder clientName={r.name} files={expandedFolder} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
