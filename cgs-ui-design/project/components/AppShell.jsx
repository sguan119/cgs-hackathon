// App shell — titlebar + sidebar + main content area.

function AppShell({ active, children, compact }) {
  return (
    <div className="window" style={{width: '100%', height: '100%', background: 'var(--ivory)', display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <div className="titlebar">
        <div className="traffic"><span className="c"/><span className="m"/><span className="x"/></div>
        <div className="title">
          CGS Workbench <span className="dot">·</span> Acme Industrial <span className="dot">·</span>
          <span style={{color:'#555E6E'}}>cgs-advisors.local</span>
        </div>
        <div className="right">Acme · M2 · Apr 21</div>
      </div>
      <div className="app">
        <Sidebar active={active}/>
        <div className="main">
          {children}
        </div>
      </div>
    </div>
  );
}

function Sidebar({ active }) {
  const SubNav = ({ items, parent }) => (
    <div className="nav-group">
      {items.map(i => (
        <div key={i.id} className={'nav-sub ' + (active === i.id ? 'active' : '')}>
          <span className="tick"/>{i.label}
        </div>
      ))}
    </div>
  );

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="mark"><span className="glyph"/>CGS Workbench</div>
        <div className="sub">Agentic AI · v0.4</div>
      </div>

      <div className="nav-section">
        <div className="label">Workspace</div>
        <div className={'nav-item ' + (active === 'dashboard' ? 'active' : '')}><span className="num">§5</span>Dashboard<span className="sub-label">14</span></div>
        <div className={'nav-item ' + (active === 'datahub' ? 'active' : '')}><span className="num">§7</span>Data Hub<span className="sub-label">3</span></div>
      </div>

      <div className="nav-section">
        <div className="label">Active engagement · Acme Industrial</div>
        <div className={'nav-item ' + (active === 'diagnostic' ? 'active' : '')}>
          <span className="num">§2</span>Diagnostic Agent
        </div>
        <div className={'nav-item ' + (['preread','realtime','post'].includes(active) ? 'active' : '')}>
          <span className="num">§3</span>Meeting Recall
        </div>
        {['preread','realtime','post'].includes(active) && (
          <SubNav items={[
            {id:'preread', label:'Pre-Read brief'},
            {id:'realtime', label:'Real-Time Recall'},
            {id:'post', label:'Post-meeting'},
          ]}/>
        )}
        <div className={'nav-item ' + (active === 'continuity' ? 'active' : '')}>
          <span className="num">§6</span>Continuity Agent
        </div>
      </div>

      <div style={{margin:'8px 12px 12px', padding: '10px 12px', border:'1px dashed var(--rule)', borderRadius: 3, background: 'rgba(15,27,45,0.03)'}}>
        <div style={{display:'flex', alignItems:'center', gap: 6, marginBottom: 4}}>
          <span style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--navy)', padding:'1px 5px', border:'1px solid var(--navy)', borderRadius: 2, letterSpacing:'0.04em'}}>⌘K</span>
          <span style={{fontFamily:'var(--sans)', fontSize: 11.5, color:'var(--navy)', fontWeight: 500}}>Ask recall</span>
        </div>
        <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'var(--slate)', lineHeight: 1.5, letterSpacing:'0.02em'}}>
          Summon from any app · stays<br/>on top · client-invisible
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="row"><span>Fellow</span><span className="val">D. Park</span></div>
        <div className="row"><span>Corpus</span><span className="val">1.07 TB · synced</span></div>
        <div className="row"><span>Mode</span><span className="val">Pre-RFP</span></div>
      </div>
    </div>
  );
}

Object.assign(window, { AppShell, Sidebar });
