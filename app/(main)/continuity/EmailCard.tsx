'use client';

import { useMemo, useRef, useState } from 'react';
import { TrafficLight } from '@/lib/components/TrafficLight';
import { buildHighlightRegions } from '@/lib/toneguard/highlight';
import type { Verdict } from '@/lib/toneguard/types';
import { validate } from '@/lib/toneguard/validate';
import { HighlightedBody } from './HighlightedBody';
import { ReasonPopover, type PopoverCloseReason } from './ReasonPopover';

type Props = {
  id: 'pass' | 'borderline' | 'high-risk';
  to: string;
  subject: string;
  body: string;
};

const VERDICT_COLOR: Record<Verdict, 'red' | 'yellow' | 'green'> = {
  'pass': 'green',
  'borderline': 'yellow',
  'high-risk': 'red',
};

const VERDICT_LABEL: Record<Verdict, string> = {
  'pass': 'Pass',
  'borderline': 'Borderline',
  'high-risk': 'High risk',
};

export function EmailCard({ id, to, subject, body }: Props) {
  const [open, setOpen] = useState(false);
  const badgeRef = useRef<HTMLButtonElement | null>(null);
  const result = useMemo(() => validate(body), [body]);
  const regions = useMemo(
    () => buildHighlightRegions(body, result.reasons),
    [body, result.reasons]
  );

  // Reviewer-3 B2: focus-return is only correct for explicit dismissals
  // (Esc + × button). Forcing focus back to the badge on a click-outside
  // is an a11y anti-pattern — if the user clicked another control, they
  // expect focus to follow that click, not teleport back. Always close;
  // only refocus when the close reason was intentional.
  const handleClose = (reason: PopoverCloseReason) => {
    setOpen(false);
    if (reason !== 'outside') {
      badgeRef.current?.focus();
    }
  };

  return (
    <div className={`tg-email-card tg-email-card--${id}`} data-testid={`email-card-${id}`}>
      <div className="tg-email-h">
        <div className="tg-email-meta">
          <div className="crumb">{id.toUpperCase()}</div>
          <div className="tg-email-subject">{subject}</div>
          <div className="tg-email-to">To: {to}</div>
        </div>
        <div className="tg-email-verdict">
          <button
            ref={badgeRef}
            type="button"
            className="tg-verdict-btn"
            // Reviewer-2 B1: stop propagation so the badge's own click
            // is not re-consumed by the popover's window-level
            // click-outside dismiss handler.
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            aria-label={`Tone Guard verdict: ${VERDICT_LABEL[result.verdict]}. Click to ${open ? 'close' : 'show'} findings.`}
          >
            <TrafficLight
              color={VERDICT_COLOR[result.verdict]}
              label={VERDICT_LABEL[result.verdict]}
              size="sm"
            />
          </button>
          {open ? (
            <ReasonPopover reasons={result.reasons} layout="popover" onClose={handleClose} />
          ) : null}
        </div>
      </div>
      <HighlightedBody body={body} regions={regions} />
    </div>
  );
}
