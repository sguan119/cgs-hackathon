'use client';

import type { InertiaHypothesis } from '@/lib/override/dims';

export type HypothesisCardProps = {
  // `incoming` treats the card as a streaming target — partials fade in.
  // `baseline` renders the committed pre-override state.
  // `superseded` wraps the baseline in 50% opacity + strike-through.
  mode: 'baseline' | 'incoming' | 'superseded';
  hypothesis: Partial<InertiaHypothesis>;
};

function kindLabel(kind: InertiaHypothesis['kind'] | undefined): string {
  if (kind === 'dominant_logic') return 'Dominant Logic Inertia';
  if (kind === 'structural') return 'Structural Inertia';
  return '— kind pending';
}

export function HypothesisCard({ mode, hypothesis }: HypothesisCardProps) {
  const confidencePct =
    typeof hypothesis.confidence === 'number'
      ? Math.round(hypothesis.confidence * 100)
      : null;
  const tone = hypothesis.kind === 'dominant_logic' ? 'crim' : 'navy';

  return (
    <div
      className={`card hypothesis-card hypothesis-card--${mode}`}
      data-hypothesis-id={hypothesis.id ?? 'pending'}
    >
      <div className="card-h" style={{ paddingBottom: 10 }}>
        <div>
          <div className={`dot-tag ${tone}`} style={{ marginBottom: 4 }}>
            <span className="d" />
            <span>{kindLabel(hypothesis.kind)}</span>
          </div>
          <div className="hypothesis-label">
            {hypothesis.label ?? <span className="hypothesis-pending">Label pending…</span>}
          </div>
        </div>
        <div className="hypothesis-confidence">
          <span className="hypothesis-confidence-n">
            {confidencePct ?? '—'}
          </span>
          <span className="hypothesis-confidence-d">/100</span>
        </div>
      </div>
      <div className="card-b">
        {hypothesis.statement ? (
          <p className="hypothesis-statement">{hypothesis.statement}</p>
        ) : null}
        <div className="hypothesis-evidence-head">Evidence</div>
        {(hypothesis.evidence ?? []).map((e, i) => (
          <div key={`${e.source_id}-${i}`} className="hypothesis-evidence-row">
            <div className="hypothesis-evidence-src">{e.source_id || '—'}</div>
            <div className="hypothesis-evidence-q">{e.quote}</div>
          </div>
        ))}
        {(hypothesis.intervention_ids ?? []).length > 0 ? (
          <>
            <hr className="rule" />
            <div className="hypothesis-evidence-head">Candidate interventions</div>
            <ul className="hypothesis-interventions">
              {hypothesis.intervention_ids!.map((iid) => (
                <li key={iid}>{iid}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
