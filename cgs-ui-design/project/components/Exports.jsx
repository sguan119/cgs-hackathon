// Stand-alone document exports + design system reference sheet.

function PreReadDocExport() {
  const pr = window.PRE_READ;
  return (
    <div style={{padding:'56px 64px', fontFamily:'var(--serif)', background:'#fff', height:'100%', overflow:'hidden', color:'var(--ink)'}}>
      <div style={{borderBottom:'2px solid var(--navy)', paddingBottom: 14, marginBottom: 22}}>
        <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.12em', textTransform:'uppercase'}}>
          CGS · Meeting Brief · confidential / internal use
        </div>
        <div style={{fontFamily:'var(--serif)', fontSize: 26, color:'var(--navy)', fontWeight: 500, marginTop: 10, letterSpacing:'-0.01em'}}>Acme Industrial — bi-weekly</div>
        <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--slate)', marginTop: 4}}>Apr 21, 2026 · 10:30–11:30 · Fellow D. Park</div>
      </div>

      <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom: 12}}>§ 1 · Unsolved threads carried forward</div>
      {pr.unsolved.map((u, i) => (
        <div key={i} style={{fontSize: 13, lineHeight: 1.6, padding: '4px 0', display:'flex', gap: 8}}>
          <span style={{color:'var(--crimson)'}}>◆</span><span>{u}</span>
        </div>
      ))}

      <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.1em', textTransform:'uppercase', margin:'26px 0 12px'}}>§ 2 · Predicted analogical questions</div>

      {pr.predicted.map((p, i) => (
        <div key={i} style={{marginBottom: 18, paddingBottom: 16, borderBottom: i === pr.predicted.length - 1 ? 'none' : '1px solid var(--rule-2)'}}>
          <div style={{display:'flex', gap: 10}}>
            <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--navy)', flexShrink:0}}>Q{i+1}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 14, color:'var(--navy)', fontWeight: 500, lineHeight: 1.4}}>{p.q}</div>
          </div>
          <div style={{marginLeft: 30, marginTop: 8, fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 13, color:'var(--ink)'}}>
            ↳ precedent · {p.anchor}
          </div>
          <div style={{marginLeft: 30, marginTop: 4, fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)'}}>
            ingredient · {p.src} · <span style={{color:'var(--navy)'}}>{window.CGS_DIMENSIONS.find(d=>d.id===p.dim).abbr}</span>
          </div>
        </div>
      ))}

      <div style={{position:'absolute', bottom: 28, left: 64, right: 64, display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize: 9, color:'var(--mist)', letterSpacing:'0.08em'}}>
        <span>CGS-MTG-0421-A</span><span>page 1 / 3</span>
      </div>
    </div>
  );
}

function MemoExport() {
  return (
    <div style={{padding:'56px 64px', fontFamily:'var(--serif)', background:'#fff', height:'100%', color:'var(--ink)', overflow:'hidden'}}>
      <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom: 4}}>D. Park · Fellow, CGS Advisors</div>
      <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--slate)', marginBottom: 20}}>
        22 Apr 2026 · 4:58 PM &nbsp;·&nbsp; To: M. Halverson &nbsp;·&nbsp; cc: R. Vega, S. Lindqvist
      </div>
      <div style={{fontFamily:'var(--serif)', fontSize: 24, color:'var(--navy)', fontWeight: 500, letterSpacing:'-0.01em', marginBottom: 22}}>
        Following up on yesterday's conversation
      </div>
      <div style={{fontSize: 14, lineHeight: 1.75}}>
        <p style={{margin:'0 0 14px'}}>M.,</p>
        <p style={{margin:'0 0 14px'}}>Two items worth sitting with before we meet again.</p>
        <p style={{margin:'0 0 14px'}}><strong style={{color:'var(--navy)'}}>On the innovation reporting line.</strong> Closest analogue in our archive: 2018 manufacturer, same configuration. CDO under Ops for nine months before drift; moving to direct-CEO unlocked two stuck initiatives within a quarter. Political cost came from Ops PMO, not Finance.</p>
        <p style={{margin:'0 0 14px'}}>Not yet recommending the move — want to test the read first. I'd like fifteen minutes of Meeting 3 on <em>observable signals that would tell us this pattern has started</em>.</p>
        <p style={{margin:'0 0 14px'}}><strong style={{color:'var(--navy)'}}>On the Transformation Office scope.</strong> Cleanest version I've seen: dual P&amp;L, run vs. change, TO owns only the change column. Usually a budget reclassification, not a new function.</p>
        <p style={{margin:'0 0 14px'}}>AI-governance question still open. End of this week.</p>
        <p style={{margin:'20px 0 0'}}>— D.</p>
      </div>
      <hr className="rule" style={{marginTop: 30}}/>
      <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.06em'}}>
        Sources · Globex 2018 (CGS-2018-GLBX-M042) · Initech 2019 (CGS-2019-INTK-M018) · Fellow review: D. Park.
      </div>
    </div>
  );
}

function DesignSystemSheet() {
  const tokens = [
    { name:'ivory',    v:'#F4F1EA', use:'page bg' },
    { name:'paper',    v:'#FAF8F3', use:'card fill' },
    { name:'bone',     v:'#EAE4D6', use:'placeholder, titlebar' },
    { name:'ink',      v:'#121821', use:'body text' },
    { name:'navy',     v:'#0F1B2D', use:'primary, headings' },
    { name:'charcoal', v:'#2A313D', use:'secondary text' },
    { name:'slate',    v:'#555E6E', use:'tertiary text' },
    { name:'mist',     v:'#8B93A1', use:'disabled, ticks' },
    { name:'crimson',  v:'oklch(0.55 0.15 25)',  use:'inertia · override · warn' },
    { name:'sage',     v:'oklch(0.58 0.06 150)', use:'confident · cited' },
    { name:'gold',     v:'oklch(0.72 0.10 75)',  use:'highlight · beat marker' },
  ];
  return (
    <div style={{padding: '36px 44px', background:'var(--ivory)', height:'100%', overflow:'hidden'}}>
      <div style={{fontFamily:'var(--serif)', fontSize: 22, color:'var(--navy)', fontWeight: 500, letterSpacing:'-0.01em'}}>Design system</div>
      <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop: 4, marginBottom: 24}}>
        tokens · typography · components
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 32}}>
        {/* Tokens */}
        <div>
          <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 8}}>Color tokens</div>
          <div style={{display:'flex', flexDirection:'column', gap: 4}}>
            {tokens.map(t => (
              <div key={t.name} style={{display:'grid', gridTemplateColumns:'28px 120px 1fr 1fr', alignItems:'center', gap: 10, padding:'5px 0', borderBottom:'1px solid var(--rule-2)'}}>
                <div style={{width: 22, height: 22, background: t.v, border:'1px solid var(--rule)', borderRadius: 2}}/>
                <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--navy)'}}>{t.name}</div>
                <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)'}}>{t.v}</div>
                <div style={{fontFamily:'var(--sans)', fontSize: 11.5, color:'var(--charcoal)'}}>{t.use}</div>
              </div>
            ))}
          </div>

          <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop: 22, marginBottom: 8}}>Typography</div>
          <div style={{display:'flex', flexDirection:'column', gap: 10}}>
            <div>
              <div style={{fontFamily:'var(--serif)', fontSize: 28, color:'var(--navy)', fontWeight: 500, letterSpacing:'-0.01em'}}>IBM Plex Serif</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)'}}>H1 32 / 400  · H2 22 / 500  · body 13–14 / 1.6–1.7</div>
            </div>
            <div>
              <div style={{fontFamily:'var(--sans)', fontSize: 15, color:'var(--ink)', fontWeight: 500}}>IBM Plex Sans — UI, chrome, buttons</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)'}}>12–14 / 1.5 · ui primary</div>
            </div>
            <div>
              <div style={{fontFamily:'var(--mono)', fontSize: 12, color:'var(--charcoal)'}}>IBM PLEX MONO · meta, tags, citations</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)'}}>9–11 / 1.5 · uppercase · 0.04–0.1em tracking</div>
            </div>
          </div>
        </div>

        {/* Components */}
        <div>
          <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 10}}>Tags</div>
          <div style={{display:'flex', gap: 6, flexWrap:'wrap', marginBottom: 18}}>
            <span className="tag">default</span>
            <span className="tag navy">navy</span>
            <span className="tag sage">sage · cited</span>
            <span className="tag crimson">crimson · inertia</span>
            <span className="tag gold">gold · beat</span>
            <span className="dot-tag"><span className="d"/>confident</span>
            <span className="dot-tag crim"><span className="d"/>inertia</span>
            <span className="dot-tag gold"><span className="d"/>queued</span>
          </div>

          <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 10}}>Buttons</div>
          <div style={{display:'flex', gap: 8, marginBottom: 18, alignItems:'center'}}>
            <button className="btn">Secondary</button>
            <button className="btn primary">Primary <span className="kbd">⌘↵</span></button>
            <button className="btn sm">Small</button>
            <button className="btn ghost">Ghost</button>
          </div>

          <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 10}}>Precedent card</div>
          <div style={{padding:'12px 14px', background:'var(--paper)', border:'1px solid var(--rule)', borderLeft:'3px solid var(--navy)', marginBottom: 18}}>
            <div style={{fontFamily:'var(--serif)', fontSize: 15, color:'var(--navy)', fontWeight: 500}}>Globex Industrial · 2018</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 12.5, fontStyle:'italic', color:'var(--ink)', marginTop: 2}}>Moved CDO from COO to direct CEO line…</div>
            <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', marginTop: 8}}>source · CGS-2018-GLBX-M042</div>
          </div>

          <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 10}}>Diff rows (Thesis Memory)</div>
          <div style={{padding: 10, background:'var(--paper)', border:'1px solid var(--rule)'}}>
            <div style={{fontFamily:'var(--serif)', fontSize: 13, padding: 6, background:'rgba(88,124,82,0.08)', borderLeft:'2px solid var(--sage)', paddingLeft: 10, color:'var(--ink)', marginBottom: 4}}>
              <span style={{fontFamily:'var(--mono)', color:'var(--sage-ink)', marginRight: 8}}>+</span>Initech 2019 (dual P&amp;L)
            </div>
            <div style={{fontFamily:'var(--serif)', fontSize: 13, padding: 6, paddingLeft: 10, color:'var(--ink)'}}>
              <span style={{fontFamily:'var(--mono)', color:'var(--mist)', marginRight: 8}}>·</span>Globex 2018 (governance)
            </div>
          </div>

          <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop: 18, marginBottom: 10}}>Layout grid</div>
          <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--charcoal)', lineHeight: 1.7}}>
            app · 232 sidebar + flex main · 12-col grid inside main<br/>
            page padding · 28/36 · max-width 1360<br/>
            card radius · 4 · border 1px rule<br/>
            text-wrap · pretty · all body copy
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PreReadDocExport, MemoExport, DesignSystemSheet });
