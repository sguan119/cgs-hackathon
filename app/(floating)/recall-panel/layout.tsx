import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/lib/components/ErrorBoundary';
import { RecallPanelBodyClass } from './body-class';

// Chrome-less wrapper for the floating recall window. No sidebar/titlebar;
// a CSS class on <body> opts out of the AppShell frame and applies the
// solid semi-opaque paper fallback documented in architecture R9 (Windows
// WebView2 does not render native vibrancy).
//
// No `'use client'` directive here: this layout renders only
// <RecallPanelBodyClass> (itself a client component) and uses no hooks,
// so leaving it as a server component is correct.

export default function RecallPanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RecallPanelBodyClass />
      <ErrorBoundary>
        <div className="recall-panel-root">{children}</div>
      </ErrorBoundary>
    </>
  );
}
