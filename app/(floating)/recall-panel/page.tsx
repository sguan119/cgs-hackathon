'use client';

import { RecallPanel } from './RecallPanel';

// Phase 2A note: cross-window events and cmd-K focus routing are handled
// by hooks inside RecallPanel (useRecallLifecycle). This page is a thin
// shell so the static-export routing keeps the /recall-panel/ slug.

export default function RecallPanelPage() {
  return <RecallPanel />;
}
