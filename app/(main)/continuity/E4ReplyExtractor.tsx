'use client';

import e4Fixture from '@/fixtures/continuity_fixtures/e4.json';

type E4Reply = {
  id: string;
  from: string;
  subject: string;
  body: string;
  extracted: {
    strategy_wheel_shifts: { dim: string; direction: 'up' | 'down' | 'flat' }[];
    inertia_shift: 'dominant_logic' | 'structural' | 'none';
    external_coupling: string | null;
  };
  friction_type: 'dominant_logic' | 'structural' | 'external_coupling' | null;
};

const REPLIES = e4Fixture as E4Reply[];

const DIRECTION_GLYPH: Record<E4Reply['extracted']['strategy_wheel_shifts'][number]['direction'], string> = {
  up: '▲',
  down: '▼',
  flat: '—',
};

export function E4ReplyExtractor() {
  return (
    <div className="continuity-e4-grid" data-testid="continuity-e4">
      {REPLIES.map((r) => (
        <div
          key={r.id}
          className="card continuity-e4-card"
          data-testid={`continuity-e4-${r.id}`}
        >
          <div className="card-h">
            <div className="t">{r.subject}</div>
            <span className="tag">{r.from}</span>
          </div>
          <div className="card-b continuity-e4-body">
            <pre className="continuity-e4-quote">{r.body}</pre>
            <div className="continuity-e4-extract">
              <div className="continuity-e4-kicker">Wheel shifts</div>
              <ul className="continuity-e4-shifts">
                {r.extracted.strategy_wheel_shifts.map((s) => (
                  <li key={s.dim}>
                    <span className={`continuity-e4-arrow dir-${s.direction}`}>
                      {DIRECTION_GLYPH[s.direction]}
                    </span>
                    {s.dim}
                  </li>
                ))}
              </ul>
              <div className="continuity-e4-kicker">Inertia</div>
              <div className="continuity-e4-inertia">{r.extracted.inertia_shift}</div>
              {r.extracted.external_coupling ? (
                <>
                  <div className="continuity-e4-kicker">External coupling</div>
                  <div className="continuity-e4-coupling">
                    {r.extracted.external_coupling}
                  </div>
                </>
              ) : null}
              {r.friction_type ? (
                <div className="continuity-e4-friction">
                  <span className="tag crimson">
                    Friction · {r.friction_type.replace('_', ' ')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
