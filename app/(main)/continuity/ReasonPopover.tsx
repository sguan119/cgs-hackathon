'use client';

import { useEffect, useId, useRef } from 'react';
import type { Reason } from '@/lib/toneguard/types';

export type PopoverCloseReason = 'esc' | 'button' | 'outside';

type Props = {
  reasons: Reason[];
  layout: 'popover' | 'inline';
  onClose?: (_reason: PopoverCloseReason) => void;
};

function sortReasons(reasons: Reason[]): Reason[] {
  return [...reasons].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'high' ? -1 : 1;
  });
}

export function ReasonPopover({ reasons, layout, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Reviewer-3 B1: useId() gives a stable, collision-free id for
  // aria-labelledby across concurrent ReasonPopover mounts.
  const titleId = useId();

  useEffect(() => {
    if (layout !== 'popover' || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose('esc');
    };
    // Reviewer-2 B1: use `click` (not `mousedown`) so the badge's own
    // click handler — which toggles open state — fires BEFORE the
    // window-level dismiss; the popover root stops its own click from
    // bubbling so interior clicks never reach window.
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose('outside');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [layout, onClose]);

  const sorted = sortReasons(reasons);

  return (
    <div
      ref={ref}
      className={`tg-reasons tg-reasons--${layout}`}
      role="dialog"
      aria-modal={layout === 'popover' ? 'true' : undefined}
      aria-labelledby={titleId}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tg-reasons-h">
        <span id={titleId}>Tone Guard findings</span>
        {layout === 'popover' && onClose ? (
          <button
            type="button"
            className="dismiss"
            onClick={() => onClose('button')}
            aria-label="Close"
          >
            ×
          </button>
        ) : null}
      </div>
      {sorted.length === 0 ? (
        <div className="tg-reasons-empty">No findings — email reads clean.</div>
      ) : (
        <ul className="tg-reasons-list">
          {sorted.map((r, i) => (
            <li
              key={`${r.rule}-${r.spanStart ?? 'ns'}-${i}`}
              className={`tg-reason tg-reason--${r.severity}`}
            >
              <span className={`tg-reason-badge tg-reason-badge--${r.severity}`}>
                {r.severity === 'high' ? 'High' : 'Soft'}
              </span>
              <span className="tg-reason-rule">{r.rule}</span>
              <span className="tg-reason-msg">{r.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
