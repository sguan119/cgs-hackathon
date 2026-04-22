'use client';

import { useEffect, useRef, useState } from 'react';
import thesisFixture from '@/fixtures/thesis_fixtures/thesis.json';
import type { ThesisFixture, ThesisScreenshotId } from './types';

const FIXTURE = thesisFixture as unknown as ThesisFixture;

const FALLBACK_BY_ID: Record<ThesisScreenshotId, string> = {
  before_m1: '/assets/thesis/placeholder-before-m1.svg',
  before_m2: '/assets/thesis/placeholder-before-m2.svg',
};

function otherId(id: ThesisScreenshotId): ThesisScreenshotId {
  return id === 'before_m1' ? 'before_m2' : 'before_m1';
}

export function ThesisMemoryToggle() {
  const [currentId, setCurrentId] = useState<ThesisScreenshotId>(
    FIXTURE.defaultId
  );
  const current =
    FIXTURE.screenshots.find((s) => s.id === currentId) ??
    FIXTURE.screenshots[0];
  const other =
    FIXTURE.screenshots.find((s) => s.id === otherId(currentId)) ??
    FIXTURE.screenshots[1];
  const buttonRef = useRef<HTMLButtonElement>(null);

  const swap = () => setCurrentId((id) => otherId(id));

  useEffect(() => {
    if (typeof Image === 'undefined') return;
    const pre = new Image();
    pre.src = other.imagePath;
  }, [other.imagePath]);

  return (
    <section className="card thesis-memory" data-testid="thesis-memory">
      <div className="card-h">
        <div className="t">Thesis Memory · Meeting 1 vs Meeting 2</div>
        <button
          ref={buttonRef}
          type="button"
          className="btn thesis-memory-toggle"
          aria-pressed={currentId === 'before_m2'}
          aria-label={`Showing ${current.label}; press to switch to ${other.label}`}
          data-testid="thesis-memory-toggle-button"
          onClick={swap}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              swap();
            }
          }}
        >
          Switch to {other.label}
        </button>
      </div>
      <div className="card-b thesis-memory-body">
        <img
          key={current.id}
          src={current.imagePath}
          alt={current.alt}
          className="thesis-memory-image"
          data-testid="thesis-memory-image"
          data-screenshot-id={current.id}
          onError={(e) => {
            const img = e.currentTarget;
            const fallback = FALLBACK_BY_ID[current.id];
            if (!img.src.endsWith(fallback)) {
              img.src = fallback;
            }
          }}
        />
        {current.caption ? (
          <p className="thesis-memory-caption">{current.caption}</p>
        ) : null}
      </div>
    </section>
  );
}
