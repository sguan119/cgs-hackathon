// Real-Time Recall · rendered as a true sidecar sidebar (not full app page)
// Shows the actual physical form factor: shared meeting area + narrow Fellow-only strip.

function RecallSidebar({ turnIdx = 0, showFallback = false, collapsed = false }) {
  const turns = window.RECALL_TURNS.slice(0, turnIdx + 1);

  if (collapsed) {
    return (
      <div style={{
        width: 48, height: '100%',
        background: 'var(--navy)',
        borderLeft: '1px solid #000',
        display:'flex', flexDirection:'column', alignItems:'center',
        padding: '12px 0', gap: 14,
      }}>
        <div style={{width: 18, height: 18, border: '1.5px solid var(--paper)', borderRadius: '50%', position:'relative'}}>
          <div style={{position:'absolute', inset: 3, border:'1.5px solid var(--paper)', borderRadius:'50%', borderColor:'var(--paper) transparent transparent var(--paper)', transform:'rotate(-30deg)'}}/>
        </div>
        <div style={{writingMode:'vertical-rl', transform:'rotate(180deg)', fontFamily:'var(--mono)', fontSize: 10, color:'rgba(244,241,234,0.6)', letterSpacing:'0.2em'}}>RECALL</div>
        <div style={{marginTop:'auto', width: 8, height: 8, borderRadius:'50%', background:'var(--crimson)'}}/>
      </div>
    );
  }

  return (
    <div style={{
      width: 360, height: '100%', flexShrink: 0,
      background: 'var(--navy)', color: 'var(--paper)',
      borderLeft: '1px solid #000',
      display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      {/* Sidecar header */}
      <div style={{padding:'14px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'rgba(244,241,234,0.55)', letterSpacing:'0.18em'}}>CGS · RECALL · FELLOW ONLY</div>
          <div style={{display:'flex', gap: 6, fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.5)'}}>
            <span>—</span><span>×</span>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap: 8, marginTop: 10}}>
          <span style={{width: 6, height: 6, borderRadius: '50%', background:'var(--crimson)'}}/>
          <span style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--paper)'}}>LIVE · 00:23:14</span>
          <span style={{marginLeft:'auto', fontFamily:'var(--mono)', fontSize: 10, color:'rgba(244,241,234,0.55)'}}>Acme · M2</span>
        </div>
      </div>

      {/* Query input */}
      <div style={{padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
          padding:'8px 10px', borderRadius: 3,
          display:'flex', alignItems:'center', gap: 8,
        }}>
          <span style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--gold)'}}>›</span>
          <span style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 12, color:'rgba(244,241,234,0.85)', flex: 1}}>
            ask recall…
          </span>
          <span style={{fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.4)', padding:'1px 5px', border:'1px solid rgba(255,255,255,0.15)', borderRadius: 2}}>⌘K</span>
        </div>
      </div>

      {/* Recall feed */}
      <div style={{flex: 1, overflow:'auto', minHeight: 0}}>
        {turns.map((t, i) => <SidebarTurn key={i} t={t} primary={i === 0}/>)}
        {showFallback && (
          <div style={{padding:'14px 14px', borderTop:'1px dashed rgba(255,255,255,0.15)', background:'rgba(200,60,55,0.08)'}}>
            <div style={{display:'flex', alignItems:'center', gap: 6, marginBottom: 6}}>
              <span style={{width: 6, height: 6, borderRadius:'50%', background:'var(--crimson)'}}/>
              <span style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'var(--paper)', letterSpacing:'0.1em', textTransform:'uppercase'}}>No-anchor · honest decline</span>
            </div>
            <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 12, color:'rgba(244,241,234,0.85)', marginBottom: 6}}>
              "{window.NO_ANCHOR_QUERY.query}"
            </div>
            <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'rgba(244,241,234,0.55)', marginBottom: 8, lineHeight: 1.5}}>
              {window.NO_ANCHOR_QUERY.reason}
            </div>
            <div style={{padding:'7px 9px', background:'rgba(255,255,255,0.08)', fontFamily:'var(--serif)', fontSize: 11.5, color:'var(--paper)', fontStyle: 'italic', borderLeft: '2px solid var(--gold)'}}>
              Commit a 24h memo — send by tomorrow 5pm.
            </div>
          </div>
        )}
      </div>

      {/* Footer — latency budget */}
      <div style={{padding:'8px 14px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.5)'}}>
        <span>1.07TB · synced</span>
        <span>{turns.length} turn{turns.length>1?'s':''} · same precedent</span>
      </div>
    </div>
  );
}

const CGS_TERMS = [
  'Strategy Wheel',
  'Dominant Logic Inertia',
  'Structural Inertia',
  'External Sensing',
  'Internal Sensing',
  'Strategy Formulation',
  'Strategic Transformation Concept',
  'Strategic Transformation',
  'Strategic Innovation',
  'Strategy Governance & Communications',
];

function highlightCgsTerms(text) {
  if (!text) return text;
  const pattern = new RegExp('(' + CGS_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  const parts = text.split(pattern);
  return parts.map((p, i) => {
    if (CGS_TERMS.includes(p)) {
      return (
        <span key={i} style={{
          color:'var(--gold)',
          borderBottom:'1px dotted rgba(212,165,75,0.6)',
          padding:'0 1px',
        }}>{p}</span>
      );
    }
    return p;
  });
}

function SidebarTurn({ t, primary }) {
  const dim = window.CGS_DIMENSIONS.find(d => d.id === t.card.dim);
  return (
    <div style={{padding:'14px 14px', borderTop: primary ? 'none' : '1px solid rgba(255,255,255,0.08)'}}>
      {/* Query line */}
      <div style={{display:'flex', alignItems:'flex-start', gap: 8, marginBottom: 10}}>
        <span style={{fontFamily:'var(--mono)', fontSize: 9, color:'var(--gold)', marginTop: 2}}>›</span>
        <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 11.5, color:'rgba(244,241,234,0.75)', flex: 1, lineHeight: 1.4}}>
          {t.query}
        </div>
      </div>

      {/* Card */}
      <div style={{background:'rgba(255,255,255,0.05)', borderLeft:'2px solid var(--gold)', padding:'10px 12px'}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 4}}>
          <div style={{fontFamily:'var(--serif)', fontSize: 14, fontWeight: 500, color:'var(--paper)'}}>
            {t.card.client}
          </div>
          <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'rgba(244,241,234,0.5)'}}>
            {t.card.year} · {dim.abbr}
          </div>
        </div>
        <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 11.5, color:'rgba(244,241,234,0.9)', marginBottom: 10, lineHeight: 1.45}}>
          {t.card.one_liner}
        </div>

        <div style={{fontFamily:'var(--mono)', fontSize: 8.5, color:'rgba(244,241,234,0.45)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 3}}>
          corpus
        </div>
        <div style={{fontFamily:'var(--serif)', fontSize: 11, color:'rgba(244,241,234,0.75)', fontStyle:'italic', marginBottom: 10, lineHeight: 1.5, paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.15)'}}>
          "{highlightCgsTerms(t.card.quote)}"
        </div>

        <div style={{fontFamily:'var(--mono)', fontSize: 8.5, color:'var(--gold)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 3}}>
          fellow rewrite · say this
        </div>
        <div style={{fontFamily:'var(--serif)', fontSize: 12, color:'var(--paper)', lineHeight: 1.5, marginBottom: 10}}>
          {highlightCgsTerms(t.card.fellow_rewrite)}
        </div>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.45)', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)'}}>
          <span style={{textDecoration:'underline', cursor:'pointer', color:'rgba(244,241,234,0.65)'}}>
            {t.card.source_id} ↗
          </span>
          <span>↲ {t.latency}</span>
        </div>
      </div>
    </div>
  );
}

// Meeting notes area — what the Fellow sees on the LEFT side of the laptop
function MeetingNotesArea({ liveLine }) {
  return (
    <div style={{flex: 1, background:'#fff', padding: '0', display:'flex', flexDirection:'column', minHeight: 0}}>
      {/* Google Docs-ish toolbar */}
      <div style={{height: 30, borderBottom:'1px solid #e6e6e6', display:'flex', alignItems:'center', padding:'0 12px', gap: 10, background:'#f8f9fa', flexShrink: 0}}>
        <div style={{display:'flex', gap: 4}}>
          <div style={{width: 10, height: 10, borderRadius:'50%', background:'#EA4335'}}/>
          <div style={{width: 10, height: 10, borderRadius:'50%', background:'#FBBC04'}}/>
          <div style={{width: 10, height: 10, borderRadius:'50%', background:'#34A853'}}/>
        </div>
        <div style={{fontFamily:'var(--sans)', fontSize: 11, color:'#5f6368'}}>Acme bi-weekly · shared meeting notes</div>
        <div style={{marginLeft:'auto', display:'flex', gap: 6, alignItems:'center'}}>
          <div style={{width: 18, height: 18, borderRadius:'50%', background:'#E6B38A', fontFamily:'var(--sans)', fontSize: 9, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}>M</div>
          <div style={{width: 18, height: 18, borderRadius:'50%', background:'#8CB4D9', fontFamily:'var(--sans)', fontSize: 9, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}>R</div>
          <div style={{width: 18, height: 18, borderRadius:'50%', background:'#0F1B2D', fontFamily:'var(--sans)', fontSize: 9, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}>D</div>
          <span style={{fontFamily:'var(--mono)', fontSize: 10, color:'#5f6368', marginLeft: 4}}>share</span>
        </div>
      </div>

      {/* Document body */}
      <div style={{flex: 1, overflow:'auto', padding:'40px 80px', fontFamily:'Georgia, serif', color:'#202124', fontSize: 14, lineHeight: 1.7, background:'#fff', minHeight: 0}}>
        <div style={{fontFamily:'"Google Sans", Arial', fontSize: 22, fontWeight: 400, color:'#202124', marginBottom: 6}}>
          Acme Industrial — Bi-weekly #2
        </div>
        <div style={{fontFamily:'Arial', fontSize: 11, color:'#5f6368', marginBottom: 20}}>
          21 Apr 2026 · 10:30–11:30 · Attendees: Halverson, Vega, Lindqvist, Park
        </div>

        <div style={{fontFamily:'"Google Sans", Arial', fontSize: 16, fontWeight: 500, color:'#202124', marginTop: 20, marginBottom: 10}}>Agenda</div>
        <ol style={{margin: '0 0 18px 20px', padding: 0, fontSize: 13.5}}>
          <li style={{marginBottom: 4}}>Q1 transformation KPIs</li>
          <li style={{marginBottom: 4}}>Innovation reporting line — <span style={{background:'#fff3cd', padding:'0 3px'}}>open from M1</span></li>
          <li style={{marginBottom: 4}}>Transformation Office scope</li>
          <li style={{marginBottom: 4}}>Forward look · Meeting 3</li>
        </ol>

        <div style={{fontFamily:'"Google Sans", Arial', fontSize: 16, fontWeight: 500, color:'#202124', marginTop: 20, marginBottom: 10}}>Notes</div>
        <p style={{margin:'0 0 10px'}}>CEO opened with a Q1 review. Margin recovery on track; transformation pace self-described as "on track but not inflecting yet".</p>
        <p style={{margin:'0 0 10px'}}>CFO raised the question of how others have structured the split between run-the-business and change-the-business P&Ls. <span style={{background:'#d2e3fc', padding:'0 3px'}}>D. Park — note taken.</span></p>
        <p style={{margin:'0 0 10px', background:'#fef7e0', padding:'6px 8px', borderLeft:'3px solid #fbbc04'}}>
          <strong>CEO:</strong> "Where should the CDO actually sit? We put her under the COO to drive pace, but I keep hearing that might be backwards."
        </p>

        {liveLine && (
          <p style={{margin:'4px 0 10px', fontFamily:'Arial', fontSize: 12.5, color:'#5f6368', fontStyle:'italic'}}>
            <span style={{display:'inline-block', width: 1, height: 14, background:'#1a73e8', verticalAlign:'middle', marginRight: 4, animation:'blink 1s infinite'}}/>
            D. Park is typing…
          </p>
        )}

        <p style={{margin:'0 0 10px', color:'#5f6368'}}>[next item · Transformation Office scope]</p>
      </div>

      {/* Status bar at bottom */}
      <div style={{height: 22, background:'#f8f9fa', borderTop:'1px solid #e6e6e6', display:'flex', alignItems:'center', padding:'0 12px', gap: 14, fontFamily:'Arial', fontSize: 10, color:'#5f6368', flexShrink: 0}}>
        <span>All changes saved in Drive</span>
        <span style={{marginLeft:'auto'}}>3 editing · 128 words</span>
      </div>
    </div>
  );
}

// Laptop-scale composition — simulates Fellow's laptop DURING a client meeting.
// Shows: macOS menu bar (context) + Zoom + shared doc + Recall sidecar floating on top-right.
// Emphasis: this is NOT inside Workbench — it's a summoned overlay over whatever app Fellow is in.
function MeetingLaptopView({ turnIdx = 0, showFallback = false, collapsed = false, summoning = false }) {
  return (
    <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#1a1a1a', overflow:'hidden'}}>
      {/* macOS menu bar */}
      <div style={{height: 24, background:'rgba(30,30,30,0.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid #000', display:'flex', alignItems:'center', padding:'0 10px', gap: 16, flexShrink: 0, color:'#e8e8e8', fontFamily:'-apple-system, SF Pro Text, sans-serif', fontSize: 12}}>
        <span style={{width: 13, height: 13, display:'inline-block', border:'1.2px solid #e8e8e8', borderRadius:'50%', position:'relative'}}>
          <span style={{position:'absolute', inset: 2, border:'1.2px solid #e8e8e8', borderTop:'none', borderRight:'none', borderRadius:'50%', transform:'rotate(-30deg)'}}/>
        </span>
        <span style={{fontWeight: 600}}>Google Chrome</span>
        <span>File</span><span>Edit</span><span>View</span><span>History</span><span>Bookmarks</span><span>Window</span>
        <span style={{marginLeft:'auto', display:'flex', gap: 14, fontSize: 11.5, alignItems:'center'}}>
          {/* Recall menu-bar icon — subtle indication of the always-on agent */}
          <span style={{display:'flex', alignItems:'center', gap: 4, padding:'1px 6px', border: summoning ? '1px solid var(--gold)' : '1px solid transparent', borderRadius: 3, background: summoning ? 'rgba(212,165,75,0.15)' : 'transparent'}}>
            <span style={{width: 5, height: 5, borderRadius:'50%', background:'var(--crimson)'}}/>
            <span style={{fontFamily:'var(--mono)', fontSize: 10, letterSpacing:'0.06em'}}>CGS</span>
          </span>
          <span style={{fontFamily:'var(--mono)', fontSize: 10}}>⌘K</span>
          <span>100%</span>
          <span>Tue 21 Apr · 10:47</span>
          <span>D. Park</span>
        </span>
      </div>

      {/* Desktop area */}
      <div style={{flex: 1, position:'relative', background:'linear-gradient(180deg, #2C3A4F 0%, #1A2434 100%)', display:'flex', minHeight: 0}}>

        {/* Main: Chrome window with shared Google Doc */}
        <ChromeDocWindow liveLine={turnIdx > 0} summoning={summoning}/>

        {/* Zoom self-view — small floating pip */}
        <ZoomPip/>

        {/* Recall sidecar — floats on top-right as an overlay, not docked */}
        {!summoning && (
          <div style={{position:'absolute', top: 16, right: 16, bottom: 16, display:'flex'}}>
            <RecallOverlay turnIdx={turnIdx} showFallback={showFallback} collapsed={collapsed}/>
          </div>
        )}

        {/* Summon transition state */}
        {summoning && <SummonOverlay/>}
      </div>

      {/* macOS dock hint */}
      <div style={{height: 4, background:'#000'}}/>
    </div>
  );
}

function ChromeDocWindow({ liveLine, summoning }) {
  return (
    <div style={{flex: 1, margin: '14px 14px 14px 14px', background:'#fff', borderRadius: 8, boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column', overflow:'hidden', border:'1px solid rgba(0,0,0,0.3)'}}>
      {/* Chrome tab bar */}
      <div style={{height: 34, background:'#DEE1E6', display:'flex', alignItems:'flex-end', padding:'0 8px', gap: 8, flexShrink: 0}}>
        <div style={{display:'flex', gap: 8, alignSelf:'center', marginBottom: 4}}>
          <div style={{width: 11, height: 11, borderRadius:'50%', background:'#FF5F57'}}/>
          <div style={{width: 11, height: 11, borderRadius:'50%', background:'#FEBC2E'}}/>
          <div style={{width: 11, height: 11, borderRadius:'50%', background:'#28C840'}}/>
        </div>
        <div style={{display:'flex', gap: 2, alignItems:'flex-end', marginLeft: 14}}>
          <div style={{padding:'7px 10px 6px 10px', background:'#fff', borderRadius:'8px 8px 0 0', fontFamily:'-apple-system, sans-serif', fontSize: 11, color:'#202124', display:'flex', alignItems:'center', gap: 6, maxWidth: 240}}>
            <div style={{width: 12, height: 12, background:'#1a73e8', borderRadius: 1, flexShrink: 0}}/>
            <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Acme bi-weekly #2 — Docs</span>
            <span style={{color:'#5f6368', fontSize: 12, marginLeft: 4}}>×</span>
          </div>
          <div style={{padding:'6px 10px 5px', fontFamily:'-apple-system, sans-serif', fontSize: 11, color:'#5f6368', opacity: 0.7, whiteSpace:'nowrap'}}>Zoom Meeting</div>
          <div style={{padding:'6px 10px 5px', fontFamily:'-apple-system, sans-serif', fontSize: 11, color:'#5f6368', opacity: 0.7, whiteSpace:'nowrap'}}>Acme · Q1 deck</div>
        </div>
      </div>

      {/* Address bar */}
      <div style={{height: 32, background:'#F1F3F4', borderBottom:'1px solid #dadce0', display:'flex', alignItems:'center', padding:'0 12px', gap: 10, flexShrink: 0, fontFamily:'-apple-system, sans-serif', fontSize: 11, color:'#5f6368'}}>
        <span>←</span><span>→</span><span>⟳</span>
        <div style={{flex: 1, height: 22, background:'#fff', border:'1px solid #dadce0', borderRadius: 12, display:'flex', alignItems:'center', padding:'0 10px', gap: 6}}>
          <span style={{color:'#34A853', fontSize: 10}}>🔒</span>
          <span style={{color:'#202124'}}>docs.google.com</span>
          <span style={{color:'#5f6368'}}>/document/d/1x7k···/edit</span>
        </div>
        <div style={{width: 20, height: 20, borderRadius:'50%', background:'#E6B38A', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize: 10}}>D</div>
      </div>

      {/* Doc content */}
      <div style={{flex: 1, minHeight: 0}}>
        <MeetingNotesArea liveLine={liveLine}/>
      </div>
    </div>
  );
}

function ZoomPip() {
  return (
    <div style={{position:'absolute', bottom: 28, left: 28, width: 200, height: 124, background:'#000', borderRadius: 6, overflow:'hidden', boxShadow:'0 8px 24px rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)'}}>
      {/* Main speaker tile */}
      <div style={{position:'absolute', inset: 0, background:'linear-gradient(135deg, #3A4A5C 0%, #1F2935 100%)', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{width: 48, height: 48, borderRadius:'50%', background:'#4A5568', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'var(--sans)', fontSize: 20, fontWeight: 500}}>MH</div>
      </div>
      <div style={{position:'absolute', top: 6, left: 6, fontFamily:'-apple-system, sans-serif', fontSize: 10, color:'#fff', background:'rgba(0,0,0,0.5)', padding:'1px 6px', borderRadius: 2}}>M. Halverson · CEO</div>
      <div style={{position:'absolute', bottom: 6, right: 6, width: 4, height: 4, borderRadius:'50%', background:'#E53E3E', boxShadow:'0 0 4px #E53E3E'}}/>
      {/* Self-view thumbnail */}
      <div style={{position:'absolute', bottom: 6, left: 6, width: 40, height: 26, background:'#1A2434', border:'1px solid rgba(255,255,255,0.2)', borderRadius: 2, display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{width: 12, height: 12, borderRadius:'50%', background:'#0F1B2D', color:'#fff', fontSize: 7, display:'flex', alignItems:'center', justifyContent:'center'}}>D</div>
      </div>
    </div>
  );
}

// The recall panel, floating as an overlay on top of Chrome — not docked to a window
function RecallOverlay({ turnIdx, showFallback, collapsed }) {
  if (collapsed) {
    return (
      <div style={{
        width: 42, height: 'auto', alignSelf:'flex-start',
        background: 'rgba(15,27,45,0.95)',
        backdropFilter:'blur(20px)',
        borderRadius: 8,
        border:'1px solid rgba(255,255,255,0.1)',
        boxShadow:'0 12px 40px rgba(0,0,0,0.5)',
        display:'flex', flexDirection:'column', alignItems:'center',
        padding: '10px 0', gap: 10,
      }}>
        <div style={{width: 16, height: 16, border: '1.3px solid var(--paper)', borderRadius: '50%', position:'relative'}}>
          <div style={{position:'absolute', inset: 2, border:'1.3px solid var(--paper)', borderRadius:'50%', borderColor:'var(--paper) transparent transparent var(--paper)', transform:'rotate(-30deg)'}}/>
        </div>
        <div style={{writingMode:'vertical-rl', transform:'rotate(180deg)', fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.5)', letterSpacing:'0.2em'}}>RECALL</div>
        <div style={{width: 6, height: 6, borderRadius:'50%', background:'var(--crimson)'}}/>
      </div>
    );
  }
  return (
    <div style={{
      width: 360, height: '100%', alignSelf:'stretch',
      background: 'rgba(15,27,45,0.96)',
      backdropFilter:'blur(24px)',
      color: 'var(--paper)',
      borderRadius: 8,
      border:'1px solid rgba(255,255,255,0.08)',
      boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      overflow:'hidden',
    }}>
      <RecallChrome/>
      <RecallQueryBox/>
      <RecallFeed turnIdx={turnIdx} showFallback={showFallback}/>
      <RecallFooter turns={Math.min(turnIdx+1, 3)}/>
    </div>
  );
}

function RecallChrome() {
  return (
    <div style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
      <div style={{padding:'14px 16px 12px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'rgba(244,241,234,0.55)', letterSpacing:'0.18em'}}>CGS · RECALL · FELLOW ONLY</div>
          <div style={{display:'flex', gap: 8, fontFamily:'var(--mono)', fontSize: 10, color:'rgba(244,241,234,0.4)'}}>
            <span>⇩</span><span>−</span><span>×</span>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap: 8, marginTop: 10}}>
          <span style={{width: 6, height: 6, borderRadius: '50%', background:'var(--crimson)'}}/>
          <span style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--paper)'}}>LIVE · 00:23:14</span>
          <span style={{marginLeft:'auto', fontFamily:'var(--mono)', fontSize: 10, color:'rgba(244,241,234,0.55)'}}>Acme · M2</span>
        </div>
      </div>
      <CorpusPanorama/>
    </div>
  );
}

function CorpusPanorama() {
  const items = [
    { k: '18,432', u: 'files' },
    { k: '2008–26', u: '18 yr' },
    { k: '214',    u: 'projects' },
    { k: '7',      u: 'frameworks' },
  ];
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'repeat(4, 1fr)',
      padding:'8px 12px',
      background:'rgba(0,0,0,0.25)',
      borderTop:'1px solid rgba(255,255,255,0.05)',
      fontFamily:'var(--mono)',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          textAlign:'center',
          borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{fontSize: 11, color:'var(--gold)', fontWeight: 500}}>{it.k}</div>
          <div style={{fontSize: 8.5, color:'rgba(244,241,234,0.5)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop: 1}}>{it.u}</div>
        </div>
      ))}
    </div>
  );
}

function RecallQueryBox() {
  return (
    <div style={{padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
      <div style={{
        background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
        padding:'8px 10px', borderRadius: 3,
        display:'flex', alignItems:'center', gap: 8,
      }}>
        <span style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--gold)'}}>›</span>
        <span style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 12, color:'rgba(244,241,234,0.85)', flex: 1}}>
          ask recall…
        </span>
        <span style={{fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.4)', padding:'1px 5px', border:'1px solid rgba(255,255,255,0.15)', borderRadius: 2}}>⌘K</span>
      </div>
    </div>
  );
}

function RecallFeed({ turnIdx, showFallback }) {
  const turns = window.RECALL_TURNS.slice(0, turnIdx + 1);
  return (
    <div style={{flex: 1, overflow:'auto', minHeight: 0}}>
      {turns.map((t, i) => <SidebarTurn key={i} t={t} primary={i === 0}/>)}
      {showFallback && (
        <div style={{padding:'14px 14px', borderTop:'1px dashed rgba(255,255,255,0.15)', background:'rgba(200,60,55,0.08)'}}>
          <div style={{display:'flex', alignItems:'center', gap: 6, marginBottom: 6}}>
            <span style={{width: 6, height: 6, borderRadius:'50%', background:'var(--crimson)'}}/>
            <span style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'var(--paper)', letterSpacing:'0.1em', textTransform:'uppercase'}}>No-anchor · honest decline</span>
          </div>
          <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 12, color:'rgba(244,241,234,0.85)', marginBottom: 6}}>
            "{window.NO_ANCHOR_QUERY.query}"
          </div>
          <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'rgba(244,241,234,0.55)', marginBottom: 8, lineHeight: 1.5}}>
            {window.NO_ANCHOR_QUERY.reason}
          </div>
          <div style={{padding:'7px 9px', background:'rgba(255,255,255,0.08)', fontFamily:'var(--serif)', fontSize: 11.5, color:'var(--paper)', fontStyle: 'italic', borderLeft: '2px solid var(--gold)'}}>
            Commit a 24h memo — send by tomorrow 5pm.
          </div>
        </div>
      )}
    </div>
  );
}

function RecallFooter({ turns }) {
  return (
    <div style={{padding:'8px 14px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.5)'}}>
      <span>1.07TB · synced</span>
      <span>{turns} turn{turns>1?'s':''} · same precedent</span>
    </div>
  );
}

// Summon transition — shows the moment ⌘K is pressed: sidebar slides in from right, centered scrim with keyboard hint
function SummonOverlay() {
  return (
    <div style={{position:'absolute', inset: 0, pointerEvents:'none'}}>
      {/* dim scrim */}
      <div style={{position:'absolute', inset: 0, background:'rgba(0,0,0,0.08)'}}/>

      {/* keyboard hint in center */}
      <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', background:'rgba(15,27,45,0.92)', backdropFilter:'blur(20px)', padding:'20px 26px', borderRadius: 10, boxShadow:'0 24px 60px rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.08)', color:'var(--paper)', display:'flex', alignItems:'center', gap: 14}}>
        <div style={{display:'flex', gap: 4}}>
          <span style={{fontFamily:'var(--mono)', fontSize: 14, padding:'6px 10px', background:'rgba(255,255,255,0.1)', borderRadius: 4, border:'1px solid rgba(255,255,255,0.15)'}}>⌘</span>
          <span style={{fontFamily:'var(--mono)', fontSize: 14, padding:'6px 10px', background:'rgba(255,255,255,0.1)', borderRadius: 4, border:'1px solid rgba(255,255,255,0.15)'}}>K</span>
        </div>
        <div>
          <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 500}}>Summoning recall…</div>
        </div>
      </div>

      {/* sliding sidebar preview (half-in) */}
      <div style={{position:'absolute', top: 16, bottom: 16, right: -80, width: 360, background:'rgba(15,27,45,0.8)', backdropFilter:'blur(24px)', borderRadius: 8, border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', opacity: 0.6}}/>
    </div>
  );
}

Object.assign(window, { RecallSidebar, MeetingLaptopView });
