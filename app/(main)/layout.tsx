'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/lib/components/Sidebar';
import { Titlebar } from '@/lib/components/Titlebar';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="window"
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--ivory)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Titlebar />
      <div className="app">
        <Sidebar />
        <div className="main">{children}</div>
      </div>
    </div>
  );
}
