'use client';

type Props = {
  query: string;
};

export function NoAnchorCard({ query }: Props) {
  return (
    <article className="recall-card no-anchor">
      <div className="recall-card-q">{query}</div>
      <div className="recall-card-body">
        <p className="recall-no-anchor-body">
          No high-confidence precedent surfaced. Consider a <strong>24h Memo</strong> — the
          Fellow can commission a bespoke read rather than stretching a weak analogue.
        </p>
      </div>
    </article>
  );
}
