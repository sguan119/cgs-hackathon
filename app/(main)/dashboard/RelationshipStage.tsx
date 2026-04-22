'use client';

import type { RelationshipStage as Stage } from './types';

export function RelationshipStage({
  stages,
  current,
}: {
  stages: readonly Stage[];
  current: Stage;
}) {
  const idx = stages.indexOf(current);
  return (
    <div className="dashboard-stage-track" role="list" aria-label="Relationship stage">
      {stages.map((s, i) => {
        const active = i === idx;
        const past = i < idx;
        return (
          <span key={s} className="dashboard-stage-step" role="listitem">
            <span
              className={`dashboard-stage-dot${
                active ? ' is-active' : past ? ' is-past' : ''
              }`}
            />
            <span
              className={`dashboard-stage-label${
                active ? ' is-active' : past ? ' is-past' : ''
              }`}
            >
              {s}
            </span>
            {i < stages.length - 1 ? (
              <span
                className={`dashboard-stage-rule${past ? ' is-past' : ''}`}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
