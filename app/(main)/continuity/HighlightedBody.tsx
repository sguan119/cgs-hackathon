'use client';

import { Fragment } from 'react';
import type { HighlightRegion } from '@/lib/toneguard/highlight';

type Props = {
  body: string;
  regions: HighlightRegion[];
};

export function HighlightedBody({ body, regions }: Props) {
  if (regions.length === 0) {
    return <pre className="tg-body">{body}</pre>;
  }
  const chunks: Array<{ text: string; severity?: 'high' | 'borderline' }> = [];
  let cursor = 0;
  for (const r of regions) {
    if (r.start > cursor) chunks.push({ text: body.slice(cursor, r.start) });
    chunks.push({ text: body.slice(r.start, r.end), severity: r.severity });
    cursor = r.end;
  }
  if (cursor < body.length) chunks.push({ text: body.slice(cursor) });

  // N2: plain-text chunks render as bare strings inside a keyed
  // <Fragment> — no wrapper <span>, no extra DOM node, no React key
  // collision. Highlighted chunks keep the <span> for the underline.
  return (
    <pre className="tg-body">
      {chunks.map((c, i) =>
        c.severity ? (
          <span key={i} className={`tg-hl tg-hl-${c.severity}`}>
            {c.text}
          </span>
        ) : (
          <Fragment key={i}>{c.text}</Fragment>
        )
      )}
    </pre>
  );
}
