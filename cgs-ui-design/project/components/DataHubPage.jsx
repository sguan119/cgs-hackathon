// §7 Data Hub — tag & classify. Mid-fi wireframe.

function ClientFolder({ clientName }) {
  const files = [
    { icon: '📄', name: 'CEO Memo · Strategy to the Board',   meta: 'Mar 14, 2026 · 5 pp · M. Halverson' },
    { icon: '📊', name: 'Organization Structure · Q1 FY26',    meta: 'Mar 22, 2026 · org chart · v3' },
    { icon: '📄', name: 'Q3 FY25 Earnings Call · transcript',  meta: 'Apr 14, 2026 · 24 pp · ingested' },
    { icon: '📄', name: 'Bi-weekly notes · M1 · Apr 07',       meta: 'Apr 07, 2026 · 3 pp · D. Park' },
    { icon: '📧', name: 'Exec inbox thread · TO scope',         meta: 'Apr 11, 2026 · CFO Lindqvist · 8 msgs' },
    { icon: '🗂', name: '14 more files',                        meta: 'decks · memos · financials · press' },
  ];
  return (
    <div style={{padding:'8px 16px 14px 44px', borderTop:'1px solid var(--rule-2)', background:'rgba(15,27,45,0.02)'}}>
      <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 6}}>
        {clientName} · folder
      </div>
      {files.map((f, i) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'20px 1fr auto', gap: 10, padding:'5px 0', alignItems:'baseline', borderTop: i === 0 ? 'none' : '1px dotted var(--rule-2)'}}>
          <div style={{fontSize: 13}}>{f.icon}</div>
          <div style={{fontFamily:'var(--serif)', fontSize: 12.5, color:'var(--ink)'}}>{f.name}</div>
          <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.02em'}}>{f.meta}</div>
        </div>
      ))}
    </div>
  );
}

function DataHubPage() {
  const h = window.DATA_HUB;

  return (
    <div className="page" style={{maxWidth: 1320}}>
      <div className="page-header">
        <div>
          <div className="crumb">§7 · Data Hub</div>
          <h1>Data Hub <em>— tag &amp; classify</em></h1>
          <div style={{marginTop: 8, display:'flex', gap: 8, alignItems:'center', flexWrap:'wrap'}}>
            <span className="tag sage">● connected · Collective Brain</span>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 10}}>
          <div className="actions">
            <button className="btn primary">Save</button>
          </div>
        </div>
      </div>

      {/* Uploads strip */}
      <div className="card" style={{marginBottom: 18}}>
        <div className="card-h">
          <div className="t">Recent uploads</div>
          <span className="tag">classify &amp; ingest</span>
        </div>
        <div className="card-b" style={{padding: 0}}>
          {h.uploads.map((u, i) => (
            <div key={u.id} style={{display:'grid', gridTemplateColumns:'1fr 90px 90px 110px', padding:'10px 16px', borderTop: i===0?'none':'1px solid var(--rule-2)', alignItems:'center', gap: 12}}>
              <div style={{fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink)'}}>{u.name}</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)'}}>{u.size}</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)'}}>{u.rows} rows</div>
              <div>
                {u.status === 'tagged' && <span className="tag sage">● tagged</span>}
                {u.status === 'tagging' && <span className="tag gold">◐ tagging</span>}
                {u.status === 'untagged' && <span className="tag crimson">○ untagged</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tagging view */}
          <div className="card" style={{marginBottom: 18}}>
            <div className="card-h">
              <div className="t">Clients · tagged <em>— industry / size / region</em></div>
              <span className="tag">CRM_export_Q2_2026.csv · 84 rows</span>
            </div>
            <div className="card-b" style={{padding: 0, overflow:'hidden'}}>
              <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr 0.7fr 0.7fr 1.2fr 0.9fr 60px', padding:'10px 16px', background:'rgba(15,27,45,0.03)', fontFamily:'var(--mono)', fontSize: 9.5, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', borderBottom:'1px solid var(--rule)'}}>
                <div>Client</div><div>Industry</div><div>Size</div><div>Region</div><div>Service line</div><div>Stage</div><div></div>
              </div>
              {h.crmRows.map((r) => {
                const expanded = r.name === 'Acme Industrial';
                return (
                  <React.Fragment key={r.id}>
                    <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr 0.7fr 0.7fr 1.2fr 0.9fr 60px', padding:'10px 16px', borderTop:'1px solid var(--rule-2)', alignItems:'center', gap: 8, fontSize: 12.5, background: expanded ? 'rgba(15,27,45,0.02)' : 'transparent'}}>
                      <div style={{fontFamily:'var(--serif)', color:'var(--ink)', fontWeight: 500, display:'flex', gap: 6, alignItems:'center'}}>
                        {r.flag === 'new' && <span style={{display:'inline-block', width: 6, height: 6, borderRadius:'50%', background:'var(--crimson)'}}/>}
                        {r.name}
                      </div>
                      <div><span className="tag">{r.industry}</span></div>
                      <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--slate)'}}>{r.size}</div>
                      <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--slate)'}}>{r.region}</div>
                      <div><span className="tag navy">{r.serviceLine}</span></div>
                      <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color: r.stage==='Signal'?'var(--crimson-ink)' : r.stage==='Retainer'?'var(--sage-ink)' : 'var(--slate)'}}>{r.stage}</div>
                      <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--navy)', textAlign:'right', cursor:'pointer', textDecoration:'underline'}}>
                        {expanded ? 'less ▾' : 'more ▸'}
                      </div>
                    </div>
                    {expanded && <ClientFolder clientName={r.name}/>}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

    </div>
  );
}

Object.assign(window, { DataHubPage });
