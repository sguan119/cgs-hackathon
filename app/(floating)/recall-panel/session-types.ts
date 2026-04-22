// React-local types for the Recall panel session. Not persisted — the
// cross-window projection of this (`recall_history` in the store) is
// append-only and holds only {query, precedent_id, ts}.

export type RecallTurnStatus =
  | 'pending'
  | 'retrieving'
  | 'streaming'
  | 'retrying'
  | 'offline'
  | 'no_anchor'
  | 'complete'
  | 'failed';

export type RecallCardFields = {
  year: string | null;
  client: string | null;
  scene: string | null;
  tags: string[];
  quotes: string[];
  source_id: string | null;
  fellow_voice: string | null;
  no_anchor: boolean;
  partial: Partial<Record<'year' | 'client' | 'scene' | 'fellow_voice', string>>;
};

export type RecallTurn = {
  id: string;
  query: string;
  status: RecallTurnStatus;
  latencyMs: number | null;
  source: 'scripted' | 'free-text' | 'follow-up';
  path: 'live' | 'offline' | 'no-anchor' | null;
  card: RecallCardFields;
  precedentId: string | null;
  error?: string;
};

export function emptyCard(): RecallCardFields {
  return {
    year: null,
    client: null,
    scene: null,
    tags: [],
    quotes: [],
    source_id: null,
    fellow_voice: null,
    no_anchor: false,
    partial: {},
  };
}
