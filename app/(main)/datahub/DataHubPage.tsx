'use client';

import datahubFixture from '@/fixtures/datahub_fixtures/datahub.json';
import type { DataHubFixture } from '@/app/(main)/dashboard/types';
import { ClientTagTable } from './ClientTagTable';
import { DistributeStrip } from './DistributeStrip';
import { UploadsCard } from './UploadsCard';

const DATAHUB = datahubFixture as DataHubFixture;

export function DataHubPage() {
  return (
    <section className="page datahub-page">
      <div className="page-header">
        <div>
          <div className="crumb">§7 · Data Hub</div>
          <h1>
            Data Hub <em>— tag &amp; classify</em>
          </h1>
          <div className="datahub-header-tags">
            <span className="tag sage">● connected · Collective Brain</span>
          </div>
        </div>
        <div className="datahub-header-actions">
          <div className="actions">
            <button type="button" className="btn primary">
              Save
            </button>
          </div>
        </div>
      </div>

      <UploadsCard uploads={DATAHUB.uploads} />
      <ClientTagTable
        rows={DATAHUB.crmRows}
        expandedName="Acme Industrial"
        expandedFolder={DATAHUB.acmeFolder}
        sourceLabel={DATAHUB.uploads[0]?.name}
      />
      <DistributeStrip />
    </section>
  );
}
