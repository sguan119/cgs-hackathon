// Compact JSON diff summary for --dry-run output — plan §5.5.
// Reports top-level-key type/length deltas; no deep diff.

function describeValue(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (Array.isArray(v)) return `array(${v.length})`;
  const t = typeof v;
  if (t === 'string') return `string(${(v as string).length})`;
  if (t === 'object') return `object(${Object.keys(v as object).length})`;
  return t;
}

export function summarizeDiff(before: unknown, after: unknown): string {
  const lines: string[] = [];
  const b = before as Record<string, unknown> | undefined;
  const a = after as Record<string, unknown> | undefined;
  if (!a) return '  (no after state)';
  const keys = new Set<string>();
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    Object.keys(b).forEach((k) => keys.add(k));
  }
  if (typeof a === 'object' && !Array.isArray(a)) {
    Object.keys(a).forEach((k) => keys.add(k));
  }
  if (keys.size === 0) {
    lines.push(`  ${describeValue(before)} -> ${describeValue(after)}`);
    return lines.join('\n');
  }
  for (const k of Array.from(keys).sort()) {
    const bv = b?.[k];
    const av = a?.[k];
    const bDesc = describeValue(bv);
    const aDesc = describeValue(av);
    if (bDesc !== aDesc) lines.push(`  ${k}: ${bDesc} -> ${aDesc}`);
  }
  if (lines.length === 0) lines.push('  (no top-level changes)');
  return lines.join('\n');
}

export function embeddingDelta(oldEmb: number[], newEmb: number[]): string {
  const oldN = oldEmb.length;
  const newN = newEmb.length;
  const sign = newN >= oldN ? '+' : '';
  return `embedding: old=${oldN}-d new=${newN}-d Δ=${sign}${newN - oldN}`;
}
