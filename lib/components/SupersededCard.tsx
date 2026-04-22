'use client';

import type { ReactNode } from 'react';

// Shared wrapper for any "about to be replaced" card. Applies 50% opacity
// + strike-through via `.superseded-card`. When `fadingOut` is true, the
// `.is-fading-out` class drops opacity to 0 so the 400 ms CSS transition
// runs before the parent unmounts (reviewer-2 B2).

export function SupersededCard({
  children,
  fadingOut = false,
}: {
  children: ReactNode;
  fadingOut?: boolean;
}) {
  return (
    <div
      className={`superseded-card${fadingOut ? ' is-fading-out' : ''}`}
      title="Superseded by Fellow Override"
      aria-label="Superseded by Fellow Override"
      aria-hidden={fadingOut}
      data-fading-out={fadingOut ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}
