'use client';

const SLIDE = {
  title: 'Acme Industrial · Bi-weekly · Week 3',
  bullets: [
    'Transformation cadence check — Q3 earnings language shifted cost-first',
    'Innovation reporting line — open since M1',
    'Ring-fenced innovation budget precedent (Umbrella 2022 / Cyberdyne 2023)',
    'Fellow questions staged before Jul planning cycle',
  ],
  footer: 'CGS Advisors · Confidential',
} as const;

export function SharedDeckPane() {
  return (
    <article
      className="meeting-deck"
      aria-label="Shared deck slide"
      data-testid="shared-deck-pane"
    >
      <div className="meeting-deck-title">{SLIDE.title}</div>
      <ul className="meeting-deck-bullets">
        {SLIDE.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="meeting-deck-footer">{SLIDE.footer}</div>
    </article>
  );
}
