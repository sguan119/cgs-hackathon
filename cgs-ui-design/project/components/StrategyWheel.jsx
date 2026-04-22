// Strategy Wheel component — two visual variants (A: radial-pie, B: concentric-ring)

const { useState, useEffect, useMemo } = React;

function StrategyWheel({ variant = 'A', scores, onCellClick, editingDim = null, mutedUntil = 999 }) {
  // mutedUntil: index below which cells are still "unfilled" (for staged fill animation)
  const dims = window.CGS_DIMENSIONS;
  const N = dims.length;

  // color scale by score 0-5
  const scoreColor = (s) => {
    if (s == null) return 'var(--rule)';
    if (s >= 3.5) return 'oklch(0.62 0.09 150)';           // sage
    if (s >= 2.5) return 'oklch(0.72 0.09 95)';            // gold
    if (s >= 1.5) return 'oklch(0.65 0.13 50)';            // amber
    return 'oklch(0.58 0.15 25)';                          // crimson
  };

  if (variant === 'A') {
    // Radial pie wheel — 7 wedges from center, with score-length fill
    const size = 380;
    const cx = size / 2, cy = size / 2;
    const rOuter = 170, rInner = 46;
    const gap = 0.018; // radians between wedges

    const wedges = dims.map((d, i) => {
      const a0 = (i / N) * Math.PI * 2 - Math.PI / 2 + gap;
      const a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2 - gap;
      const s = scores[d.id] ?? 0;
      const fillR = rInner + (rOuter - rInner) * (s / 5);
      const filled = i < mutedUntil || mutedUntil >= N;

      const outerPath = describeWedge(cx, cy, rInner, rOuter, a0, a1);
      const fillPath  = describeWedge(cx, cy, rInner, fillR, a0, a1);

      const mid = (a0 + a1) / 2;
      const labelR = rOuter + 22;
      const lx = cx + Math.cos(mid) * labelR;
      const ly = cy + Math.sin(mid) * labelR;
      const abbrX = cx + Math.cos(mid) * (rOuter - 16);
      const abbrY = cy + Math.sin(mid) * (rOuter - 16);

      return (
        <g key={d.id} onClick={() => onCellClick && onCellClick(d)} style={{cursor: onCellClick ? 'pointer' : 'default'}}>
          <path d={outerPath} fill="var(--bone)" stroke="var(--rule)" strokeWidth="0.5" />
          {filled && <path d={fillPath} fill={scoreColor(s)} opacity={editingDim === d.id ? 0.45 : 0.88} />}
          {editingDim === d.id && (
            <path d={outerPath} fill="none" stroke="var(--crimson)" strokeWidth="2" strokeDasharray="4 3" />
          )}
          <text x={abbrX} y={abbrY} textAnchor="middle" dominantBaseline="central"
                fontFamily="var(--mono)" fontSize="10" fill="var(--paper)" fontWeight="500" letterSpacing="0.05em">
            {d.abbr}
          </text>
          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                fontFamily="var(--sans)" fontSize="11" fill="var(--charcoal)" fontWeight="500">
            {shortName(d.short)}
          </text>
        </g>
      );
    });

    // concentric score grid
    const grid = [1,2,3,4,5].map((g, i) => {
      const r = rInner + (rOuter - rInner) * (g / 5);
      return <circle key={g} cx={cx} cy={cy} r={r} fill="none" stroke="var(--rule-2)" strokeWidth="0.5" strokeDasharray="2 3" />;
    });

    return (
      <svg viewBox={`0 0 ${size} ${size + 40}`} width="100%" style={{maxWidth: 460, display: 'block', margin: '0 auto'}}>
        {grid}
        {wedges}
        <circle cx={cx} cy={cy} r={rInner - 4} fill="var(--navy)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--serif)" fontSize="13" fill="var(--paper)" fontStyle="italic">Acme</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--mist)" letterSpacing="0.1em">INDUSTRIAL</text>
      </svg>
    );
  }

  // Variant B — concentric ring / heatmap rows
  const size = 380;
  const cx = size/2, cy = size/2;
  const ringCount = 5;
  const rInner = 40, rOuter = 170;
  const ringStep = (rOuter - rInner) / ringCount;

  const elements = [];
  dims.forEach((d, i) => {
    const a0 = (i / N) * Math.PI * 2 - Math.PI / 2 + 0.01;
    const a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2 - 0.01;
    const s = scores[d.id] ?? 0;
    for (let r = 0; r < ringCount; r++) {
      const on = (r + 1) <= Math.round(s);
      const r0 = rInner + r * ringStep + 1;
      const r1 = rInner + (r + 1) * ringStep - 1;
      const filled = i < mutedUntil || mutedUntil >= N;
      elements.push(
        <path key={`${d.id}-${r}`}
              d={describeWedge(cx, cy, r0, r1, a0, a1)}
              fill={filled && on ? scoreColor(s) : 'var(--bone)'}
              stroke="var(--rule)"
              strokeWidth="0.4"
              opacity={editingDim === d.id && filled ? 0.55 : 1}
              onClick={() => onCellClick && onCellClick(d)}
              style={{cursor: onCellClick ? 'pointer' : 'default'}}
        />
      );
    }
    const mid = (a0 + a1) / 2;
    const lx = cx + Math.cos(mid) * (rOuter + 22);
    const ly = cy + Math.sin(mid) * (rOuter + 22);
    elements.push(
      <text key={`lab-${d.id}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            fontFamily="var(--sans)" fontSize="11" fill="var(--charcoal)" fontWeight="500">
        {shortName(d.short)}
      </text>
    );
    if (editingDim === d.id) {
      elements.push(
        <path key={`edit-${d.id}`}
              d={describeWedge(cx, cy, rInner, rOuter, a0, a1)}
              fill="none" stroke="var(--crimson)" strokeWidth="2" strokeDasharray="4 3" />
      );
    }
  });

  return (
    <svg viewBox={`0 0 ${size} ${size + 40}`} width="100%" style={{maxWidth: 460, display: 'block', margin: '0 auto'}}>
      {elements}
      <circle cx={cx} cy={cy} r={rInner - 2} fill="var(--paper)" stroke="var(--navy)" strokeWidth="1.5" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--serif)" fontSize="12" fill="var(--navy)" fontStyle="italic">Acme</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--slate)" letterSpacing="0.1em">FY26 · Q1</text>
    </svg>
  );
}

function describeWedge(cx, cy, rInner, rOuter, a0, a1) {
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  const xo0 = cx + Math.cos(a0) * rOuter, yo0 = cy + Math.sin(a0) * rOuter;
  const xo1 = cx + Math.cos(a1) * rOuter, yo1 = cy + Math.sin(a1) * rOuter;
  const xi0 = cx + Math.cos(a0) * rInner, yi0 = cy + Math.sin(a0) * rInner;
  const xi1 = cx + Math.cos(a1) * rInner, yi1 = cy + Math.sin(a1) * rInner;
  return [
    `M ${xo0} ${yo0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${xo1} ${yo1}`,
    `L ${xi1} ${yi1}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${xi0} ${yi0}`,
    'Z'
  ].join(' ');
}

function shortName(s) {
  return s.replace('Strategy ', '').replace('Strategic ', '');
}

// Score legend
function ScoreLegend() {
  const steps = [
    { v: '0–1.4', c: 'oklch(0.58 0.15 25)',  lab: 'Absent' },
    { v: '1.5–2.4', c: 'oklch(0.65 0.13 50)', lab: 'Emerging' },
    { v: '2.5–3.4', c: 'oklch(0.72 0.09 95)', lab: 'Inconsistent' },
    { v: '3.5–5.0', c: 'oklch(0.62 0.09 150)',lab: 'Mature' },
  ];
  return (
    <div style={{display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8}}>
      {steps.map(s => (
        <div key={s.v} style={{display:'flex', alignItems:'center', gap:6, fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)'}}>
          <span style={{width:10, height:10, background: s.c, borderRadius: 2, display:'inline-block'}}/>
          <span style={{color:'var(--charcoal)'}}>{s.lab}</span>
          <span style={{opacity:0.7}}>{s.v}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { StrategyWheel, ScoreLegend });
