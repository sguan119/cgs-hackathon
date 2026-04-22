// Follow-up context assembler. Keeps the last 3 completed QA pairs
// verbatim and collapses older turns into a single summary line so the
// Seg 4 payload stays small. Seg 1–3 are untouched (cache hits preserved).

export type FollowupTurn = {
  query: string;
  card: {
    year: string | null;
    client: string | null;
    scene: string | null;
    quotes: string[];
    tags: string[];
  };
  precedentId: string | null;
};

const VERBATIM_WINDOW = 3;

function summarizeCard(card: FollowupTurn['card']): string {
  const bits: string[] = [];
  if (card.year) bits.push(`year=${card.year}`);
  if (card.client) bits.push(`client=${card.client}`);
  if (card.scene) bits.push(`scene=${card.scene}`);
  if (card.quotes.length > 0) bits.push(`quote="${card.quotes[0]}"`);
  return bits.join(', ');
}

export function buildFollowupContext(priorTurns: FollowupTurn[]): string {
  if (priorTurns.length === 0) return '';
  const recent = priorTurns.slice(-VERBATIM_WINDOW);
  const older = priorTurns.slice(0, -VERBATIM_WINDOW);

  const lines: string[] = [
    'Follow-up — same precedent if still relevant; say so if it is a different case.',
  ];

  if (older.length > 0) {
    const ids = Array.from(
      new Set(older.map((t) => t.precedentId).filter((x): x is string => !!x))
    );
    const themes = Array.from(
      new Set(older.map((t) => t.card.tags[0]).filter((x): x is string => !!x))
    );
    lines.push(
      `Earlier turns (${older.length}): precedent(s) ${ids.join(', ') || '—'} — themes: ${
        themes.join(', ') || '—'
      }`
    );
  }

  for (const t of recent) {
    lines.push(`Q: ${t.query}`);
    lines.push(`A: ${summarizeCard(t.card)}`);
  }

  return lines.join('\n');
}
