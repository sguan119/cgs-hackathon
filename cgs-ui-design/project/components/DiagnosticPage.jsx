// S2 Diagnostic Agent — static, prop-driven (no interactivity).

function DimChip({ dimId }) {
  const d = window.CGS_DIMENSIONS.find(x => x.id === dimId);
  if (!d) return null;
  return <span className="tag" style={{borderColor:'var(--navy)', color:'var(--navy)'}}>{d.abbr} · {shortName(d.short)}</span>;
}

function shortName2(s) { return s.replace('Strategy ', '').replace('Strategic ', ''); }

function DocMemoStatic({ highlightId }) {
  const doc = window.DOC_MEMO;
  return (
    <div style={{padding: '18px 22px', fontFamily: 'var(--serif)', fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)'}}>
      <div style={{fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--slate)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8}}>
        Fixture · CEO Memo · 5 pp · <span style={{color: 'var(--crimson-ink)'}}>fictional · demo-only</span>
      </div>
      <div style={{fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, color: 'var(--navy)', marginBottom: 2}}>{doc.title}</div>
      <div style={{fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--slate)', marginBottom: 14}}>
        {doc.author} · {doc.date}
      </div>
      {doc.sentences.map(s => (
        <span key={s.id} style={{
          background: highlightId === s.id ? 'rgba(212, 162, 50, 0.18)' : 'transparent',
          borderBottom: s.conflict ? '1.5px solid var(--crimson)' : (highlightId === s.id ? '1px solid var(--gold)' : 'none'),
          padding: '2px 2px', marginRight: 4,
        }}>
          {s.text}{' '}
          <span className="tag" style={{fontSize: 9, padding: '1px 5px'}}>{window.CGS_DIMENSIONS.find(d => d.id === s.dim).abbr}</span>{' '}
        </span>
      ))}
    </div>
  );
}

function NodeBoxS({ label, tone, small, note }) {
  const bg = tone === 'navy' ? 'var(--navy)' : tone === 'crimson' ? 'rgba(200, 60, 55, 0.08)' : 'var(--paper)';
  const fg = tone === 'navy' ? 'var(--paper)' : 'var(--charcoal)';
  const bc = tone === 'crimson' ? 'var(--crimson)' : tone === 'navy' ? 'var(--navy)' : 'var(--rule)';
  return (
    <div style={{
      background: bg, color: fg,
      border: `${tone === 'crimson' ? 1.5 : 1}px solid ${bc}`,
      padding: small ? '5px 8px' : '9px 12px',
      fontSize: small ? 11 : 12.5,
      fontFamily: 'var(--sans)',
      fontWeight: tone === 'navy' ? 500 : 400,
      borderRadius: 2,
    }}>
      {label}
      {note && <div style={{fontFamily:'var(--mono)', fontSize:9, color:'var(--crimson-ink)', marginTop: 3, letterSpacing:'0.04em'}}>{note}</div>}
    </div>
  );
}

function DocOrgStatic() {
  const o = window.DOC_ORG;
  const children = (pid) => o.nodes.filter(n => n.parent === pid);
  return (
    <div style={{padding: 22}}>
      <div style={{fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--slate)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10}}>Fixture · Org Structure</div>
      <div style={{fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--navy)', marginBottom: 16}}>{o.title}</div>
      <div style={{display:'flex', justifyContent:'center'}}><NodeBoxS label="CEO" tone="navy" /></div>
      <div style={{height: 18, borderLeft: '1px solid var(--rule)', margin: '0 auto', width: 1}}/>
      <div style={{display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10}}>
        {o.nodes.filter(n => n.lvl === 1).map(n => (
          <div key={n.id} style={{display:'flex', flexDirection:'column', gap: 8}}>
            <NodeBoxS label={n.label} tone={n.highlight || 'slate'} />
            <div style={{display:'flex', flexDirection:'column', gap: 4, paddingLeft: 8, borderLeft: '1px solid var(--rule-2)'}}>
              {children(n.id).map(c => <NodeBoxS key={c.id} label={c.label} small tone={c.highlight} note={c.note}/>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocCallStatic() {
  const c = window.DOC_CALL;
  return (
    <div style={{padding: 22}}>
      <div style={{fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--slate)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10}}>Fixture · Earnings Transcript</div>
      <div style={{fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--navy)', marginBottom: 14}}>{c.title}</div>
      <div style={{display:'flex', flexDirection:'column', gap: 10}}>
        {c.speakers.map((s, i) => (
          <div key={i} style={{display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14, alignItems: 'baseline'}}>
            <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)', textAlign: 'right'}}>{s.who}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 13, lineHeight: 1.55, color: 'var(--ink)', borderBottom: s.conflict ? '1.5px solid var(--crimson)' : 'none'}}>
              {s.line}{s.dim && <span className="tag" style={{fontSize: 9, marginLeft: 6}}>{window.CGS_DIMENSIONS.find(d => d.id === s.dim).abbr}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InertiaCardStatic({ h, highlightInterv }) {
  const kindColor = h.kind === 'Dominant Logic Inertia' ? 'crimson' : 'navy';
  return (
    <div className="card" style={{borderColor: h.kind === 'Dominant Logic Inertia' ? 'var(--crimson)' : 'var(--navy)'}}>
      <div className="card-h" style={{paddingBottom: 10}}>
        <div>
          <div className={`dot-tag ${kindColor === 'crimson' ? 'crim' : 'navy'}`} style={{marginBottom: 4}}>
            <span className="d"/><span>{h.kind}</span>
          </div>
          <div style={{fontFamily:'var(--serif)', fontSize: 15, color: 'var(--navy)', lineHeight: 1.3, fontWeight: 500, marginTop: 4}}>
            {h.label}
          </div>
        </div>
        <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)', textAlign:'right'}}>
          <span style={{fontSize: 20, color:'var(--navy)'}}>{Math.round(h.confidence*100)}</span>
          <span style={{color:'var(--mist)'}}>/100</span>
        </div>
      </div>
      <div className="card-b">
        <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8}}>Evidence</div>
        {h.evidence.slice(0, 2).map((e, i) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'100px 1fr', gap: 12, fontSize: 12.5, padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid var(--rule-2)'}}>
            <div style={{fontFamily:'var(--mono)', fontSize:10.5, color:'var(--slate)'}}>{e.src}</div>
            <div style={{fontFamily:'var(--serif)', fontStyle:'italic', color: 'var(--ink)'}}>{e.text}</div>
          </div>
        ))}
        <hr className="rule"/>
        <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10}}>
          Candidate interventions
        </div>
        <div style={{display:'flex', flexDirection:'column', gap: 6}}>
          {h.interventions.slice(0, 2).map(iId => {
            const iv = window.INTERVENTIONS[iId];
            const picked = highlightInterv === iId;
            return (
              <div key={iId} style={{
                padding: '8px 12px',
                border: '1px solid ' + (picked ? 'var(--navy)' : 'var(--rule)'),
                borderLeft: '3px solid ' + (picked ? 'var(--navy)' : 'var(--gold)'),
                background: picked ? 'rgba(15,27,45,0.03)' : 'var(--paper)',
                borderRadius: 2
              }}>
                <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap: 10}}>
                  <div style={{fontFamily:'var(--serif)', fontSize: 13, color: 'var(--navy)', fontWeight: 500}}>{iv.title}</div>
                  <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)'}}>×{iv.usedN}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DiagnosticPage({ wheelVariant = 'A', overrideActive = false }) {
  const scores = overrideActive ? window.CGS_OVERRIDE_SCORES : window.CGS_DEFAULT_SCORES;
  const editing = overrideActive ? 'inn' : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="crumb">S2 · Diagnostic Agent</div>
          <h1>Acme Industrial <em>— strategy diagnostic</em></h1>
          <div style={{marginTop: 8, display:'flex', gap: 8, alignItems:'center'}}>
            <span className="tag sage">Strategy Wheel · Inertia two-class</span>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 10}}>
          <div className="meta">D. Park · 4 min 22 s</div>
          <div className="actions">
            <button className="btn primary">Share brief <span className="kbd">⌘↵</span></button>
          </div>
        </div>
      </div>

      <div className="grid doc-grid" style={{marginBottom: 24}}>
        <div className="card">
          <div className="card-h">
            <div className="t">Source documents</div>
            <span className="tag sage">3 files · tagged</span>
          </div>
          <div className="card-b" style={{padding: 0}}>
            <div style={{borderBottom:'1px solid var(--rule-2)'}}><DocMemoStatic highlightId="m3"/></div>
            <div style={{borderBottom:'1px solid var(--rule-2)'}}><DocOrgStatic/></div>
            <div><DocCallStatic/></div>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: 18}}>
          <div className="card">
            <div className="card-h">
              <div className="t">Strategy Wheel</div>
              <div style={{display:'flex', gap: 6}}>
                <span className="tag">variant {wheelVariant}</span>
                {overrideActive && <span className="tag crimson">Fellow override</span>}
              </div>
            </div>
            <div className="card-b">
              <StrategyWheel variant={wheelVariant} scores={scores} editingDim={editing}/>
              <ScoreLegend />
              {overrideActive && (
                <div style={{marginTop: 14, padding: '10px 12px', background:'rgba(15,27,45,0.04)', borderLeft:'3px solid var(--crimson)', fontSize: 12}}>
                  <span style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--crimson-ink)', letterSpacing:'0.06em', textTransform:'uppercase'}}>Override · D. Park</span>
                  <div style={{marginTop: 4, color:'var(--ink)', fontFamily:'var(--serif)'}}>
                    Strategic Innovation · 1.4 → 3.4
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Evidence health</div>
            </div>
            <div className="card-b" style={{padding: 0}}>
              {window.CGS_DIMENSIONS.map(d => {
                const n = d.id === 'inn' ? 2 : d.id === 'tcon' ? 3 : d.id === 'int' ? 2 : 5;
                const weak = n < 3;
                return (
                  <div key={d.id} style={{display:'grid', gridTemplateColumns:'130px 1fr 60px', padding:'9px 14px', borderBottom:'1px solid var(--rule-2)', alignItems:'center', gap: 12}}>
                    <div style={{fontFamily:'var(--sans)', fontSize: 12, color: 'var(--charcoal)'}}>{shortName2(d.short)}</div>
                    <div style={{display:'flex', gap: 3}}>
                      {[1,2,3,4,5].map(i => <span key={i} style={{width: 20, height: 6, background: i <= n ? (weak ? 'var(--crimson)' : 'var(--navy)') : 'var(--rule)', borderRadius: 1}}/>)}
                    </div>
                    <div style={{fontFamily:'var(--mono)', fontSize:10, color: weak ? 'var(--crimson-ink)' : 'var(--slate)', textAlign:'right'}}>
                      {weak ? `weak · ${n}` : `${n} pts`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{marginTop: 10, marginBottom: 14}}>
        <div className="crumb" style={{fontFamily:'var(--mono)', fontSize: 11, color: 'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 6}}>
          Inertia hypotheses
        </div>
        <hr className="rule thick" style={{margin:'4px 0 18px'}}/>
      </div>
      <div className="grid two-col">
        {window.INERTIA_HYPOTHESES.map(h => (
          <InertiaCardStatic key={h.id} h={h} highlightInterv={overrideActive && h.id === 'sli-1' ? 'int-d' : null}/>
        ))}
      </div>


    </div>
  );
}

Object.assign(window, { DiagnosticPage, DimChip });
