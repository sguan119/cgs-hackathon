'use client';

import e1Fixture from '@/fixtures/continuity_fixtures/e1.json';

type E1Baseline = {
  closeDate: string;
  wheelSnapshot: string;
  topInertia: string;
  stakeholders: string[];
  summary: string;
};

const BASELINE = e1Fixture as E1Baseline;

export function E1BaselineCard() {
  return (
    <div className="card continuity-e1" data-testid="continuity-e1">
      <div className="card-h">
        <div className="t">E1 · Close-out baseline</div>
        <span className="tag">{BASELINE.closeDate}</span>
      </div>
      <div className="card-b continuity-e1-body">
        <div className="continuity-e1-row">
          <span className="continuity-e1-kicker">Wheel snapshot</span>
          <span className="continuity-e1-value">{BASELINE.wheelSnapshot}</span>
        </div>
        <div className="continuity-e1-row">
          <span className="continuity-e1-kicker">Top inertia</span>
          <span className="continuity-e1-value">{BASELINE.topInertia}</span>
        </div>
        <div className="continuity-e1-row">
          <span className="continuity-e1-kicker">Stakeholders</span>
          <span className="continuity-e1-value">
            {BASELINE.stakeholders.join(' · ')}
          </span>
        </div>
        <p className="continuity-e1-summary">{BASELINE.summary}</p>
      </div>
    </div>
  );
}
