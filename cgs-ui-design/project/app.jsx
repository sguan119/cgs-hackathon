// Main index — lay out all UI screens on a design canvas as annotated artboards.
// New PRD: Dashboard → Diagnostic → Meeting Recall → Continuity → Data Hub (demo flow order).

const { useState } = React;

function App() {
  return (
    <DesignCanvas minScale={0.15} maxScale={3}>
      <div style={{padding: '20px 60px 10px'}}>
        <div style={{fontFamily:'"IBM Plex Serif", Georgia, serif', fontSize: 34, fontWeight: 400, color:'#0F1B2D', letterSpacing:'-0.01em'}}>
          CGS Advisors Agentic AI <em style={{fontStyle:'italic', color:'#555E6E', fontWeight: 300}}>— UI / UX design spec</em>
        </div>
        <div style={{fontFamily:'"IBM Plex Mono", ui-monospace, monospace', fontSize: 12, color:'#555E6E', marginTop: 6, letterSpacing:'0.04em'}}>
          Desktop · 1440 × 900 · 7 surfaces
        </div>
      </div>

      {/* SECTION 1 — Dashboard */}
      <DCSection title="Part 1 · §5 Dashboard · demo entry"
                 subtitle="Opens on any Client/Prospect. 30-second context load (demonstrator times it live). Every timeline event routes to §2 / §3 / §6 — the entry to the entire demo.">
        <DCArtboard label="01 · Dashboard · Acme Industrial workspace" width={1440} height={1100}>
          <AppShell active="dashboard"><DashboardPage/></AppShell>
        </DCArtboard>
        <DCPostIt top={220} left={1460} rotate={2} width={220}>
          Timeline rows route to Diagnostic / Recall / Continuity.
        </DCPostIt>
      </DCSection>

      {/* SECTION 2 — Diagnostic */}
      <DCSection title="Part 2 · §2 Diagnostic Agent"
                 subtitle="Machine executes CGS method on Acme fixtures — Strategy Wheel scoring, Inertia hypotheses, intervention library. ~3–4 min in the 15-min demo. Fellow Override is the hero beat.">

        <DCArtboard label="02 · App shell · Diagnostic landing" width={1440} height={900}>
          <AppShell active="diagnostic"><DiagnosticPage wheelVariant="A" /></AppShell>
        </DCArtboard>

        <DCArtboard label="03 · Strategy Wheel · variant B (concentric rings)" width={1440} height={900}>
          <AppShell active="diagnostic"><DiagnosticPage wheelVariant="B" /></AppShell>
        </DCArtboard>

        <DCArtboard label="04 · Fellow Override state · crimson re-score + hypothesis refresh" width={1440} height={900}>
          <AppShell active="diagnostic"><DiagnosticPage wheelVariant="A" overrideActive/></AppShell>
        </DCArtboard>

        <DCPostIt top={360} left={1460} rotate={2} width={200}>
          Override re-scores live; hypotheses refresh.
        </DCPostIt>
      </DCSection>

      {/* SECTION 3 — Pre-Read */}
      <DCSection title="Part 3 · §3 Layer 1 · Pre-Read Archivist"
                 subtitle="Generated 14h before meeting. Every anchor includes an 'ingredient' source to defeat the 'this is just ChatGPT' critique.">
        <DCArtboard label="05 · Pre-Read brief · inside Tauri app" width={1440} height={900}>
          <AppShell active="preread"><PreReadPage/></AppShell>
        </DCArtboard>

        <DCArtboard label="06 · As exported to Google Doc · print-ready" width={820} height={1060}>
          <PreReadDocExport/>
        </DCArtboard>
      </DCSection>

      {/* SECTION 4 — Real-time */}
      <DCSection title="Part 4 · §3 Layer 2 · Real-Time Recall  ·  DEMO HERO (60%)"
                 subtitle="Two surfaces: (1) Workbench monitoring, (2) always-on overlay summoned with ⌘K that floats on top of Zoom / Docs. Client-invisible. Knowledge Search (§4) capability surfaces here in-panel, not as a separate screen.">

        <DCArtboard label="07 · Workbench console · pre-meeting readiness" width={1440} height={900}>
          <AppShell active="realtime"><RealtimeDashboard/></AppShell>
        </DCArtboard>

        <DCArtboard label="08 · ⌘K summon · moment of invocation" width={1440} height={900}>
          <MeetingLaptopView turnIdx={0} summoning/>
        </DCArtboard>

        <DCArtboard label="09 · First turn · laptop in meeting (<15s return)" width={1440} height={900}>
          <MeetingLaptopView turnIdx={0}/>
        </DCArtboard>

        <DCArtboard label="10 · 3rd turn · multi-turn deep-dive on same precedent" width={1440} height={900}>
          <MeetingLaptopView turnIdx={2}/>
        </DCArtboard>

        <DCArtboard label="11 · No-anchor fallback · honest failure state" width={1440} height={900}>
          <MeetingLaptopView turnIdx={2} showFallback/>
        </DCArtboard>

        <DCArtboard label="12 · Collapsed rail · client leans in / screen-sharing" width={1440} height={900}>
          <MeetingLaptopView turnIdx={1} collapsed/>
        </DCArtboard>

        <DCPostIt top={360} left={1460} rotate={-2} width={220}>
          Knowledge Search lives in-panel — not a separate screen.
        </DCPostIt>
      </DCSection>

      {/* SECTION 5 — Post-meeting */}
      <DCSection title="Part 5 · §3 Layer 3 · Compounding Loop"
                 subtitle="24h memo (client-facing), Thesis Memory diff (internal), Curated Backfill — each meeting sharpens the next.">

        <DCArtboard label="13 · Post-meeting dashboard" width={1440} height={900}>
          <AppShell active="post"><PostMeetingPage/></AppShell>
        </DCArtboard>

        <DCArtboard label="14 · 24h Memo · as client receives it" width={820} height={1060}>
          <MemoExport/>
        </DCArtboard>

        <DCArtboard label="15 · Thesis Memory · full-width diff view" width={1440} height={640}>
          <AppShell active="post" compact><ThesisFullPage/></AppShell>
        </DCArtboard>
      </DCSection>

      {/* SECTION 6 — Continuity */}
      <DCSection title="Part 6 · §6 Continuity Agent"
                 subtitle="Post-engagement advisory. Light-touch check-in email + Tone Guard (E2/E3 hero). Client reply extraction → internal Fellow escalation with preset engagement menu (E4/E5 hero).">
        <DCArtboard label="16 · Continuity workspace · E1–E5" width={1440} height={1200}>
          <AppShell active="continuity"><ContinuityPage/></AppShell>
        </DCArtboard>
        <DCPostIt top={420} left={1460} rotate={2} width={220}>
          Quarterly cadence allows direct-send; live speech does not.
        </DCPostIt>
      </DCSection>

      {/* SECTION 7 — Data Hub */}
      <DCSection title="Part 7 · §7 Data Hub · demo closer"
                 subtitle="~1 min — the 'data substrate reveal'. Tag & classify the CRM fixture. Answers 'where does the data come from' after the hero beats are done.">
        <DCArtboard label="17 · Data Hub · tag &amp; classify" width={1440} height={1100}>
          <AppShell active="datahub"><DataHubPage/></AppShell>
        </DCArtboard>
        <DCPostIt top={220} left={1460} rotate={-2} width={220}>
          Placed last — data substrate reveal after hero beats.
        </DCPostIt>
      </DCSection>

      {/* SECTION 8 — Architecture-aligned additions */}
      <DCSection title="Part 8 · Architecture-aligned additions · 2026-04-21"
                 subtitle="Five artboards added to close gaps between architecture.md / tech-design.md and the design canvas. Sketch fidelity — designer welcome to polish.">

        <DCArtboard label="A1 · Recall · standalone Tauri panel · vibrancy on macOS" width={920} height={620}>
          <TauriPanelChrome panelWidth={360} panelHeight={500}>
            <RecallSidebar turnIdx={1}/>
          </TauriPanelChrome>
        </DCArtboard>

        <DCArtboard label="A2 · Main window · meeting state · Fake Zoom + shared deck split" width={1440} height={900}>
          <MeetingSplitMain/>
        </DCArtboard>

        <DCArtboard label="A3 · Diagnostic Override · streaming mid-state" width={1440} height={900}>
          <AppShell active="diagnostic"><OverrideStreamingFragment/></AppShell>
        </DCArtboard>

        <DCArtboard label="A4 · Recall · query input · autocomplete open" width={920} height={620}>
          <TauriPanelChrome panelWidth={360} panelHeight={500}>
            <RecallAutocompleteOverlay/>
          </TauriPanelChrome>
        </DCArtboard>

        <DCArtboard label="A5 · Dashboard · 30s context-load timer + progressive reveal" width={1440} height={1100}>
          <DashboardLoadingState/>
        </DCArtboard>

        <DCPostIt top={420} left={1460} rotate={-2} width={240}>
          A1 + A4 prove D5 = Tauri (Mac vibrancy). A2 is meeting-state main window (not the laptop concept diagram).
        </DCPostIt>
      </DCSection>

      {/* SECTION 9 — Design system */}
      <DCSection title="Part 9 · Design system · reference sheet"
                 subtitle="Tokens, type, components used across all surfaces.">
        <DCArtboard label="19 · Design tokens, type, components" width={1440} height={1040}>
          <DesignSystemSheet/>
        </DCArtboard>
      </DCSection>

      <div style={{padding:'0 60px 40px', fontFamily:'"IBM Plex Mono", ui-monospace, monospace', fontSize: 11, color:'#8B93A1', letterSpacing:'0.04em'}}>
        end · CGS-DX · design spec v2 · 24 artboards · 7 surfaces
      </div>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
