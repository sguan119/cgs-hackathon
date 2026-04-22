'use client';

import { STRATEGY_WHEEL_DIMS } from '@/lib/override/dims';

// Static evidence-health bars per dim. Counts are placeholder numbers —
// Phase 3.2 content owner replaces with the Acme evidence tallies.

const PLACEHOLDER_COUNTS: Record<string, number> = {
  strategic_innovation: 2,
  transformation_concept: 3,
  internal_sensing: 2,
  external_sensing: 5,
  strategy_formulation: 5,
  strategic_transformation: 5,
  strategy_governance: 5,
};

export function EvidenceHealthRail() {
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Evidence health</div>
      </div>
      <div className="card-b" style={{ padding: 0 }}>
        {STRATEGY_WHEEL_DIMS.map((d) => {
          const n = PLACEHOLDER_COUNTS[d.id] ?? 3;
          const weak = n < 3;
          return (
            <div key={d.id} className="evidence-row">
              <div className="evidence-label">{d.short}</div>
              <div className="evidence-bars">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className={`evidence-bar ${
                      i <= n ? (weak ? 'weak' : 'filled') : 'empty'
                    }`}
                  />
                ))}
              </div>
              <div className={`evidence-count${weak ? ' weak' : ''}`}>
                {weak ? `weak · ${n}` : `${n} pts`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
