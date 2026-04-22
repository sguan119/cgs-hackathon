'use client';

import { useState } from 'react';
import e5Fixture from '@/fixtures/continuity_fixtures/e5.json';

type E5Action = {
  id: string;
  title: string;
  archetype: 'Relational' | 'Content' | 'Passive';
  effort: 'Low' | 'Medium' | 'High' | 'None';
  why: string;
};

type E5Escalation = {
  id: string;
  source_reply_id: string;
  friction_type: 'dominant_logic' | 'structural' | 'external_coupling';
  confidence: number;
  baseline: string;
  observed: string;
  next_actions: E5Action[];
};

const ESCALATIONS = e5Fixture as E5Escalation[];

export function E5EscalationCard() {
  const [selected, setSelected] = useState<Record<string, string | null>>({});

  if (ESCALATIONS.length === 0) {
    return (
      <div
        className="continuity-e5-empty"
        data-testid="continuity-e5-empty"
      >
        No escalations — all replies within baseline.
      </div>
    );
  }

  return (
    <div className="continuity-e5-grid" data-testid="continuity-e5">
      {ESCALATIONS.map((esc) => {
        const selectedId = selected[esc.id] ?? null;
        return (
          <div
            key={esc.id}
            className="card continuity-e5-card"
            data-testid={`continuity-e5-${esc.id}`}
          >
            <div className="card-h">
              <div className="t">
                Escalation · {esc.friction_type.replace('_', ' ')}
              </div>
              <span className="tag crimson">
                {Math.round(esc.confidence * 100)}% confidence
              </span>
            </div>
            <div className="card-b continuity-e5-body">
              <div className="continuity-e5-diff">
                <div className="continuity-e5-diff-col">
                  <div className="continuity-e5-kicker">Baseline</div>
                  <div className="continuity-e5-value">{esc.baseline}</div>
                </div>
                <div className="continuity-e5-diff-col">
                  <div className="continuity-e5-kicker">Observed</div>
                  <div className="continuity-e5-value">{esc.observed}</div>
                </div>
              </div>
              <div className="continuity-e5-kicker">
                Fellow engagement menu
              </div>
              <ul className="continuity-e5-actions">
                {esc.next_actions.map((a) => (
                  <li
                    key={a.id}
                    className={`continuity-e5-action${
                      selectedId === a.id ? ' is-selected' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="continuity-e5-action-btn"
                      onClick={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [esc.id]: prev[esc.id] === a.id ? null : a.id,
                        }))
                      }
                      data-testid={`continuity-e5-action-${a.id}`}
                      aria-pressed={selectedId === a.id}
                    >
                      <span className="continuity-e5-action-title">
                        {a.title}
                      </span>
                      <span className="continuity-e5-action-meta">
                        <span className="tag">{a.archetype}</span>
                        <span className="tag">effort · {a.effort}</span>
                      </span>
                      <span className="continuity-e5-action-why">{a.why}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
