'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Static export forbids the server-side `redirect()` helper — we route on
// the client. The pre-flight gate is session-only (no persistence); from
// root we land on /preflight, which forwards to /dashboard once keys are
// green.

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/preflight/');
  }, [router]);
  return null;
}
