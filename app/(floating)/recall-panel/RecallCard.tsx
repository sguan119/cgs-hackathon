'use client';

import { type ReactNode, useMemo } from 'react';
import { FellowVoiceColumn } from './FellowVoiceColumn';
import type { RecallCardFields, RecallTurnStatus } from './session-types';

// Phase 2A interim: duplicated CGS-term list. Phase 2C will centralize in
// lib/methodology/tags.ts — remove this constant then.
const CGS_TERMS: ReadonlyArray<string> = [
  'Structural Inertia',
  'Dominant Logic',
  'First Mile',
  'Strategy Wheel',
  'Purpose',
  'Market',
  'Offering',
  'Economic engine',
  'Organization',
  'Execution rhythm',
];

function highlightCgsTerms(text: string): ReactNode {
  if (!text) return text;
  const tokens: ReactNode[] = [];
  let cursor = 0;
  const lower = text.toLowerCase();
  const positions: Array<{ at: number; len: number; term: string }> = [];
  for (const term of CGS_TERMS) {
    const needle = term.toLowerCase();
    let from = 0;
    while (true) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      positions.push({ at: idx, len: term.length, term });
      from = idx + term.length;
    }
  }
  positions.sort((a, b) => a.at - b.at);
  for (const pos of positions) {
    if (pos.at < cursor) continue; // overlap; skip
    if (pos.at > cursor) tokens.push(text.slice(cursor, pos.at));
    tokens.push(
      <span key={`${pos.at}-${pos.term}`} className="cgs-term">
        {text.slice(pos.at, pos.at + pos.len)}
      </span>
    );
    cursor = pos.at + pos.len;
  }
  if (cursor < text.length) tokens.push(text.slice(cursor));
  return tokens;
}

type Props = {
  card: RecallCardFields;
  status: RecallTurnStatus;
  query: string;
  path?: 'live' | 'offline' | 'no-anchor' | null;
};

export function RecallCard({ card, status, query, path }: Props) {
  const committed = useMemo(
    () => ({
      year: card.year,
      client: card.client,
      scene: card.scene,
    }),
    [card.year, card.client, card.scene]
  );
  const yearDisplay = committed.year ?? card.partial.year ?? '—';
  const clientDisplay = committed.client ?? card.partial.client ?? '—';
  const sceneDisplay = committed.scene ?? card.partial.scene ?? '';
  const hasFellow = Boolean(card.fellow_voice || card.partial.fellow_voice);

  return (
    <article
      className="recall-card"
      data-status={status}
      data-has-fellow={hasFellow ? '' : undefined}
    >
      <div className="recall-card-q">{query}</div>
      <div className="recall-card-body">
        <div className="recall-card-main">
          <div className="recall-card-head">
            <span className="recall-card-year fade-in">{yearDisplay}</span>
            <span className="recall-card-client fade-in">{clientDisplay}</span>
            {path === 'offline' ? <span className="recall-card-pill">offline</span> : null}
          </div>
          {sceneDisplay ? (
            <div className="recall-card-scene fade-in">{highlightCgsTerms(sceneDisplay)}</div>
          ) : null}
          {card.tags.length > 0 ? (
            <div className="recall-card-tags">
              {card.tags.map((t, i) => (
                <span key={`${i}-${t}`} className="tag sage fade-in">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {card.quotes.length > 0 ? (
            <ul className="recall-card-quotes">
              {card.quotes.map((q, i) => (
                <li key={i} className="fade-in">
                  {highlightCgsTerms(q)}
                </li>
              ))}
            </ul>
          ) : null}
          {card.source_id ? (
            <div className="recall-card-source fade-in">
              <a href={`#${card.source_id}`}>{card.source_id}</a>
            </div>
          ) : null}
        </div>
        {card.fellow_voice || card.partial.fellow_voice ? (
          <FellowVoiceColumn
            text={card.fellow_voice ?? card.partial.fellow_voice ?? ''}
            partial={!card.fellow_voice}
          />
        ) : null}
      </div>
    </article>
  );
}
