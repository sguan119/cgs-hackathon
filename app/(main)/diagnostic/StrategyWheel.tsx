'use client';

import type { StrategyDimensionId, WheelScores } from '@/lib/override/dims';
import { STRATEGY_WHEEL_DIMS } from '@/lib/override/dims';
import { WheelSector } from './WheelSector';

// Variant A (radial-pie) port of `cgs-ui-design/project/components/
// StrategyWheel.jsx`. Ports `describeWedge` verbatim as a pure function.
// Variant B (concentric-ring) is not carried forward — plan §6.1.
//
// Prototype used a 0–5 scale; Phase 2B uses 1–7. The fill-radius
// interpolation therefore divides by 7 and the color palette maps
// through `scoreToColor` below (kept inline so a reviewer sees every
// threshold next to the svg call site).

const SIZE = 380;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 170;
const R_INNER = 46;
const GAP_RAD = 0.018;

function describeWedge(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a0: number,
  a1: number
): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const xo0 = cx + Math.cos(a0) * rOuter;
  const yo0 = cy + Math.sin(a0) * rOuter;
  const xo1 = cx + Math.cos(a1) * rOuter;
  const yo1 = cy + Math.sin(a1) * rOuter;
  const xi0 = cx + Math.cos(a0) * rInner;
  const yi0 = cy + Math.sin(a0) * rInner;
  const xi1 = cx + Math.cos(a1) * rInner;
  const yi1 = cy + Math.sin(a1) * rInner;
  return [
    `M ${xo0} ${yo0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${xo1} ${yo1}`,
    `L ${xi1} ${yi1}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${xi0} ${yi0}`,
    'Z',
  ].join(' ');
}

function scoreToColor(score: number | undefined): string {
  if (score == null) return 'var(--rule)';
  // Thresholds chosen to match prototype's 4-band aesthetic across the
  // 1–7 scale. See phase-2b-plan.md §6.1 correctness callout.
  if (score >= 5) return 'oklch(0.62 0.09 150)'; // sage — mature
  if (score >= 4) return 'oklch(0.72 0.09 95)'; // gold — inconsistent
  if (score >= 3) return 'oklch(0.65 0.13 50)'; // amber — emerging
  return 'oklch(0.58 0.15 25)'; // crimson — absent
}

function shortName(s: string): string {
  return s.replace('Strategy ', '').replace('Strategic ', '');
}

export type StrategyWheelProps = {
  scores: WheelScores;
  editingDim: StrategyDimensionId | null;
  onSectorActivate: (_dim: StrategyDimensionId) => void;
  onScoreStep?: (_dim: StrategyDimensionId, _delta: 1 | -1) => void;
};

export function StrategyWheel({
  scores,
  editingDim,
  onSectorActivate,
  onScoreStep,
}: StrategyWheelProps) {
  const N = STRATEGY_WHEEL_DIMS.length;

  const grid = [1, 2, 3, 4, 5, 6, 7].map((g) => {
    const r = R_INNER + (R_OUTER - R_INNER) * (g / 7);
    return (
      <circle
        key={g}
        cx={CX}
        cy={CY}
        r={r}
        fill="none"
        stroke="var(--rule-2)"
        strokeWidth={0.5}
        strokeDasharray="2 3"
      />
    );
  });

  const wedges = STRATEGY_WHEEL_DIMS.map((d, i) => {
    const a0 = (i / N) * Math.PI * 2 - Math.PI / 2 + GAP_RAD;
    const a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2 - GAP_RAD;
    const score = scores[d.id];
    const safeScore = typeof score === 'number' ? score : 0;
    const fillR = R_INNER + (R_OUTER - R_INNER) * (safeScore / 7);
    const outerPath = describeWedge(CX, CY, R_INNER, R_OUTER, a0, a1);
    const fillPath = describeWedge(CX, CY, R_INNER, fillR, a0, a1);

    const mid = (a0 + a1) / 2;
    const labelR = R_OUTER + 22;
    const lx = CX + Math.cos(mid) * labelR;
    const ly = CY + Math.sin(mid) * labelR;
    const abbrX = CX + Math.cos(mid) * (R_OUTER - 16);
    const abbrY = CY + Math.sin(mid) * (R_OUTER - 16);

    return (
      <WheelSector
        key={d.id}
        dim={d}
        score={score}
        editing={editingDim === d.id}
        outerPath={outerPath}
        fillPath={fillPath}
        fillColor={scoreToColor(score)}
        abbrPos={{ x: abbrX, y: abbrY }}
        labelPos={{ x: lx, y: ly }}
        labelText={shortName(d.short)}
        onActivate={() => onSectorActivate(d.id)}
        onStep={(delta) => onScoreStep?.(d.id, delta)}
      />
    );
  });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE + 40}`}
      width="100%"
      className="strategy-wheel"
      style={{ maxWidth: 460, display: 'block', margin: '0 auto' }}
      aria-label="Acme Industrial Strategy Wheel — 7 dimensions, scores 1 to 7"
    >
      {grid}
      {wedges}
      <circle cx={CX} cy={CY} r={R_INNER - 4} fill="var(--navy)" />
      <text
        x={CX}
        y={CY - 4}
        textAnchor="middle"
        fontFamily="var(--serif)"
        fontSize={13}
        fill="var(--paper)"
        fontStyle="italic"
      >
        Acme
      </text>
      <text
        x={CX}
        y={CY + 12}
        textAnchor="middle"
        fontFamily="var(--mono)"
        fontSize={9}
        fill="var(--mist)"
        letterSpacing="0.1em"
      >
        INDUSTRIAL
      </text>
    </svg>
  );
}
