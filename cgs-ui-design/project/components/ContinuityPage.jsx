// §6 Continuity Agent — post-engagement advisory. Mid-fi wireframe.
// E1 Baseline · E2 Email draft · E3 Tone Guard · E4 Reply signal · E5 Internal escalation.

function ToneGuardRow({ label, grade, note }) {
  const color = grade === 'A' ? 'var(--sage)' : grade === 'B' ? 'var(--gold)' : 'var(--crimson)';
  const ink = grade === 'A' ? 'var(--sage-ink)' : grade === 'B' ? 'var(--gold-ink)' : 'var(--crimson-ink)';
  return (
    <div style={{display:'grid', gridTemplateColumns:'140px 36px 1fr', gap: 12, alignItems:'center', padding:'8px 0', borderTop:'1px solid var(--rule-2)'}}>
      <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)', letterSpacing:'0.06em', textTransform:'uppercase'}}>{label}</div>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: color, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600,
      }}>{grade}</div>
      <div style={{fontFamily:'var(--serif)', fontSize: 12.5, color:'var(--ink)', lineHeight: 1.5}}>{note}</div>
    </div>
  );
}

function EscalationActionRow({ action }) {
  return (
    <div style={{
      padding:'10px 14px', border:'1px solid var(--rule)', borderRadius: 2,
      background:'var(--paper)', marginBottom: 8,
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap: 10}}>
        <div style={{fontFamily:'var(--serif)', fontSize: 13.5, color:'var(--navy)', fontWeight: 500}}>{action.title}</div>
        <span className="tag">{action.effort}</span>
      </div>
    </div>
  );
}

function ContinuityPage() {
  const c = window.CONTINUITY;
  return (
    <div className="page" style={{maxWidth: 1320}}>
      <div className="page-header">
        <div>
          <div className="crumb">§6 · Continuity Agent</div>
          <h1>Acme Industrial <em>— post-engagement continuity</em></h1>
          <div style={{marginTop: 8, display:'flex', gap: 8, alignItems:'center', flexWrap:'wrap'}}>
            <span className="tag crimson">● Structural Friction</span>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 10}}>
          <div className="meta">
            Next · <span style={{color:'var(--navy)'}}>Apr 24, 2026</span>
          </div>
        </div>
      </div>

      {/* E1 Baseline strip */}
      <div className="card" style={{marginBottom: 18}}>
        <div className="card-h">
          <div className="t">E1 · Close-out baseline</div>
          <div style={{display:'flex', gap: 6, alignItems:'center'}}>
            <span className="tag">closed · {c.baseline.closeDate}</span>
            <span className="tag navy">locked</span>
          </div>
        </div>
        <div className="card-b" style={{padding: 14, display:'grid', gridTemplateColumns:'1fr 1fr 1.1fr', gap: 18}}>
          <div>
            <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 4}}>Top inertia</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 13, color:'var(--crimson-ink)'}}>{c.baseline.topInertia}</div>
          </div>
          <div>
            <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 4}}>Stakeholders</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 12.5, color:'var(--ink)', lineHeight: 1.45}}>
              {c.baseline.stakeholders.map((s,i) => <div key={i}>{s}</div>)}
            </div>
          </div>
          <div>
            <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 4}}>Wheel @ close-out</div>
            <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--navy)', lineHeight: 1.55}}>{c.baseline.wheelSnapshot}</div>
          </div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1.3fr 1fr', gap: 18, marginBottom: 18}}>
        {/* E2 Email draft */}
        <div className="card">
          <div className="card-h">
            <div className="t">E2 · Check-in draft</div>
            <span className="tag sage">auto · 11:14</span>
          </div>
          <div className="card-b" style={{padding: 18, background:'#fff'}}>
            <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)', marginBottom: 4}}>To · {c.emailDraft.to}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 16, color:'var(--navy)', fontWeight: 500, marginBottom: 14, letterSpacing:'-0.01em'}}>{c.emailDraft.subject}</div>
            {c.emailDraft.body.map((b, i) => (
              <div key={i} style={{marginBottom: 12}}>
                <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--navy)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 4, fontWeight: 600}}>
                  § {b.section}
                </div>
                <div style={{fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink)', lineHeight: 1.6}}>{b.para}</div>
              </div>
            ))}
            <div style={{marginTop: 16, display:'flex', gap: 8, justifyContent:'flex-end'}}>
              <button className="btn">Edit</button>
              <button className="btn primary">Send as D. Park</button>
            </div>
          </div>
        </div>

        {/* E3 Tone Guard */}
        <div className="card">
          <div className="card-h">
            <div className="t">E3 · Email Tone Guard</div>
            <span className="tag sage">{c.toneGuard.verdict}</span>
          </div>
          <div className="card-b" style={{padding: '8px 16px'}}>
            <ToneGuardRow label="Methodology fit" grade={c.toneGuard.scores.methodology.grade} note={c.toneGuard.scores.methodology.note}/>
            <ToneGuardRow label="Non-sales voice" grade={c.toneGuard.scores.nonSales.grade}   note={c.toneGuard.scores.nonSales.note}/>
            <ToneGuardRow label="3-section format" grade={c.toneGuard.scores.format.grade}    note={c.toneGuard.scores.format.note}/>
          </div>
        </div>
      </div>

      {/* E4 + E5 */}
      <div className="grid" style={{gridTemplateColumns:'1fr 1.3fr', gap: 18}}>
        {/* E4 Reply signal */}
        <div className="card">
          <div className="card-h">
            <div className="t">E4 · Reply signal extractor</div>
            <span className="tag crimson">Structural Friction</span>
          </div>
          <div className="card-b" style={{padding: 16}}>
            {c.clientReplies.map(r => (
              <div key={r.id}>
                <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)', marginBottom: 4}}>
                  From · {r.from} · {r.date}
                </div>
                <div style={{
                  padding: '10px 12px',
                  background:'var(--paper)',
                  border:'1px solid var(--rule)',
                  borderLeft: '3px solid var(--crimson)',
                  fontFamily:'var(--serif)', fontSize: 13, fontStyle:'italic',
                  color:'var(--ink)', lineHeight: 1.6, marginBottom: 12,
                }}>“{r.excerpt}”</div>
                <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--crimson-ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom: 4, fontWeight: 600}}>
                  ⚠ {r.frictionLabel}
                </div>
                <div style={{fontFamily:'var(--serif)', fontSize: 12.5, color:'var(--ink)', lineHeight: 1.55}}>
                  {r.baselineComparison}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* E5 Internal escalation */}
        <div className="card">
          <div className="card-h">
            <div className="t">E5 · Internal escalation</div>
            <span className="tag">conf · {Math.round(c.escalation.confidence*100)}%</span>
          </div>
          <div className="card-b" style={{padding: 16}}>
            <div style={{fontFamily:'var(--serif)', fontSize: 12.5, color:'var(--ink)', marginBottom: 14, padding:'8px 12px', background:'rgba(200,60,55,0.06)', borderLeft:'2px solid var(--crimson)'}}>
              <strong>{c.escalation.friction}</strong> — Fellow picks one.
            </div>
            {c.escalation.nextActions.map(a => <EscalationActionRow key={a.id} action={a}/>)}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ContinuityPage });
