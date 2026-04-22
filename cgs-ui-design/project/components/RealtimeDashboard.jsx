// RealtimeDashboard — the "Real-Time Recall" sub-nav page inside Workbench.
// RADICAL MINIMALISM: one hero, one log, one footer line. Nothing else.
// The whole page exists to say: "press ⌘K — the real product is elsewhere."

function RealtimeDashboard() {
  return (
    <div className="page" style={{paddingTop: 32}}>
      <div className="page-header" style={{marginBottom: 28}}>
        <div>
          <div className="crumb">S3 · Layer 2 · Real-Time Recall</div>
          <h1>Recall console</h1>
        </div>
        <div className="meta">
          Acme Industrial · Fellow D. Park<br/>
          Next meeting: May 5 · bi-weekly #3
        </div>
      </div>

      <HeroCTA/>

      <RecentCallsCard/>

      <StatusFooter/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO — the one and only thing that matters on this page
// ─────────────────────────────────────────────────────────────

function HeroCTA() {
  return (
    <div style={{
      background: 'var(--navy)',
      color: 'var(--paper)',
      borderRadius: 4,
      padding: '56px 60px',
      marginBottom: 36,
      position: 'relative',
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: 40,
    }}>
      {/* soft gold halo */}
      <div style={{
        position: 'absolute',
        top: -100, right: -100,
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(212,165,75,0.18), transparent 65%)',
        pointerEvents: 'none',
      }}/>

      <div style={{position: 'relative'}}>
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: 44,
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: '-0.015em',
          marginBottom: 20,
          maxWidth: 680,
        }}>
          The overlay lives <em style={{fontStyle:'italic', color:'rgba(244,241,234,0.65)'}}>above</em> your apps —<br/>
          not inside them.
        </div>

        <div style={{
          fontFamily: 'var(--sans)',
          fontSize: 14,
          color: 'rgba(244,241,234,0.7)',
          lineHeight: 1.6,
          maxWidth: 560,
        }}>
          Summoned from any app. Client-invisible. Precedent back in &lt;15 s.
        </div>
      </div>

      {/* the button */}
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14}}>
        <button style={{
          background: 'var(--gold)',
          color: 'var(--navy)',
          fontFamily: 'var(--sans)',
          fontWeight: 600,
          fontSize: 15,
          padding: '18px 28px',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}>
          <span>Enter floating mode</span>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 13,
            padding: '3px 9px',
            background: 'rgba(15,27,45,0.15)',
            borderRadius: 2,
            letterSpacing: '0.02em',
          }}>⌘K</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RECENT CALLS — the only other thing on the page
// ─────────────────────────────────────────────────────────────

function RecentCallsCard() {
  const calls = [
    { t: '10:47', q: 'Where should the CDO actually report? We put her under COO…', prec: 'Globex 2018', status: 'cited' },
    { t: '10:52', q: 'How do we set up AI governance inside the Transformation Office?', prec: null, status: 'no-anchor' },
    { t: '11:04', q: 'Have we done the dual-P&L thing at F500 scale?', prec: 'Initech 2019', status: 'cited' },
    { t: '11:11', q: 'Reporting cadence to the board — monthly too tight?', prec: 'Globex 2020', status: 'skipped' },
    { t: '11:23', q: 'What triggered the Transformation Office dissolution at Stark?', prec: 'Stark 2022', status: 'cited' },
    { t: '11:29', q: 'Is there a precedent for moving Innovation under CFO instead?', prec: null, status: 'no-anchor' },
  ];

  const statusMeta = {
    'cited':     { color: 'var(--sage-ink)',    label: 'Cited live' },
    'no-anchor': { color: 'var(--crimson-ink)', label: 'No-anchor' },
    'skipped':   { color: 'var(--mist)',        label: 'Skipped' },
  };

  return (
    <div style={{marginBottom: 40}}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: '1px solid var(--rule)',
      }}>
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: 20,
          color: 'var(--navy)',
          fontWeight: 400,
        }}>
          Recent calls <em style={{fontStyle: 'italic', color: 'var(--slate)', fontSize: 14}}>— M2 · last 6</em>
        </div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--slate)',
          letterSpacing: '0.04em',
        }}>
          Full log →
        </div>
      </div>

      <div>
        {calls.map((c, i) => {
          const st = statusMeta[c.status];
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '56px 1fr 180px 110px',
              alignItems: 'center',
              gap: 18,
              padding: '16px 0',
              borderBottom: i === calls.length - 1 ? 'none' : '1px solid var(--rule-2)',
            }}>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--mist)',
                letterSpacing: '0.02em',
              }}>{c.t}</div>

              <div style={{
                fontFamily: 'var(--serif)',
                fontSize: 15,
                fontStyle: 'italic',
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.35,
              }}>"{c.q}"</div>

              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: c.prec ? 'var(--navy)' : 'var(--mist)',
                letterSpacing: '0.02em',
              }}>{c.prec || '—'}</div>

              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 10.5,
                color: st.color,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                textAlign: 'right',
              }}>
                {st.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATUS FOOTER — everything else compressed into one line of gray
// ─────────────────────────────────────────────────────────────

function StatusFooter() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      paddingTop: 16,
      borderTop: '1px solid var(--rule-2)',
      fontFamily: 'var(--mono)',
      fontSize: 10.5,
      color: 'var(--mist)',
      letterSpacing: '0.02em',
    }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--sage-ink)',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--sage)',
        }}/>
        READY
      </span>
      <span style={{color: 'var(--rule)'}}>·</span>
      <span>corpus 1.07 TB · synced 4m</span>
      <span style={{color: 'var(--rule)'}}>·</span>
      <span>8 precedents primed</span>
      <span style={{color: 'var(--rule)'}}>·</span>
      <span>p95 11.2 s</span>
    </div>
  );
}

Object.assign(window, { RealtimeDashboard });
