// §5 Dashboard — demo entry surface. Mid-fi wireframe fidelity.
// Claims:  (1) 30-second context load;  (2) timeline events route to §2 / §3 / §6.

function StageTrack({ stages, current }) {
  const idx = stages.indexOf(current);
  return (
    <div style={{display:'flex', alignItems:'center', gap: 0, margin: '6px 0'}}>
      {stages.map((s, i) => {
        const active = i === idx;
        const past = i < idx;
        return (
          <React.Fragment key={s}>
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap: 6,
              flex: '0 0 auto', minWidth: 110,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: active ? 'var(--crimson)' : past ? 'var(--navy)' : 'var(--paper)',
                border: '1.5px solid ' + (active ? 'var(--crimson)' : past ? 'var(--navy)' : 'var(--rule)'),
              }}/>
              <div style={{
                fontFamily:'var(--mono)', fontSize: 10,
                color: active ? 'var(--crimson-ink)' : past ? 'var(--navy)' : 'var(--mist)',
                letterSpacing:'0.06em', textTransform:'uppercase',
                fontWeight: active ? 600 : 500, whiteSpace:'nowrap',
              }}>{s}</div>
            </div>
            {i < stages.length - 1 && (
              <div style={{flex: 1, height: 1.5, background: i < idx ? 'var(--navy)' : 'var(--rule)', marginTop: -18}}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TimelineItem({ item }) {
  const kindMap = {
    meeting: 'MTG', earnings:'ERN', email:'EML',
    memo:'MEM',     project:'PRJ',  signal:'SIG',
  };
  const g = kindMap[item.kind] || 'EVT';
  const routeLabel = { recall:'Recall', diagnostic:'Diagnostic', continuity:'Continuity' }[item.route];
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'54px 1fr 110px', gap: 14,
      padding:'11px 16px', borderTop:'1px solid var(--rule-2)',
      alignItems:'center', cursor:'pointer',
    }}>
      <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)'}}>{item.t}<div style={{fontSize: 9, color:'var(--mist)', marginTop: 2, letterSpacing:'0.08em'}}>{g}</div></div>
      <div>
        <div style={{fontFamily:'var(--serif)', fontSize: 13.5, color:'var(--ink)', fontWeight: 500, lineHeight: 1.35}}>{item.label}</div>
        {item.sub && (
          <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', marginTop: 3, letterSpacing:'0.02em'}}>{item.sub}</div>
        )}
      </div>
      <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--navy)', textAlign:'right', whiteSpace:'nowrap'}}>→ {routeLabel}</div>
    </div>
  );
}

function AlertCard({ alert }) {
  const sev = alert.severity;
  const bar = sev === 'high' ? 'var(--crimson)' : 'var(--gold)';
  return (
    <div style={{
      padding:'10px 14px',
      background:'var(--paper)',
      border:'1px solid var(--rule)',
      borderLeft:`3px solid ${bar}`,
      borderRadius: 2, marginBottom: 8,
    }}>
      <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color: sev === 'high' ? 'var(--crimson-ink)' : 'var(--gold-ink)', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600, marginBottom: 4}}>
        {alert.kind}
      </div>
      <div style={{fontFamily:'var(--serif)', fontSize: 12.5, color:'var(--ink)', lineHeight: 1.5}}>
        {alert.text}
      </div>
      {alert.source && (
        <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', marginTop: 6, letterSpacing:'0.04em'}}>
          source · {alert.source}
        </div>
      )}
    </div>
  );
}

function ContextLoadBanner({ seconds, count }) {
  return (
    <div style={{
      display:'flex', gap: 16, padding: '10px 16px',
      background:'var(--navy)', color:'var(--paper)',
      borderRadius: 2, marginBottom: 18,
      alignItems:'center', fontFamily:'var(--mono)', fontSize: 11, letterSpacing:'0.04em',
    }}>
      <span className="live-dot" style={{background:'var(--sage)'}}/>
      <span><strong style={{color:'#fff'}}>Context loaded</strong> · {seconds}s · {count} artefacts</span>
      <span style={{marginLeft:'auto', color:'var(--gold)'}}>under 30s · live</span>
    </div>
  );
}

function ClientSwitcher({ activeName }) {
  const clients = window.DATA_HUB.crmRows;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: 6, flexWrap:'wrap',
      padding:'10px 0', marginBottom: 14,
      borderBottom: '1px solid var(--rule-2)',
    }}>
      <span style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginRight: 8}}>
        Clients · {clients.length}
      </span>
      {clients.map(c => {
        const active = c.name === activeName;
        return (
          <span key={c.id} style={{
            fontFamily: active ? 'var(--serif)' : 'var(--sans)',
            fontSize: active ? 13 : 12,
            color: active ? 'var(--paper)' : 'var(--charcoal)',
            background: active ? 'var(--navy)' : 'transparent',
            border: active ? '1px solid var(--navy)' : '1px solid var(--rule)',
            padding: '3px 10px',
            borderRadius: 2,
            cursor: 'pointer',
            display:'inline-flex', alignItems:'center', gap: 6,
          }}>
            {active && <span style={{width:5, height:5, borderRadius:'50%', background:'var(--gold)'}}/>}
            {c.name}
            <span style={{fontFamily:'var(--mono)', fontSize: 9.5, color: active ? 'rgba(244,241,234,0.55)' : 'var(--mist)', letterSpacing:'0.04em'}}>· {c.stage}</span>
          </span>
        );
      })}
      <span style={{marginLeft:'auto', fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)', letterSpacing:'0.04em'}}>
        + add · Q
      </span>
    </div>
  );
}

function DashboardPage() {
  const d = window.DASHBOARD;
  return (
    <div className="page" style={{maxWidth: 1320}}>
      <ClientSwitcher activeName={d.client.name}/>

      <div className="page-header">
        <div>
          <div className="crumb">§5 · Dashboard</div>
          <h1>{d.client.name} <em>— client workspace</em></h1>
          <div style={{marginTop: 8, display:'flex', gap: 8, alignItems:'center', flexWrap:'wrap'}}>
            <span className="tag">{d.client.industry}</span>
            <span className="tag sage">● {d.client.retainer}</span>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 10}}>
          <div className="meta">
            Next · <span style={{color:'var(--navy)'}}>{d.client.nextContact}</span>
          </div>
          <div className="actions">
            <button className="btn primary">Enter meeting <span className="kbd">⌘K</span></button>
          </div>
        </div>
      </div>

      <ContextLoadBanner seconds={d.contextLoadSec} count={217}/>

      {/* Relationship stage */}
      <div className="card" style={{marginBottom: 18}}>
        <div className="card-h">
          <div className="t">Relationship stage</div>
          <span className="tag">Renewal · Jul 2026</span>
        </div>
        <div className="card-b" style={{paddingBottom: 26}}>
          <StageTrack stages={d.stages} current={d.client.relationshipStage}/>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1.5fr 1fr', gap: 18, marginBottom: 18}}>
        {/* Timeline */}
        <div className="card">
          <div className="card-h">
            <div className="t">Interaction timeline</div>
            <span className="tag">6 events</span>
          </div>
          <div className="card-b" style={{padding: 0}}>
            {d.timeline.map(t => <TimelineItem key={t.id} item={t}/>)}
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="card-h">
            <div className="t">Alerts</div>
            <span className="tag crimson">{d.alerts.filter(a=>a.severity==='high').length} high</span>
          </div>
          <div className="card-b" style={{padding: 14}}>
            {d.alerts.map(a => <AlertCard key={a.id} alert={a}/>)}
          </div>
        </div>
      </div>

      {/* External signals */}
      <div className="card">
        <div className="card-h">
          <div className="t">External signals</div>
          <span className="tag">auto</span>
        </div>
        <div className="card-b" style={{padding: 0}}>
          {d.externalSignals.map(e => (
            <div key={e.id} style={{display:'grid', gridTemplateColumns:'60px 1fr 50px', gap: 14, padding:'9px 16px', borderTop:'1px solid var(--rule-2)', alignItems:'center'}}>
              <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--slate)'}}>{e.t}</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink)'}}>{e.headline}</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--sage-ink)', textAlign:'right'}}>{Math.round(e.relevance*100)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
