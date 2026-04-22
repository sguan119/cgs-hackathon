// S3 Meeting Recall — static, prop-driven.

function PreReadPage() {
  const pr = window.PRE_READ;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="crumb">S3 · Layer 1 · Pre-Read Archivist</div>
          <h1>Meeting brief <em>— Acme Industrial bi-weekly</em></h1>
          <div style={{marginTop: 8, display:'flex', gap: 8, flexWrap:'wrap'}}>
            <span className="tag">{pr.meeting}</span>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 10}}>
          <div className="meta">{pr.attendees.map(a => <div key={a}>{a}</div>)}</div>
          <div className="actions">
            <button className="btn primary">Print for meeting</button>
          </div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1.5fr 1fr', gap: 24}}>
        <div className="card">
          <div className="card-h">
            <div className="t">Predicted analogical questions</div>
            <span className="tag sage">5</span>
          </div>
          <div className="card-b" style={{padding: 0}}>
            {pr.predicted.map((p, i) => (
              <div key={i} style={{padding:'16px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--rule-2)'}}>
                <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap: 14}}>
                  <div style={{fontFamily:'var(--serif)', fontSize: 15, color:'var(--navy)', lineHeight: 1.4, flex: 1}}>
                    <span style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--mist)', marginRight: 10}}>Q{i+1}</span>
                    {p.q}
                  </div>
                  <span className="tag" style={{flexShrink: 0}}>{window.CGS_DIMENSIONS.find(d => d.id === p.dim).abbr}</span>
                </div>
                <div style={{display:'flex', alignItems:'center', gap: 10, marginTop: 10, paddingLeft: 34}}>
                  <span style={{width: 18, height: 1, background:'var(--rule)'}}/>
                  <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 13, color:'var(--ink)'}}>{p.anchor}</div>
                </div>
                <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--slate)', paddingLeft: 34, marginTop: 6}}>
                  ↳ ingredient · {p.src}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: 18}}>
          <div className="card">
            <div className="card-h">
              <div className="t">Carried from last meeting</div>
              <span className="tag crimson">open</span>
            </div>
            <div className="card-b">
              {pr.unsolved.map((u, i) => (
                <div key={i} style={{display:'flex', gap: 8, fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink)', padding: '7px 0', borderTop: i === 0 ? 'none' : '1px solid var(--rule-2)', lineHeight: 1.5}}>
                  <span style={{color:'var(--crimson)'}}>◆</span><span>{u}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Client posture <em>— as of today</em></div>
              <span className="tag">synthesized</span>
            </div>
            <div className="card-b">
              <div style={{display:'grid', gridTemplateColumns:'120px 1fr', rowGap: 10, fontSize: 12.5}}>
                <div className="foot">Dominant logic</div>
                <div style={{fontFamily:'var(--serif)', color:'var(--ink)'}}>Transformation = cost program</div>
                <div className="foot">Stated priority</div>
                <div style={{fontFamily:'var(--serif)', color:'var(--ink)'}}>Execution pace, margin recovery</div>
                <div className="foot">Latent tension</div>
                <div style={{fontFamily:'var(--serif)', color:'var(--crimson-ink)', fontStyle:'italic'}}>Innovation capacity drifting</div>
                <div className="foot">Inverted pyramid</div>
                <div style={{fontFamily:'var(--serif)', color:'var(--ink)'}}>CEO ↔ Fellow, 1:1</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function MiniRow({ k, v, tone }) {
  const c = tone === 'navy' ? 'var(--navy)' : tone === 'crimson' ? 'var(--crimson-ink)' : 'var(--slate)';
  return (
    <div style={{borderLeft: `2px solid ${c}`, padding:'4px 12px'}}>
      <div style={{fontFamily:'var(--mono)', fontSize:10, color: c, letterSpacing:'0.06em', textTransform:'uppercase'}}>{k}</div>
      <div style={{fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink)', marginTop: 2, lineHeight: 1.4}}>{v}</div>
    </div>
  );
}

function RecallTurn({ t, primary }) {
  return (
    <div style={{padding:'16px 20px', borderTop: primary ? 'none' : '1px solid var(--rule-2)'}}>
      <div style={{display:'flex', alignItems:'baseline', gap: 10, marginBottom: 10}}>
        <span className="tag" style={{background:'var(--navy)', color:'var(--paper)', border:'none', fontFamily:'var(--mono)'}}>↳ query</span>
        <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize: 13, color:'var(--charcoal)', flex: 1}}>“{t.query}”</div>
        <div style={{fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--sage-ink)'}}>↲ {t.latency}</div>
      </div>
      <div style={{padding:'14px 16px', background:'var(--paper)', border:'1px solid var(--rule)', borderLeft:'3px solid var(--navy)'}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap: 12, marginBottom: 4}}>
          <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 500, color:'var(--navy)'}}>
            {t.card.client} <span style={{color:'var(--slate)', fontWeight: 400}}>· {t.card.year}</span>
          </div>
          <span className="tag">{window.CGS_DIMENSIONS.find(d => d.id === t.card.dim).abbr}</span>
        </div>
        <div style={{fontFamily:'var(--serif)', fontSize: 13.5, color:'var(--ink)', fontStyle:'italic', marginBottom: 12}}>{t.card.one_liner}</div>
        <div style={{display:'grid', gridTemplateColumns:'90px 1fr', gap: 10, fontSize: 12.5, padding: '8px 10px', background: 'var(--ivory)', borderRadius: 2, marginBottom: 8}}>
          <div className="foot">Corpus</div>
          <div style={{fontFamily:'var(--serif)', fontStyle:'italic', color:'var(--charcoal)'}}>{t.card.quote}</div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'90px 1fr', gap: 10, fontSize: 12.5, padding: '8px 10px', background: 'rgba(88, 124, 82, 0.06)', borderLeft:'2px solid var(--sage)', borderRadius: 2}}>
          <div className="foot" style={{color:'var(--sage-ink)'}}>Fellow rewrite</div>
          <div style={{fontFamily:'var(--serif)', color:'var(--navy)'}}>{t.card.fellow_rewrite}</div>
        </div>
        <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.04em', marginTop: 10, display:'flex', gap: 12}}>
          <span>source · {t.card.source_id}</span>
          <span style={{color:'var(--mist)'}}>·</span>
          <span style={{color:'var(--navy)', textDecoration:'underline'}}>open in Drive ↗</span>
        </div>
      </div>
    </div>
  );
}

function LaptopDiagram() {
  return (
    <div style={{display:'flex', justifyContent:'center', padding: '6px 0'}}>
      <svg viewBox="0 0 520 270" width="100%" style={{maxWidth: 520}}>
        <rect x="80" y="30" width="360" height="200" rx="6" fill="var(--navy)" stroke="var(--charcoal)"/>
        <rect x="90" y="40" width="340" height="180" fill="var(--ivory)"/>
        <rect x="96" y="46" width="232" height="168" fill="var(--paper)" stroke="var(--rule)" strokeWidth="0.5"/>
        <text x="212" y="60" textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--slate)" letterSpacing="0.08em">MEETING NOTES · CLIENT-SHARED</text>
        {[70,78,86,94,102,110,118,126,134,142,150,158,166,174,182,190,198].map(y => (
          <rect key={y} x="102" y={y} width={180 - ((y*3)%40)} height="2" fill="var(--rule)"/>
        ))}
        <rect x="332" y="46" width="92" height="168" fill="var(--navy)" stroke="var(--navy-2)"/>
        <text x="378" y="58" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--paper)" letterSpacing="0.12em">RECALL · FELLOW ONLY</text>
        <rect x="338" y="68" width="80" height="38" fill="rgba(255,255,255,0.08)" stroke="var(--gold)" strokeWidth="0.5"/>
        <text x="378" y="82" textAnchor="middle" fontFamily="var(--serif)" fontSize="8" fill="var(--paper)">Globex 2018</text>
        <text x="378" y="94" textAnchor="middle" fontFamily="var(--serif)" fontSize="7" fontStyle="italic" fill="rgba(244,241,234,0.7)">CDO → CEO move</text>
        {[116,122,128,134,140,146,152,158,164,170,176,182,188,194,200].map(y => (
          <rect key={y} x="340" y={y} width={Math.min(74, 60 + (y%20))} height="1.2" fill="rgba(244,241,234,0.25)"/>
        ))}
        <polygon points="70,230 450,230 470,248 50,248" fill="var(--charcoal)"/>
        <rect x="240" y="235" width="40" height="3" fill="var(--slate)"/>
        <circle cx="260" cy="15" r="10" fill="var(--bone)" stroke="var(--slate)"/>
        <text x="260" y="18" textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--charcoal)">CEO</text>
        <path d="M 260 24 L 230 40" stroke="var(--crimson)" strokeWidth="1" strokeDasharray="3 3"/>
        <path d="M 260 24 L 380 40" stroke="var(--crimson)" strokeWidth="1" strokeDasharray="3 3"/>
        <text x="190" y="18" fontFamily="var(--mono)" fontSize="8" fill="var(--crimson-ink)">client sightline · ok</text>
        <line x1="100" y1="232" x2="100" y2="250" stroke="var(--slate)" strokeWidth="0.5"/>
        <text x="100" y="260" fontFamily="var(--mono)" fontSize="8" fill="var(--slate)">Main · notes, agenda</text>
        <line x1="378" y1="232" x2="378" y2="250" stroke="var(--navy)" strokeWidth="0.5"/>
        <text x="500" y="260" textAnchor="end" fontFamily="var(--mono)" fontSize="8" fill="var(--navy)">Sidecar · hidden at 20° angle</text>
      </svg>
    </div>
  );
}

function PhoneDiagram() {
  return (
    <div style={{display:'flex', justifyContent:'center', padding: '6px 0'}}>
      <svg viewBox="0 0 240 160" width="100%" style={{maxWidth: 240}}>
        <rect x="90" y="10" width="60" height="130" rx="8" fill="var(--navy)"/>
        <rect x="94" y="18" width="52" height="114" fill="var(--paper)"/>
        <text x="120" y="30" textAnchor="middle" fontFamily="var(--mono)" fontSize="5" fill="var(--slate)" letterSpacing="0.1em">RECALL · MOBILE</text>
        <rect x="98" y="36" width="44" height="22" fill="var(--navy)"/>
        <text x="120" y="46" textAnchor="middle" fontFamily="var(--serif)" fontSize="6" fill="var(--paper)">Globex 2018</text>
        <text x="120" y="54" textAnchor="middle" fontFamily="var(--serif)" fontSize="5" fontStyle="italic" fill="rgba(244,241,234,0.7)">CDO → CEO</text>
        {[64,70,76,82,88,94,100,106,112,118,124].map(y => <rect key={y} x="99" y={y} width={Math.min(42, 24 + (y%18))} height="1" fill="var(--rule)"/>)}
        <text x="120" y="152" textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--slate)">off-site / coffee-shop form</text>
      </svg>
    </div>
  );
}

function RealtimePage({ turnIdx = 0, showFallback = false }) {
  const turns = window.RECALL_TURNS.slice(0, turnIdx + 1);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="crumb">S3 · Layer 2 · Real-Time Recall <span style={{color:'var(--mist)'}}>· live meeting surface</span></div>
          <h1>In meeting <em>— Fellow-only sidecar</em></h1>
          <div style={{marginTop: 8, display:'flex', gap: 8}}>
            <span className="tag"><span className="live-dot"/>Live · 00:23:14</span>
            <span className="tag navy">C2 · invisible to client</span>
            <span className="tag">laptop sidebar · primary form factor</span>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 10}}>
          <div className="meta">Acme bi-weekly · Meeting 2 of 12<br/>Host · D. Park · Recording · on</div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1.4fr 1fr', gap: 24}}>
        <div style={{display:'flex', flexDirection:'column', gap: 18}}>
          <div className="card">
            <div className="card-h">
              <div className="t">Physical setup <em>— Fig. A · laptop sidebar</em></div>
              <span className="tag">client seated opposite · 3–4 ft</span>
            </div>
            <div className="card-b"><LaptopDiagram/></div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Recall feed <em>— first-hit + multi-turn deep-dive</em></div>
              <span className="tag sage">{turns.length} turn{turns.length > 1 ? 's' : ''} · same precedent</span>
            </div>
            <div className="card-b" style={{padding: 0}}>
              {turns.map((t, i) => <RecallTurn key={i} t={t} primary={i === 0} />)}

              {showFallback && (
                <div style={{padding: '18px 20px', borderTop: '1px dashed var(--rule)', background: 'rgba(200, 60, 55, 0.04)'}}>
                  <div className="dot-tag crim" style={{marginBottom: 8}}>
                    <span className="d"/><span>No-anchor fallback · honest failure</span>
                  </div>
                  <div style={{fontFamily:'var(--serif)', fontSize: 13.5, color:'var(--ink)', fontStyle:'italic', marginBottom: 6}}>
                    “{window.NO_ANCHOR_QUERY.query}”
                  </div>
                  <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--slate)', marginBottom: 6}}>{window.NO_ANCHOR_QUERY.reason}</div>
                  <div style={{padding:'8px 12px', background:'var(--paper)', border:'1px solid var(--rule)', fontFamily:'var(--serif)', fontSize: 13, color:'var(--navy)', fontWeight: 500}}>
                    ↳ System suggests: {window.NO_ANCHOR_QUERY.suggestion}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: 18}}>
          <div className="card">
            <div className="card-h">
              <div className="t">Inverted pyramid guard</div>
              <span className="tag sage">C2 proof</span>
            </div>
            <div className="card-b">
              <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 8}}>Every card includes Fellow-voice rewrite</div>
              <div style={{display:'grid', gap: 12}}>
                <MiniRow k="System phrasing" v="Exact quote from corpus — for Fellow context only." tone="slate"/>
                <MiniRow k="Fellow rewrite" v="Short, conversational — what D. Park actually says to the CEO." tone="navy"/>
                <MiniRow k="Client sees" v="Nothing. The sidecar is on the Fellow's laptop only." tone="crimson"/>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Other form factor <em>— Fig. B</em></div>
              <span className="tag">out-of-office / face-to-face</span>
            </div>
            <div className="card-b">
              <PhoneDiagram/>
              <div className="foot" style={{textAlign:'center', marginTop: 10}}>Static illustration only — not demoed live.</div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Latency budget</div>
              <span className="tag sage">on track</span>
            </div>
            <div className="card-b" style={{padding: '10px 18px 14px'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto', rowGap: 8, fontSize: 12.5}}>
                <div>First hit</div><div style={{fontFamily:'var(--mono)'}}>11.8 s <span style={{color:'var(--slate)'}}>· budget 15 s</span></div>
                <div>Follow-up (cached)</div><div style={{fontFamily:'var(--mono)'}}>7.3 s <span style={{color:'var(--slate)'}}>· budget 10 s</span></div>
                <div>No-anchor decline</div><div style={{fontFamily:'var(--mono)'}}>9.4 s</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThesisDiff({ tm }) {
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:'1px solid var(--rule-2)'}}>
      <ThesisColumn title="Before Meeting 2" when="Apr 7 · pre-brief" state={tm.before_m1} before />
      <ThesisColumn title="After Meeting 2" when="Apr 21 · 24h post" state={tm.after_m1} diffs={tm.diffs} />
    </div>
  );
}

function ThesisColumn({ title, when, state, diffs = [], before }) {
  const renderField = (fieldKey, values) => {
    const fieldDiffs = diffs.filter(d => d.field === fieldKey);
    return (
      <div style={{padding: '12px 16px', borderTop: '1px solid var(--rule-2)'}}>
        <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--slate)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 6}}>
          {fieldKey.replace('_', ' ')}
        </div>
        {Array.isArray(values) ? (
          <ul style={{margin: 0, padding: 0, listStyle:'none'}}>
            {values.map((v, i) => {
              const isNew = fieldDiffs.some(d => d.text.includes(v) && d.kind === 'add');
              return (
                <li key={i} style={{
                  fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink)',
                  padding: '4px 0', display:'flex', gap: 6,
                  background: isNew ? 'rgba(88,124,82,0.08)' : 'transparent',
                  borderLeft: isNew ? '2px solid var(--sage)' : '2px solid transparent',
                  paddingLeft: 8,
                }}>
                  <span style={{color: isNew ? 'var(--sage-ink)' : 'var(--mist)', fontFamily:'var(--mono)', fontSize: 11}}>{isNew ? '+' : '·'}</span>
                  <span>{v}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div style={{fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink)', lineHeight: 1.5}}>{values}</div>
        )}
      </div>
    );
  };
  return (
    <div style={{borderRight: before ? '1px solid var(--rule-2)' : 'none', background: before ? 'var(--paper)' : 'rgba(88,124,82,0.03)'}}>
      <div style={{padding:'10px 16px', background: before ? 'var(--bone)' : 'var(--navy)', color: before ? 'var(--charcoal)' : 'var(--paper)', display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <div style={{fontFamily:'var(--serif)', fontSize: 14, fontWeight: 500}}>{title}</div>
        <div style={{fontFamily:'var(--mono)', fontSize: 10, opacity: 0.7}}>{when}</div>
      </div>
      {renderField('dominant_logic', state.dominant_logic)}
      {renderField('cited_anchors', state.cited_anchors)}
      {renderField('unresolved', state.unresolved)}
      {!before && diffs.length > 0 && (
        <div style={{padding:'12px 16px', borderTop: '1px solid var(--rule-2)'}}>
          <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--sage-ink)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 6}}>Trigger log</div>
          {diffs.map((d, i) => (
            <div key={i} style={{fontSize: 11.5, color:'var(--ink)', padding: '4px 0', borderTop: i === 0 ? 'none' : '1px dotted var(--rule-2)'}}>
              <div style={{fontFamily:'var(--mono)', color:'var(--slate)', fontSize: 10}}>{d.trigger} → {d.source}</div>
              <div style={{fontFamily:'var(--serif)', color:'var(--ink)', marginTop: 2}}>{d.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostMeetingPage() {
  const tm = window.THESIS_MEMORY;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="crumb">S3 · Layer 3 · Compounding Loop · T + 24h</div>
          <h1>After the meeting <em>— memo + memory</em></h1>
        </div>
        <div className="meta">Acme Industrial · Meeting 2<br/>D. Park · sent 22 Apr 16:58</div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1.3fr', gap: 24}}>
        <div className="card">
          <div className="card-h">
            <div className="t">(a) 24-hour Analogical Memo</div>
          </div>
          <div className="card-b" style={{padding: 0}}>
            <div style={{padding: '26px 28px', fontFamily:'var(--serif)', fontSize: 13, lineHeight: 1.65, color:'var(--ink)', maxHeight: 620, overflow:'hidden'}}>
              <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)', letterSpacing:'0.08em'}}>22 APR 2026 · 4:58 PM</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 17, color:'var(--navy)', marginTop: 8, marginBottom: 6, fontWeight: 500}}>Following up on yesterday's conversation</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--slate)', marginBottom: 14}}>To: M. Halverson · cc: R. Vega, S. Lindqvist</div>
              <p style={{margin:'0 0 10px'}}>M.,</p>
              <p style={{margin:'0 0 10px'}}>Two items worth sitting with before we meet again.</p>
              <p style={{margin:'0 0 10px'}}><strong style={{color:'var(--navy)'}}>On the innovation reporting line.</strong> Closest analogue in our archive: 2018 manufacturer, same configuration. CDO under Ops for nine months before drift; moving to direct-CEO unlocked two stuck initiatives within a quarter.</p>
              <p style={{margin:'0 0 10px'}}>Not yet recommending the move for Acme — want to test the read first.</p>
              <p style={{margin:'0 0 10px'}}><strong style={{color:'var(--navy)'}}>On the Transformation Office scope.</strong> Cleanest version I've seen: dual P&amp;L, run vs. change, TO owns only the change column.</p>
              <p style={{margin:'0 0 10px'}}>— D.</p>
              <hr className="rule"/>
              <div style={{fontFamily:'var(--mono)', fontSize: 10, color:'var(--slate)'}}>
                Footnotes · Globex 2018 (CGS-2018-GLBX-M042) · Initech 2019 (CGS-2019-INTK-M018)
              </div>
            </div>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: 18}}>
          <div className="card">
            <div className="card-h">
              <div className="t">(b) Client Thesis Memory <em>— M1 → M2 diff</em></div>
            </div>
            <div className="card-b" style={{padding: 0}}>
              <ThesisDiff tm={tm}/>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function ThesisFullPage() {
  const tm = window.THESIS_MEMORY;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="crumb">S3 · Thesis Memory · full view</div>
          <h1>Acme Industrial <em>— client thesis · 2-meeting diff</em></h1>
        </div>
      </div>
      <div className="card"><ThesisDiff tm={tm}/></div>
    </div>
  );
}

Object.assign(window, { PreReadPage, RealtimePage, PostMeetingPage, ThesisFullPage });
