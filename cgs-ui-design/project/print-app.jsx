// Print-only entry — render all artboards vertically, one per page, no canvas wrapper.

function PrintApp() {
  const artboards = [
    { label: 'A · App shell · S2 landing', section: 'Part 1 · S2 Diagnostic Agent', w: 1440, h: 900, render: () => <AppShell active="diagnostic"><DiagnosticPage wheelVariant="A"/></AppShell> },
    { label: 'B · Strategy Wheel · variant B (concentric rings)', section: 'Part 1 · S2 Diagnostic Agent', w: 1440, h: 900, render: () => <AppShell active="diagnostic"><DiagnosticPage wheelVariant="B"/></AppShell> },
    { label: 'C · Fellow Override state · crimson re-score + downstream refresh', section: 'Part 1 · S2 Diagnostic Agent', w: 1440, h: 900, render: () => <AppShell active="diagnostic"><DiagnosticPage wheelVariant="A" overrideActive/></AppShell> },
    { label: 'D · Pre-Read brief · inside Tauri app', section: 'Part 2 · S3 Layer 1 · Pre-Read Archivist', w: 1440, h: 900, render: () => <AppShell active="preread"><PreReadPage/></AppShell> },
    { label: 'E · As exported to Google Doc · print-ready', section: 'Part 2 · S3 Layer 1 · Pre-Read Archivist', w: 820, h: 1060, render: () => <PreReadDocExport/> },
    { label: 'F-dash · Workbench console · pre-meeting readiness + recent-calls log', section: 'Part 3 · S3 Layer 2 · Real-Time Recall', w: 1440, h: 900, render: () => <AppShell active="realtime"><RealtimeDashboard/></AppShell> },
    { label: 'F0 · ⌘K summon · moment of invocation', section: 'Part 3 · S3 Layer 2 · Real-Time Recall', w: 1440, h: 900, render: () => <MeetingLaptopView turnIdx={0} summoning/> },
    { label: 'F · First turn · laptop in meeting (<15s return)', section: 'Part 3 · S3 Layer 2 · Real-Time Recall', w: 1440, h: 900, render: () => <MeetingLaptopView turnIdx={0}/> },
    { label: 'G · 3rd turn · multi-turn deep-dive on same precedent', section: 'Part 3 · S3 Layer 2 · Real-Time Recall', w: 1440, h: 900, render: () => <MeetingLaptopView turnIdx={2}/> },
    { label: 'H · No-anchor fallback · honest failure state', section: 'Part 3 · S3 Layer 2 · Real-Time Recall', w: 1440, h: 900, render: () => <MeetingLaptopView turnIdx={2} showFallback/> },
    { label: 'H2 · Collapsed rail · client leans in / screen-sharing', section: 'Part 3 · S3 Layer 2 · Real-Time Recall', w: 1440, h: 900, render: () => <MeetingLaptopView turnIdx={1} collapsed/> },
    { label: 'I · Post-meeting dashboard', section: 'Part 4 · S3 Layer 3 · Compounding Loop', w: 1440, h: 900, render: () => <AppShell active="post"><PostMeetingPage/></AppShell> },
    { label: 'J · 24h Memo · as client receives it', section: 'Part 4 · S3 Layer 3 · Compounding Loop', w: 820, h: 1060, render: () => <MemoExport/> },
    { label: 'K · Thesis Memory · full-width diff view', section: 'Part 4 · S3 Layer 3 · Compounding Loop', w: 1440, h: 640, render: () => <AppShell active="post" compact><ThesisFullPage/></AppShell> },
    { label: 'L · Design tokens, type, components', section: 'Part 5 · Design system', w: 1440, h: 1040, render: () => <DesignSystemSheet/> },
  ];

  return (
    <div>
      {/* Cover page */}
      <div className="print-page cover">
        <div className="cover-inner">
          <div className="cover-eyebrow">CGS ADVISORS / AGENTIC AI</div>
          <h1 className="cover-title">UI / UX <em>design spec</em></h1>
          <div className="cover-rule"/>
          <div className="cover-sub">Desktop client · Tauri (Rust + WebView) · 1440 × 900 · primary form factor</div>
          <div className="cover-body">
            Design spec covering S2 (Diagnostic Agent, 5-minute demo) and S3 (Meeting Recall, 10-minute demo).
            Serious consulting aesthetic — ivory paper, navy ink, IBM Plex Serif + Sans + Mono.
            Accent reserved for inertia / override (crimson) and confident citations (sage).
          </div>
          <div className="cover-meta">
            <div><span>Document</span> CGS-DX design spec · 15 artboards</div>
            <div><span>Revision</span> v0.4 · Apr 2026</div>
          </div>
        </div>
      </div>

      {/* One artboard per page */}
      {artboards.map((a, i) => {
        const parts = a.label.split('·').map(s => s.trim());
        const key = parts[0];
        const rest = parts.slice(1).join(' · ');
        return (
          <div key={i} className="print-page artboard-page">
            <div className="p-head">
              <div className="p-section">{a.section}</div>
              <div className="p-page">{String(i+1).padStart(2,'0')} / {String(artboards.length).padStart(2,'0')}</div>
            </div>
            <div className="p-label-row">
              <span className="p-key">{key}</span>
              <span className="p-rest">{rest}</span>
            </div>
            <div className="p-stage">
              <div className="p-frame" style={{width: a.w, height: a.h, aspectRatio: `${a.w} / ${a.h}`}}>
                {a.render()}
              </div>
            </div>
            <div className="p-foot">
              <span>CGS Advisors · Agentic AI · UI/UX design spec</span>
              <span>{a.w} × {a.h}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PrintApp/>);
