'use client';

// 1TB corpus panorama. Constants match tech-design §2.9 — the prototype's
// numbers drifted; these are the canonical values. Static; no store read.

const STATS = [
  { label: 'files', value: '320K' },
  { label: 'years', value: '15' },
  { label: 'engagements', value: '247' },
  { label: 'frameworks', value: '9' },
] as const;

export function ContextStrip() {
  return (
    <div className="recall-context-strip" aria-label="Corpus panorama">
      {STATS.map((s) => (
        <span key={s.label} className="recall-context-item">
          <span className="recall-context-val">{s.value}</span>
          <span className="recall-context-lab">{s.label}</span>
        </span>
      ))}
    </div>
  );
}
