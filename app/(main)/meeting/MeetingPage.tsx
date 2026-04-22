'use client';

import { useEffect } from 'react';
import { EVENTS, emit } from '@/lib/events';
import { set } from '@/lib/store';
import { FakeZoomPane } from './FakeZoomPane';
import { SharedDeckPane } from './SharedDeckPane';

export function MeetingPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const start = async () => {
      if (cancelled) return;
      try {
        await set('current_client', 'acme');
        await set('meeting_state', 'in_meeting');
        await emit(EVENTS.MEETING_START, { client_id: 'acme' });
      } catch {
        // Non-Tauri dev / jsdom: store + events live only inside the
        // webview runtime. The stub pattern swallows the error so /meeting
        // still renders in browser previews.
      }
    };
    void start();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          await set('meeting_state', 'post_meeting');
          await emit(EVENTS.MEETING_END, {});
        } catch {
          /* non-Tauri dev */
        }
      })();
    };
  }, []);

  return (
    <section className="page meeting-page meeting-split">
      <div className="meeting-split-pane meeting-split-left">
        <FakeZoomPane />
      </div>
      <div className="meeting-split-pane meeting-split-right">
        <SharedDeckPane />
      </div>
    </section>
  );
}
