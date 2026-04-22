// NewArtboards.jsx — additions per architecture.md / tech-design.md / UI review.
// Sketches that convey intent; designer welcome to polish.
//
// Five components:
//   · TauriPanelChrome           — wraps content as floating Tauri panel on simulated stage
//   · MeetingSplitMain           — main window in "meeting state" (architecture §2.1)
//   · OverrideStreamingFragment  — Override mid-streaming (tech-design §4.3)
//   · RecallAutocompleteOverlay  — autocomplete dropdown open (tech-design §2.2)
//   · DashboardLoadingState      — 30s context-load timer + panel placeholders (tech-design §2.5)

// Inline keyframes (avoids touching styles.css)
function ArtboardKeyframes() {
  return (
    <style>{`
      @keyframes shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      @keyframes blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
    `}</style>
  );
}

// ─────────────────────────────────────────────────────────────
// TauriPanelChrome — frame for Recall as standalone OS-level
// floating window. Simulates Mac stage so vibrancy reads visually.
// ─────────────────────────────────────────────────────────────
function TauriPanelChrome({ children, panelWidth = 360, panelHeight = 480 }) {
  return (
    <div style={{width:'100%', height:'100%', position:'relative', overflow:'hidden', background:'#0a0d12'}}>
      <ArtboardKeyframes/>

      {/* stage — simulated meeting context blurred behind */}
      <div style={{
        position:'absolute', inset: 0,
        background: 'linear-gradient(135deg, #1c2530 0%, #2a3340 40%, #0f1620 100%)',
      }}/>
      {/* simulated participant tile */}
      <div style={{
        position:'absolute', top: 80, left: 60, width: 280, height: 200,
        background: 'radial-gradient(ellipse at 50% 35%, #4a5260 0%, #2a3340 60%)',
        borderRadius: 6, filter: 'blur(8px)', opacity: 0.65,
      }}/>
      {/* simulated shared deck */}
      <div style={{
        position:'absolute', top: 80, right: 60, width: 240, height: 180,
        background: '#e8e2d4', borderRadius: 6, filter: 'blur(8px)', opacity: 0.55,
      }}/>

      {/* macOS menubar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 24,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 16,
        fontFamily: 'var(--sans)', fontSize: 12, color: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <span style={{fontWeight: 700, fontSize: 14}}></span>
        <span style={{fontWeight: 600}}>Zoom</span>
        <span style={{opacity: 0.6}}>File</span>
        <span style={{opacity: 0.6}}>Edit</span>
        <span style={{opacity: 0.6}}>Meeting</span>
        <span style={{marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.85}}>● 23:14 · LIVE · acme-bi-weekly</span>
      </div>

      {/* the floating Recall panel */}
      <div style={{
        position:'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: panelWidth, height: panelHeight,
        background: 'rgba(15, 27, 45, 0.82)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderRadius: 10,
        border: '0.5px solid rgba(255,255,255,0.14)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.08)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* drag handle / mini titlebar (frame: false) */}
        <div style={{
          height: 26, padding: '0 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.18)',
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          cursor: 'grab', flexShrink: 0,
        }}>
          {/* drag affordance */}
          <div style={{display:'flex', flexDirection:'column', gap: 1.5, opacity: 0.45}}>
            <div style={{width: 18, height: 1, background:'rgba(255,255,255,0.7)'}}/>
            <div style={{width: 18, height: 1, background:'rgba(255,255,255,0.7)'}}/>
          </div>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9.5,
            color: 'rgba(244,241,234,0.5)',
            letterSpacing: '0.18em', flex: 1, textAlign: 'center',
          }}>CGS · RECALL</span>
          <span style={{fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(244,241,234,0.45)', cursor: 'pointer'}}>—</span>
          <span style={{fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(244,241,234,0.45)', cursor: 'pointer', marginLeft: 4}}>×</span>
        </div>
        {/* content */}
        <div style={{flex: 1, overflow: 'hidden', display:'flex', flexDirection:'column', minHeight: 0}}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MeetingSplitMain — main window after entering "meeting state".
// Sidebar collapses to icons; main area splits into Fake Zoom + deck.
// Recall floating panel (separate Tauri window) implied by hint arrow.
// ─────────────────────────────────────────────────────────────
function MeetingSplitMain() {
  const navIcons = [
    { l:'§5', active: false },
    { l:'§7', active: false },
    { l:'§2', active: false },
    { l:'§3', active: true },
    { l:'§6', active: false },
  ];
  return (
    <div className="window" style={{width:'100%', height:'100%', background:'var(--ivory)', display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <div className="titlebar">
        <div className="traffic"><span className="c"/><span className="m"/><span className="x"/></div>
        <div className="title">CGS Workbench <span className="dot">·</span> Acme Industrial <span className="dot">·</span> <span style={{color:'#555E6E'}}>Meeting · live</span></div>
        <div className="right">Acme · M2 · Apr 21</div>
      </div>
      <div style={{flex: 1, display: 'grid', gridTemplateColumns: '52px 1fr', minHeight: 0}}>
        {/* collapsed sidebar */}
        <div style={{background: 'var(--paper)', borderRight: '1px solid var(--rule)', display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 0', gap: 14}}>
          <div style={{width: 18, height: 18, border: '1.5px solid var(--navy)', borderRadius: '50%', position:'relative', marginBottom: 6}}>
            <div style={{position:'absolute', inset: 3, border:'1.5px solid var(--navy)', borderRadius:'50%', borderColor:'var(--navy) transparent transparent var(--navy)', transform:'rotate(-30deg)'}}/>
          </div>
          {navIcons.map((n, i) => (
            <div key={i} style={{
              fontFamily:'var(--mono)', fontSize: 10,
              color: n.active ? 'var(--paper)' : 'var(--slate)',
              padding: '6px 8px',
              background: n.active ? 'var(--navy)' : 'transparent',
              borderRadius: 2, letterSpacing: '0.04em', fontWeight: n.active ? 600 : 400,
            }}>{n.l}</div>
          ))}
        </div>
        {/* meeting split */}
        <div style={{background: '#0a0d12', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, position:'relative'}}>
          {/* fake_zoom side */}
          <div style={{position:'relative', background:'#1a1f28', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{width: '78%', aspectRatio: '4/3', background:'#2a3340', borderRadius: 4, position: 'relative', overflow:'hidden'}}>
              <div style={{position:'absolute', inset: 0, background:'radial-gradient(ellipse at 50% 38%, #565d6c 0%, #2a3340 65%)'}}/>
              <div style={{position:'absolute', bottom: '15%', left: '20%', right: '20%', height: '35%', background:'#1c2026', borderRadius: '50% 50% 0 0', filter:'blur(2px)'}}/>
              <div style={{position:'absolute', bottom: 12, left: 12, right: 12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{fontFamily:'var(--sans)', fontSize: 11, color:'rgba(255,255,255,0.92)', background:'rgba(0,0,0,0.6)', padding:'3px 8px', borderRadius: 2, fontWeight: 500}}>M. Halverson · CEO</div>
                <div style={{display:'flex', alignItems:'center', gap: 6, fontFamily:'var(--mono)', fontSize: 10, color:'rgba(255,255,255,0.85)', background:'rgba(0,0,0,0.6)', padding:'3px 7px', borderRadius: 2}}>
                  <span style={{width: 6, height: 6, borderRadius:'50%', background:'#ff3b30'}}/>
                  <span>LIVE 23:14</span>
                </div>
              </div>
            </div>
            <div style={{position:'absolute', top: 14, left: 16, fontFamily:'var(--mono)', fontSize: 10, color:'rgba(255,255,255,0.55)', letterSpacing:'0.12em', textTransform:'uppercase'}}>
              fake_zoom.mp4 · loop
            </div>
          </div>
          {/* shared deck side */}
          <div style={{position:'relative', background:'#f5f1e8', display:'flex', alignItems:'center', justifyContent:'center', padding: 32}}>
            <div style={{position:'absolute', top: 14, left: 16, fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.1em', textTransform:'uppercase'}}>shared_deck.pdf</div>
            <div style={{textAlign:'left', maxWidth: '85%'}}>
              <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom: 14}}>Acme Industrial · Q3 Review</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 26, color:'var(--navy)', lineHeight: 1.2, fontWeight: 400, letterSpacing:'-0.01em', marginBottom: 24}}>Transformation cadence — what we're hearing from the floor</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 13.5, color:'var(--charcoal)', lineHeight: 1.85}}>
                <div>· CDO reporting line under review</div>
                <div>· Digital initiatives drift, Q1–Q3</div>
                <div>· Strategic Innovation under-resourced</div>
              </div>
            </div>
            <div style={{position:'absolute', bottom: 14, right: 16, fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)'}}>4 / 12</div>
          </div>

          {/* hint about Recall floating panel position */}
          <div style={{position:'absolute', top: 40, right: -10, transform:'translateX(100%)', display:'flex', alignItems:'center', gap: 10, opacity: 0.85}}>
            <div style={{width: 24, height: 1, background:'var(--bone)'}}/>
            <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'var(--bone)', letterSpacing:'0.1em', textTransform:'uppercase', whiteSpace:'nowrap'}}>Recall 浮窗 — separate OS window</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OverrideStreamingFragment — focused mid-state of §2 F6 Override.
// Shows: superseded card greyed out + new hypothesis streaming
// + interventions queued.
// ─────────────────────────────────────────────────────────────
function OverrideStreamingFragment() {
  return (
    <div style={{width:'100%', height:'100%', background:'var(--ivory)', padding: '32px 36px', display:'flex', flexDirection:'column', gap: 18, overflow: 'hidden'}}>
      <ArtboardKeyframes/>

      <div className="page-header" style={{margin: 0, paddingBottom: 14}}>
        <div>
          <div className="crumb">§2 · Diagnostic · Override · re-computing</div>
          <h1>Strategic Innovation <em>— now scoring 7</em></h1>
          <div style={{marginTop: 8, display:'flex', gap: 8, alignItems:'center'}}>
            <span className="tag crimson">● override active</span>
            <span className="tag" style={{fontFamily:'var(--mono)'}}>streaming · 12 / ~40 tok</span>
          </div>
        </div>
        <div className="meta" style={{textAlign:'right'}}>
          <div style={{fontFamily:'var(--mono)'}}>regenerating · 4.2s</div>
          <div style={{color:'var(--sage-ink)', fontFamily:'var(--mono)'}}>budget 45s · on track</div>
        </div>
      </div>

      <div className="grid two-col" style={{gap: 18}}>
        {/* old hypothesis — superseded */}
        <div className="card" style={{opacity: 0.45, position:'relative'}}>
          <div className="card-h">
            <div className="t" style={{textDecoration:'line-through'}}>Dominant Logic Inertia</div>
            <span className="tag" style={{fontFamily:'var(--mono)'}}>superseded</span>
          </div>
          <div className="card-b">
            <div style={{fontFamily:'var(--serif)', fontSize: 13.5, color:'var(--ink)', lineHeight: 1.55, textDecoration:'line-through', textDecorationColor:'var(--mist)'}}>
              "Innovation framed as a cost center; CEO speaks in margin-recovery terms only."
            </div>
            <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--mist)', marginTop: 12, letterSpacing:'0.04em'}}>
              ↳ assumed Strategic Innovation = 3 (under-resourced)
            </div>
          </div>
        </div>

        {/* new hypothesis — streaming */}
        <div className="card" style={{borderColor: 'var(--crimson)', borderWidth: 1.5, position:'relative'}}>
          <div className="card-h">
            <div className="t" style={{color:'var(--navy)'}}>New hypothesis <em>— streaming</em></div>
            <span style={{display:'inline-block', width: 8, height: 8, borderRadius:'50%', background:'var(--crimson)', animation:'pulse-dot 1.2s infinite'}}/>
          </div>
          <div className="card-b">
            <div style={{fontFamily:'var(--serif)', fontSize: 13.5, color:'var(--ink)', lineHeight: 1.55}}>
              "Innovation capacity is structurally over-allocated relative to demonstrated"
              <span style={{display:'inline-block', width: 7, height: 14, background:'var(--navy)', marginLeft: 2, verticalAlign:'middle', animation:'blink 1s infinite'}}/>
            </div>
            {/* shimmer placeholder lines */}
            {[88, 76, 60].map((w, i) => (
              <div key={i} style={{
                height: 11, marginTop: 9, borderRadius: 2,
                background: 'linear-gradient(90deg, var(--bone) 0%, var(--rule-2) 50%, var(--bone) 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.6s infinite',
                width: `${w}%`,
              }}/>
            ))}
            <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)', marginTop: 14, letterSpacing:'0.04em'}}>
              ↳ recomputing 2-3 interventions · CGS-2018-GLBX, CGS-2019-INTK …
            </div>
          </div>
        </div>
      </div>

      {/* interventions area — placeholder */}
      <div className="card">
        <div className="card-h">
          <div className="t">Interventions <em>— awaiting new hypothesis</em></div>
          <span className="tag" style={{fontFamily:'var(--mono)'}}>queued</span>
        </div>
        <div className="card-b" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 12}}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              padding:'14px 14px', border:'1px dashed var(--rule)', borderRadius: 2,
              background:'rgba(15,27,45,0.02)',
            }}>
              <div style={{height: 10, width: '60%', background:'var(--rule-2)', borderRadius: 2, marginBottom: 8}}/>
              <div style={{height: 7, width: '95%', background:'var(--bone)', borderRadius: 2, marginBottom: 4}}/>
              <div style={{height: 7, width: '78%', background:'var(--bone)', borderRadius: 2}}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RecallAutocompleteOverlay — Recall panel with autocomplete
// dropdown open. Used inside TauriPanelChrome.
// ─────────────────────────────────────────────────────────────
function RecallAutocompleteOverlay() {
  const queries = [
    { q: 'how did Globex handle CDO reporting line?', match: true },
    { q: 'how to balance run vs change at scale?', match: false },
    { q: 'how does Initech sequence ops & strategy?', match: false },
  ];
  return (
    <div style={{
      width: '100%', height: '100%',
      color: 'var(--paper)',
      display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      <ArtboardKeyframes/>

      {/* mini header (matches RecallSidebar header) */}
      <div style={{padding:'14px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink: 0}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'rgba(244,241,234,0.55)', letterSpacing:'0.18em'}}>CGS · RECALL · FELLOW ONLY</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap: 8, marginTop: 10}}>
          <span style={{width: 6, height: 6, borderRadius: '50%', background:'var(--crimson)'}}/>
          <span style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--paper)'}}>LIVE · 00:23:14</span>
          <span style={{marginLeft:'auto', fontFamily:'var(--mono)', fontSize: 10, color:'rgba(244,241,234,0.55)'}}>Acme · M2</span>
        </div>
      </div>

      {/* query input + dropdown */}
      <div style={{padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink: 0}}>
        <div style={{
          background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.22)',
          padding:'8px 10px', borderRadius: 3,
          display:'flex', alignItems:'center', gap: 8,
        }}>
          <span style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--gold)'}}>›</span>
          <span style={{fontFamily:'var(--serif)', fontSize: 12.5, color:'var(--paper)', flex: 1}}>
            how<span style={{display:'inline-block', width: 1.5, height: 13, background:'var(--paper)', verticalAlign:'middle', marginLeft: 1, animation:'blink 1s infinite'}}/>
          </span>
          <span style={{fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.4)', padding:'1px 5px', border:'1px solid rgba(255,255,255,0.15)', borderRadius: 2}}>⌘K</span>
        </div>

        {/* autocomplete dropdown */}
        <div style={{
          marginTop: 4,
          background:'rgba(255,255,255,0.06)',
          border:'1px solid rgba(255,255,255,0.14)',
          borderRadius: 3, padding: '4px 0',
          fontFamily:'var(--serif)', fontSize: 12, color:'var(--paper)',
        }}>
          {queries.map((q, i) => (
            <div key={i} style={{
              padding: '7px 12px',
              display:'flex', alignItems:'center', gap: 8,
              background: q.match ? 'rgba(120,160,110,0.18)' : 'transparent',
              borderLeft: q.match ? '2px solid var(--sage)' : '2px solid transparent',
            }}>
              <span style={{fontFamily:'var(--mono)', fontSize: 10, color: q.match ? 'var(--gold)' : 'rgba(244,241,234,0.4)'}}>↳</span>
              <span style={{flex: 1, color: q.match ? 'var(--paper)' : 'rgba(244,241,234,0.7)'}}>{q.q}</span>
            </div>
          ))}
          <div style={{borderTop: '1px solid rgba(255,255,255,0.08)', padding: '7px 12px', fontFamily:'var(--mono)', fontSize: 9.5, color:'rgba(244,241,234,0.5)', letterSpacing:'0.04em'}}>
            no further match · ⏎ to query freely (runtime OpenAI embedding)
          </div>
        </div>

        {/* keyboard hints */}
        <div style={{
          marginTop: 8, padding: '0 4px',
          display:'flex', justifyContent:'flex-end', gap: 14,
          fontFamily:'var(--mono)', fontSize: 9, color:'rgba(244,241,234,0.4)',
          letterSpacing:'0.04em',
        }}>
          <span>↑↓ select</span>
          <span>⏎ go</span>
          <span>⇥ complete</span>
          <span>esc dismiss</span>
        </div>
      </div>

      {/* placeholder feed area below */}
      <div style={{flex: 1, padding: 16, fontFamily:'var(--mono)', fontSize: 10, color:'rgba(244,241,234,0.3)', letterSpacing:'0.06em', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center'}}>
        — feed appears after query —
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DashboardLoadingState — Dashboard with 30s context-load timer
// in corner + progressive panel fade-in (some loaded, some pending).
// Per tech-design.md §2.5.
// ─────────────────────────────────────────────────────────────
function DashboardLoadingState() {
  return (
    <div className="window" style={{width:'100%', height:'100%', background:'var(--ivory)', display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <ArtboardKeyframes/>
      <div className="titlebar">
        <div className="traffic"><span className="c"/><span className="m"/><span className="x"/></div>
        <div className="title">CGS Workbench <span className="dot">·</span> Acme Industrial <span className="dot">·</span> <span style={{color:'#555E6E'}}>cgs-advisors.local</span></div>
        <div className="right">Acme · M2 · Apr 21</div>
      </div>
      <div style={{flex: 1, position:'relative', overflow:'hidden'}}>

        {/* timer overlay — fixed top-right */}
        <div style={{
          position:'absolute', top: 24, right: 28, zIndex: 20,
          background:'var(--paper)', border:'1px solid var(--rule)', borderRadius: 3,
          padding:'12px 16px', minWidth: 144,
          boxShadow:'var(--shadow-md)',
        }}>
          <div style={{fontFamily:'var(--mono)', fontSize: 24, color:'var(--navy)', letterSpacing:'0.02em', lineHeight: 1, fontWeight: 500}}>
            0:23
          </div>
          <div style={{fontFamily:'var(--mono)', fontSize: 9.5, color:'var(--slate)', letterSpacing:'0.06em', textTransform:'uppercase', marginTop: 5}}>
            context loading…
          </div>
          <div style={{height: 2, background:'var(--rule-2)', marginTop: 10, position:'relative', borderRadius: 1, overflow: 'hidden'}}>
            <div style={{position:'absolute', left: 0, top: 0, bottom: 0, width: '76%', background:'var(--sage)'}}/>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize: 9, color:'var(--mist)', marginTop: 4}}>
            <span>0s</span><span>30s budget</span>
          </div>
        </div>

        {/* dashboard content — some loaded, some loading, some queued */}
        <div style={{padding:'24px 28px', display:'flex', flexDirection:'column', gap: 18, paddingRight: 200}}>
          {/* loaded — client identity */}
          <div className="card">
            <div className="card-h">
              <div className="t">Acme Industrial <em>— Pre-RFP · 247-day relationship</em></div>
              <span className="tag sage">✓ loaded · 4.8s</span>
            </div>
            <div className="card-b" style={{padding:'14px 18px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 14, fontSize: 12.5}}>
              <div><div className="foot">Industry</div><div style={{fontFamily:'var(--serif)', color:'var(--ink)'}}>Industrial mfg</div></div>
              <div><div className="foot">HQ</div><div style={{fontFamily:'var(--serif)', color:'var(--ink)'}}>Boston, MA</div></div>
              <div><div className="foot">Engagement</div><div style={{fontFamily:'var(--serif)', color:'var(--ink)'}}>Pre-RFP</div></div>
              <div><div className="foot">Last touch</div><div style={{fontFamily:'var(--serif)', color:'var(--ink)'}}>Apr 19</div></div>
            </div>
          </div>

          {/* loaded — relationship stage */}
          <div className="card">
            <div className="card-h">
              <div className="t">Relationship stage</div>
              <span className="tag sage">✓ loaded · 11.2s</span>
            </div>
            <div className="card-b" style={{padding:'18px'}}>
              <div className="placeholder" style={{minHeight: 50, background:'var(--paper)', border:'none', color:'var(--charcoal)'}}>
                Signal → Pre-RFP → Retainer → Active Delivery → Renewal
              </div>
            </div>
          </div>

          {/* loading — timeline */}
          <div className="card" style={{opacity: 0.55}}>
            <div className="card-h">
              <div className="t">Interaction timeline</div>
              <span className="tag" style={{fontFamily:'var(--mono)'}}>loading · 18s</span>
            </div>
            <div className="card-b" style={{padding: 0}}>
              {[0,1,2].map(i => (
                <div key={i} style={{padding:'14px 18px', borderTop: i ? '1px solid var(--rule-2)' : 'none', display:'flex', gap: 12, alignItems:'center'}}>
                  <div style={{
                    height: 11, width: 38, borderRadius: 2,
                    background:'linear-gradient(90deg, var(--bone) 0%, var(--rule-2) 50%, var(--bone) 100%)',
                    backgroundSize:'200% 100%', animation:'shimmer 1.6s infinite',
                  }}/>
                  <div style={{flex: 1, height: 11, borderRadius: 2, background:'linear-gradient(90deg, var(--bone) 0%, var(--rule-2) 50%, var(--bone) 100%)', backgroundSize:'200% 100%', animation:'shimmer 1.6s infinite'}}/>
                </div>
              ))}
            </div>
          </div>

          {/* queued — AI alerts + external signals */}
          {['AI alerts', 'External signals'].map((label, i) => (
            <div key={i} className="card" style={{opacity: 0.3}}>
              <div className="card-h">
                <div className="t">{label}</div>
                <span className="tag" style={{fontFamily:'var(--mono)'}}>queued · {[23, 28][i]}s</span>
              </div>
              <div className="card-b">
                <div className="placeholder" style={{minHeight: 30}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  TauriPanelChrome,
  MeetingSplitMain,
  OverrideStreamingFragment,
  RecallAutocompleteOverlay,
  DashboardLoadingState,
});
