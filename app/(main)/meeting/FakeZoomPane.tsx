'use client';

import { useEffect, useState } from 'react';

const VIDEO_SRC = '/assets/fake_zoom.mp4';
const POSTER_SRC = '/assets/zoom-poster.svg';

export function FakeZoomPane() {
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (typeof fetch === 'undefined') {
      setFallback(true);
      return;
    }
    let cancelled = false;
    fetch(VIDEO_SRC, { method: 'HEAD' })
      .then((r) => {
        if (!cancelled && !r.ok) setFallback(true);
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (fallback) {
    return (
      <div
        className="meeting-zoom-fallback"
        role="img"
        aria-label="Zoom recording placeholder"
        data-testid="fake-zoom-fallback"
      >
        <span className="live-dot" aria-hidden="true" />
        <span>LIVE · Zoom · Recording</span>
      </div>
    );
  }

  return (
    <video
      className="meeting-zoom-video"
      data-testid="fake-zoom-video"
      src={VIDEO_SRC}
      poster={POSTER_SRC}
      autoPlay
      muted
      loop
      playsInline
      onError={() => setFallback(true)}
      onCanPlay={() => setFallback(false)}
    />
  );
}
