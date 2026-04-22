'use client';

import { useEffect, useState } from 'react';
import borderlineFixture from '@/fixtures/continuity_fixtures/borderline.json';
import highRiskFixture from '@/fixtures/continuity_fixtures/high-risk.json';
import passFixture from '@/fixtures/continuity_fixtures/pass.json';
import { ErrorBoundary } from '@/lib/components/ErrorBoundary';
import { E1BaselineCard } from './E1BaselineCard';
import { E4ReplyExtractor } from './E4ReplyExtractor';
import { E5EscalationCard } from './E5EscalationCard';
import { EmailCard } from './EmailCard';
import { ToneGuardPaste } from './ToneGuardPaste';

type FixtureShape = {
  id: 'pass' | 'borderline' | 'high-risk';
  to: string;
  subject: string;
  body: string;
};

const FIXTURES: FixtureShape[] = [
  passFixture as FixtureShape,
  borderlineFixture as FixtureShape,
  highRiskFixture as FixtureShape,
];

// N4 (Reviewer #3): compute the header date on mount (matches the Phase 1
// Titlebar pattern) so the static-export build doesn't bake a stale
// "Apr 21" into the artifact. Falls back to empty string during SSR/
// first paint so hydration matches.
function formatToday(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ContinuityPage() {
  const [dateLabel, setDateLabel] = useState('');
  useEffect(() => {
    setDateLabel(formatToday());
  }, []);
  return (
    <ErrorBoundary>
      <section className="page continuity-page">
        <div className="page-header">
          <div>
            <div className="crumb">§6 · Active engagement · Acme Industrial</div>
            <h1>
              Continuity Agent <em>— Tone Guard validator</em>
            </h1>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="tag sage">E3 · Tone Guard · real</span>
              <span className="tag">E1 · E4 · E5 · fixture-driven</span>
            </div>
          </div>
          <div className="meta">D. Park{dateLabel ? ` · ${dateLabel}` : ''}</div>
        </div>

        <div className="tg-section">
          <div className="crumb tg-section-kicker">E2 · Pre-generated email exemplars</div>
          <hr className="rule thick" />
          <div className="tg-email-grid">
            {FIXTURES.map((f) => (
              <EmailCard
                key={f.id}
                id={f.id}
                to={f.to}
                subject={f.subject}
                body={f.body}
              />
            ))}
          </div>
        </div>

        <div className="tg-section">
          <div className="crumb tg-section-kicker">E3 · VP paste surface</div>
          <hr className="rule thick" />
          <ToneGuardPaste />
        </div>

        <div className="tg-section">
          <div className="crumb tg-section-kicker">E1 · Close-out baseline</div>
          <hr className="rule thick" />
          <E1BaselineCard />
        </div>

        <div className="tg-section">
          <div className="crumb tg-section-kicker">E4 · Client reply signals</div>
          <hr className="rule thick" />
          <E4ReplyExtractor />
        </div>

        <div className="tg-section">
          <div className="crumb tg-section-kicker">E5 · Internal escalation</div>
          <hr className="rule thick" />
          <E5EscalationCard />
        </div>
      </section>
    </ErrorBoundary>
  );
}
