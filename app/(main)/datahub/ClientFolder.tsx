'use client';

import type { DataHubFolderFile } from '@/app/(main)/dashboard/types';

export function ClientFolder({
  clientName,
  files,
}: {
  clientName: string;
  files: readonly DataHubFolderFile[];
}) {
  return (
    <div className="datahub-folder" data-testid={`datahub-folder-${clientName}`}>
      <div className="datahub-folder-kicker">{clientName} · folder</div>
      {files.map((f, i) => (
        <div
          key={`${clientName}-${i}-${f.name}`}
          className="datahub-folder-file"
        >
          <span className="datahub-folder-icon" aria-hidden="true">
            {f.icon}
          </span>
          <span className="datahub-folder-name">{f.name}</span>
          <span className="datahub-folder-meta">{f.meta}</span>
        </div>
      ))}
    </div>
  );
}
