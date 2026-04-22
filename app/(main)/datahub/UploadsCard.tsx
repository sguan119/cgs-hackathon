'use client';

import type { DataHubUpload } from '@/app/(main)/dashboard/types';

const STATUS_CLASS: Record<DataHubUpload['status'], string> = {
  tagged: 'tag sage',
  tagging: 'tag gold',
  untagged: 'tag crimson',
};

const STATUS_LABEL: Record<DataHubUpload['status'], string> = {
  tagged: '● tagged',
  tagging: '◐ tagging',
  untagged: '○ untagged',
};

export function UploadsCard({ uploads }: { uploads: readonly DataHubUpload[] }) {
  return (
    <div className="card datahub-uploads">
      <div className="card-h">
        <div className="t">Recent uploads</div>
        <span className="tag">classify &amp; ingest</span>
      </div>
      <div className="card-b datahub-uploads-body">
        {uploads.map((u) => (
          <div
            key={u.id}
            className="datahub-upload-row"
            data-testid={`datahub-upload-${u.id}`}
          >
            <div className="datahub-upload-name">{u.name}</div>
            <div className="datahub-upload-size">{u.size}</div>
            <div className="datahub-upload-rows">{u.rows} rows</div>
            <div>
              <span className={STATUS_CLASS[u.status]}>
                {STATUS_LABEL[u.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
