'use client';

import { useEffect } from 'react';

export function RecallPanelBodyClass() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('recall-panel');
    return () => {
      document.body.classList.remove('recall-panel');
    };
  }, []);
  return null;
}
