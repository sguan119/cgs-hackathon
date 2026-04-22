import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ErrorBoundary } from '@/lib/components/ErrorBoundary';
import { BootEffects } from './boot-effects';

export const metadata: Metadata = {
  title: 'CGS Advisors',
  description: 'CGS Advisors agentic AI — demo shell',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ErrorBoundary>
          <BootEffects />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
