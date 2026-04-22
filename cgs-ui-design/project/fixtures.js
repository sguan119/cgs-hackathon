// Shared fixtures used across S2 + S3
// NOTE: All content is fictional for demo. Client = "Acme Industrial" (industry-neutral).

window.CGS_DIMENSIONS = [
  { id: 'ext',  short: 'External Sensing',           abbr: 'EXT', desc: 'Market, competitor, regulatory signal detection' },
  { id: 'int',  short: 'Internal Sensing',           abbr: 'INT', desc: 'Org health, culture & capability introspection' },
  { id: 'form', short: 'Strategy Formulation',       abbr: 'FRM', desc: 'Choice architecture & positioning' },
  { id: 'tcon', short: 'Strategic Transformation Concept', abbr: 'TCN', desc: 'Designing the change model' },
  { id: 'tx',   short: 'Strategic Transformation',   abbr: 'TRX', desc: 'Execution of large-scale change' },
  { id: 'inn',  short: 'Strategic Innovation',       abbr: 'INV', desc: 'Horizon-2 / 3 capability building' },
  { id: 'gov',  short: 'Strategy Governance & Communications', abbr: 'GOV', desc: 'Board, cadence, narrative discipline' },
];

// Score: 0–5. For demo — shows mix of strong/weak across wheel.
window.CGS_DEFAULT_SCORES = {
  ext: 3.2, int: 1.8, form: 3.8, tcon: 2.4, tx: 2.0, inn: 1.4, gov: 3.5
};

window.CGS_OVERRIDE_SCORES = {
  ext: 3.2, int: 1.8, form: 3.8, tcon: 2.4, tx: 2.0, inn: 3.4, gov: 3.5
};

// Fictional CEO memo — industry-neutral.
window.DOC_MEMO = {
  title: 'Strategy Memo to the Board — Transformation Cadence',
  author: 'M. Halverson, CEO · Acme Industrial',
  date: 'Mar 14, 2026',
  pages: 5,
  sentences: [
    { id: 'm1', text: 'Our transformation agenda is on track; I expect the second half to inflect.', dim: 'form', cite: 'memo · p.1 · ¶1' },
    { id: 'm2', text: 'We have re-sequenced priorities to emphasize cost discipline while preserving the innovation engine.', dim: 'tcon', cite: 'memo · p.1 · ¶2', conflict: true },
    { id: 'm3', text: 'The Strategic Innovation function reports into Operations to drive execution pace.', dim: 'inn', cite: 'memo · p.2 · ¶1', conflict: true },
    { id: 'm4', text: 'Board updates now occur every four weeks; cadence is the primary accountability mechanism.', dim: 'gov', cite: 'memo · p.2 · ¶3' },
    { id: 'm5', text: 'Customer listening programs have been folded into the quarterly planning cycle.', dim: 'ext', cite: 'memo · p.3 · ¶1' },
    { id: 'm6', text: 'Internal engagement scores have softened; we are not yet alarmed.', dim: 'int', cite: 'memo · p.4 · ¶2', conflict: true },
  ],
};

// Org chart — innovation buried under ops.
window.DOC_ORG = {
  title: 'Organization Structure · Q1 FY26',
  nodes: [
    { id: 'ceo', label: 'CEO', lvl: 0 },
    { id: 'cfo', label: 'CFO', lvl: 1 },
    { id: 'coo', label: 'COO · Operations', lvl: 1, highlight: 'crimson' },
    { id: 'cto', label: 'CTO · Technology', lvl: 1 },
    { id: 'chro', label: 'CHRO · People', lvl: 1 },
    { id: 'ops1', label: 'Operations PMO', lvl: 2, parent: 'coo' },
    { id: 'ops2', label: 'Continuous Improvement', lvl: 2, parent: 'coo' },
    { id: 'innov', label: 'Strategic Innovation', lvl: 2, parent: 'coo', highlight: 'crimson', note: 'Reporting line flagged — structural mismatch' },
    { id: 'tech1', label: 'Platform', lvl: 2, parent: 'cto' },
    { id: 'tech2', label: 'Data & AI', lvl: 2, parent: 'cto' },
  ],
};

window.DOC_CALL = {
  title: 'Q3 FY25 Earnings Call — Transcript Excerpt',
  speakers: [
    { who: 'Analyst — RBC', line: 'On transformation cadence — are you seeing the pace you expected when you restructured the org?' },
    { who: 'CEO Halverson', line: 'We are focused on cost. Our operating model is being tightened and we expect to see that flow through in Q1.', dim: 'tx', conflict: true },
    { who: 'Analyst — Jefferies', line: 'Could you speak to the innovation pipeline and where those capabilities now sit?' },
    { who: 'CEO Halverson', line: 'We have moved the innovation team closer to the business so they deliver against operating priorities.', dim: 'inn', conflict: true },
    { who: 'Analyst — Barclays', line: 'Any change to how the board tracks the transformation?' },
    { who: 'CEO Halverson', line: 'Cadence is monthly. Governance is the primary accountability mechanism.', dim: 'gov' },
  ],
};

// Inertia hypotheses
window.INERTIA_HYPOTHESES = [
  {
    id: 'dli-1',
    kind: 'Dominant Logic Inertia',
    label: 'Transformation is being managed as a cost program, not a capability program.',
    confidence: 0.78,
    evidence: [
      { src: 'memo · p.1 · ¶2', text: '“…re-sequenced priorities to emphasize cost discipline…”' },
      { src: 'earnings · CEO', text: '“We are focused on cost. Our operating model is being tightened…”' },
    ],
    interventions: ['int-a', 'int-b', 'int-c'],
  },
  {
    id: 'sli-1',
    kind: 'Structural Inertia',
    label: 'Strategic Innovation reports into Operations — execution pressure will crowd out horizon-2 work within 2 quarters.',
    confidence: 0.84,
    evidence: [
      { src: 'org chart · node INNOV', text: 'Strategic Innovation → COO → CEO (two-hop from CEO).' },
      { src: 'memo · p.2 · ¶1', text: '“…reports into Operations to drive execution pace.”' },
      { src: 'earnings · CEO', text: '“…moved the innovation team closer to the business…”' },
    ],
    interventions: ['int-d', 'int-e'],
  },
];

window.INTERVENTIONS = {
  'int-a': { title: 'Dual P&L: Run vs. Change', archetype: 'Governance', usedN: 7, avgCycle: '9 mo', precedent: 'Globex 2018 · Initech 2021 · Umbrella 2023' },
  'int-b': { title: 'Install a Transformation Office with CEO reporting line', archetype: 'Governance', usedN: 11, avgCycle: '6 mo', precedent: 'Soylent 2019 · Initech 2021 · Stark 2024' },
  'int-c': { title: 'Quarterly capability-scorecard (not cost-scorecard) to board', archetype: 'Governance', usedN: 5, avgCycle: '4 mo', precedent: 'Globex 2020 · Cyberdyne 2022' },
  'int-d': { title: 'Move Strategic Innovation to direct CEO reporting', archetype: 'Structural', usedN: 9, avgCycle: '3 mo', precedent: 'Initech 2019 · Umbrella 2022 · Stark 2024' },
  'int-e': { title: 'Standing ring-fenced budget ≥3% revenue for Horizon-2', archetype: 'Structural', usedN: 6, avgCycle: '6 mo', precedent: 'Globex 2017 · Cyberdyne 2023' },
};

// ========= S3 fixtures =========

window.PRE_READ = {
  meeting: 'Acme Industrial · Bi-weekly · Apr 21, 2026 · 10:30–11:30',
  attendees: ['CEO M. Halverson', 'COO R. Vega', 'CFO S. Lindqvist', 'CGS · Fellow D. Park'],
  unsolved: [
    'Innovation reporting line — CEO asked for "structural rationale".',
    'Transformation Office scope — open since M1.',
  ],
  predicted: [
    { q: 'How have others split the P&L between run and change work?', anchor: 'Globex 2018 · Dual-P&L rollout', dim: 'gov', src: 'Gregg · 2021 transformation deck · slide 14' },
    { q: 'What reporting line did comparable companies land on for the CDO / Innovation chief?', anchor: 'Initech 2019 · CDO to CEO direct', dim: 'inn', src: 'CGS archive · Initech closing memo · 2019' },
    { q: 'What’s the half-life of a Transformation Office before it ossifies?', anchor: 'Avg 18 months across 11 engagements', dim: 'gov', src: 'CGS pattern library · TO lifecycle · 2023' },
    { q: 'How do we prevent innovation budget being raided during cost cycles?', anchor: 'Umbrella 2022 · Ring-fenced 3% floor', dim: 'inn', src: 'Gregg · ring-fencing memo · 2022' },
    { q: 'When does monthly board cadence start to hide problems instead of surface them?', anchor: 'Stark 2024 · cadence fatigue', dim: 'gov', src: 'CGS archive · Stark mid-project review' },
  ],
};

window.RECALL_TURNS = [
  {
    query: 'Client just asked where the CDO should report. Any precedent where the CDO moved to direct CEO?',
    latency: '11.8s',
    card: {
      year: 2018,
      client: 'Globex Industrial',
      one_liner: 'Moved CDO from COO to direct CEO line after 9 months of execution drift.',
      dim: 'inn',
      source_id: 'CGS-2018-GLBX-M042',
      quote: 'Added 1 hop of ops latency, but unlocked 2 horizon-2 bets stuck in backlog for 3 quarters.',
      fellow_rewrite: 'Globex\'s COO-anchored model stalled around three quarters in. CDO moved to the CEO line — two stuck initiatives shipped within a quarter.',
    },
  },
  {
    query: 'Who did the CDO end up reporting to? How long did the transition take?',
    latency: '7.3s',
    card: {
      year: 2018,
      client: 'Globex Industrial',
      one_liner: 'Deep-dive · CDO transition mechanics',
      dim: 'gov',
      source_id: 'CGS-2018-GLBX-M042 · §4',
      quote: 'CDO → CEO direct, 8-week transition. COO kept veto 6 months. Resistance from Ops PMO, not Finance.',
      fellow_rewrite: 'Direct CEO line, 8-week transition. COO veto held 6 months. The Structural Inertia showed up in Ops PMO — not Finance.',
    },
  },
  {
    query: 'Did the move hold? Any regression after the first year?',
    latency: '6.1s',
    card: {
      year: 2018,
      client: 'Globex Industrial',
      one_liner: 'Deep-dive · 24-month follow-through',
      dim: 'tx',
      source_id: 'CGS-2018-GLBX-M042 · §7',
      quote: 'Held through CEO transition. Partial reversal attempted yr 2, rejected by board in 6 weeks.',
      fellow_rewrite: 'It held. Yr-2 walk-back attempt killed by the board in six weeks.',
    },
  },
];

window.NO_ANCHOR_QUERY = {
  query: 'How do we set up AI governance inside the Transformation Office?',
  latency: '9.4s',
  reason: 'No high-confidence precedent in the CGS corpus. Closest adjacent: Stark 2024 (partial match, 0.42 similarity).',
  suggestion: 'Commit a 24h Analogical Memo — D. Park can send it by tomorrow 5 pm.',
};

// ========= §5 Dashboard =========

window.DASHBOARD = {
  client: {
    name: 'Acme Industrial',
    industry: 'Industrial · Diversified manufacturing',
    size: 'Fortune 500 · ~42,000 employees',
    region: 'North America HQ · EMEA + APAC ops',
    retainer: 'Active · Renewal window opens Jul 2026',
    lastContact: 'Apr 19 · 10:30 — bi-weekly · D. Park',
    nextContact: 'Apr 21 · 10:30 — bi-weekly',
    relationshipStage: 'Retainer', // Signal | Pre-RFP | Retainer | Active Delivery | Renewal
  },
  stages: ['Signal', 'Pre-RFP', 'Retainer', 'Active Delivery', 'Renewal'],
  contextLoadSec: 28,
  timeline: [
    { id:'t1', t:'Apr 19',  kind:'meeting',  label:'Bi-weekly · CEO + COO + CFO',      dim:'gov', route:'recall',     sub:'Meeting recap · 12 anchors cited'},
    { id:'t2', t:'Apr 14',  kind:'earnings', label:'Q3 earnings call transcript ingested', dim:'ext', route:'diagnostic', sub:'3 inertia flags detected'},
    { id:'t3', t:'Apr 09',  kind:'email',    label:'CEO Halverson → D. Park',          dim:'inn', route:'continuity', sub:'Reply to April check-in · escalation signal'},
    { id:'t4', t:'Mar 28',  kind:'memo',     label:'24h memo · Transformation Office', dim:'gov', route:'recall',     sub:'Sent · 2 responses'},
    { id:'t5', t:'Mar 22',  kind:'project',  label:'Diagnostic run · Strategy Wheel v2', dim:'form', route:'diagnostic', sub:'Fellow override on Strategic Innovation'},
    { id:'t6', t:'Mar 10',  kind:'signal',   label:'New COO announcement · press release', dim:'int', route:'continuity', sub:'Structural Friction detected'},
  ],
  alerts: [
    { id:'a1', kind:'Retainer Renewal Risk', severity:'high',   text:'Renewal probability −18% vs. baseline after COO transition.', source:'Continuity signals · Mar 10 / Apr 09', route:'continuity'},
    { id:'a2', kind:'Unanswered Exec Email', severity:'medium', text:'CFO Apr 11 thread on TO scope · 8 days no reply.', source:'Inbox · CGS-CFO-0411', route:'recall'},
    { id:'a3', kind:'Pre-RFP Signal',        severity:'medium', text:'Competitor pitched "operating model" work Apr 15 — window opening.', source:'Meeting 19 · 0:47', route:'diagnostic'},
  ],
  externalSignals: [
    { id:'e1', t:'Apr 18', source:'Reuters',       headline:'Industrial sector re-prices capex plans after Q1 tariff reset', relevance:0.82 },
    { id:'e2', t:'Apr 16', source:'SEC · 8-K',     headline:'Peer filer "Globex Industrial" announces new COO — 2nd in 14 months',    relevance:0.91 },
    { id:'e3', t:'Apr 12', source:'CEO Halverson · LinkedIn', headline:'Post on "operating model discipline" — 3.2k engagement', relevance:0.74 },
  ],
};

// ========= §6 Continuity =========

window.CONTINUITY = {
  baseline: {
    closeDate: 'Nov 14, 2025',
    wheelSnapshot: 'Ext 3.2 · Int 1.8 · Form 3.8 · TCN 2.4 · TRX 2.0 · INV 3.4 · GOV 3.5',
    topInertia: 'Structural · Innovation reporting line',
    stakeholders: ['CEO M. Halverson', 'COO R. Vega (new, Mar 2026)', 'CFO S. Lindqvist'],
  },
  emailDraft: {
    subject: 'April check-in — two threads from the transformation track',
    to: 'M. Halverson, R. Vega',
    body: [
      { section: 'What We\'re Seeing', para: 'Your Q3 cadence language shifted from "capability pace" to "cost discipline" — a pattern that preceded innovation-budget compression in 3 prior transformations.' },
      { section: 'Quick Pulse Check', para: 'Has the new COO configuration changed how Strategic Innovation is resourced? One-line reaction is enough.' },
      { section: 'Preliminary Read', para: 'If configuration holds, a 45-min session on ring-fenced innovation budget mechanics before your July planning cycle. Umbrella 2022 + Cyberdyne 2023 precedents available.' },
    ],
  },
  toneGuard: {
    verdict: 'low-risk · approved for Fellow review',
    scores: {
      methodology: { grade:'A', note:'3 CGS concepts cited correctly. No Frankenstein framework.' },
      nonSales:   { grade:'A', note:'Zero sales-speak hits.' },
      format:     { grade:'A', note:'Three-section structure intact.' },
    },
  },
  clientReplies: [
    {
      id:'r1',
      from:'M. Halverson, CEO',
      date:'Apr 09, 2026',
      excerpt:'The new COO is rethinking our innovation stack — Rita has taken over all Digital under her Ops remit. Not ready for a formal session yet.',
      frictionKind:'Structural',
      frictionLabel:'Structural Friction detected',
      baselineComparison:'Baseline: Strategic Innovation under CTO. Now: COO oversees Digital + Innovation.',
    },
  ],
  escalation: {
    to: 'D. Park (Fellow) + G. Gregg (Principal)',
    friction: 'Structural Friction',
    confidence: 0.86,
    nextActions: [
      { id:'na1', title:'Schedule 30-min Inertia Removal check-in',      archetype:'Relational', effort:'Low',    why:'3 historical clients who restructured Innovation under Ops saw baseline shift → relationship required re-grounding within 60 days.' },
      { id:'na2', title:'Deliver Ring-Fenced Budget precedent memo',     archetype:'Content',    effort:'Medium', why:'CEO explicitly flagged "rethinking stack" — content push to anchor the conversation in CGS frame before Jul planning.' },
      { id:'na3', title:'Hold — wait for next earnings call signal',     archetype:'Passive',    effort:'None',   why:'Signal still forming. Risk: competitor fills the advisory vacuum during 8-week window.' },
    ],
  },
};

// ========= §7 Data Hub =========

window.DATA_HUB = {
  uploads: [
    { id:'u1', name:'CRM_export_Q2_2026.csv',      size:'2.4 MB', rows:84, status:'tagged',   kind:'clients' },
    { id:'u2', name:'Industry_report_Gartner.pdf', size:'11.8 MB', rows:1,  status:'tagging',  kind:'report' },
    { id:'u3', name:'Prospect_list_manufacturing.xlsx', size:'420 KB', rows:37, status:'untagged', kind:'prospects' },
  ],
  crmRows: [
    { id:'c1', name:'Acme Industrial',   industry:'Industrial',        size:'F500',  region:'NA', serviceLine:'Strategic Transformation', stage:'Retainer',        flag:null },
    { id:'c2', name:'Globex Industrial', industry:'Industrial',        size:'F500',  region:'NA', serviceLine:'IT Transformation',         stage:'Renewal',         flag:null },
    { id:'c3', name:'Initech Holdings',  industry:'Financial Services',size:'F1000', region:'NA', serviceLine:'Inertia Removal',           stage:'Active Delivery', flag:null },
    { id:'c4', name:'Umbrella Corp.',    industry:'Healthcare',        size:'F500',  region:'EMEA',serviceLine:'Enterprise Innovation',     stage:'Retainer',        flag:null },
    { id:'c5', name:'Stark Industries',  industry:'Aerospace',         size:'F100',  region:'NA', serviceLine:'Strategic Transformation', stage:'Pre-RFP',         flag:'new' },
    { id:'c6', name:'Cyberdyne Ltd.',    industry:'Technology',        size:'F1000', region:'APAC',serviceLine:'IT Transformation',         stage:'Signal',          flag:'new' },
  ],
  serviceLines: [
    { id:'st', name:'Strategic Transformation', count: 14 },
    { id:'it', name:'IT Transformation',         count: 9  },
    { id:'ei', name:'Enterprise Innovation',     count: 6  },
    { id:'ir', name:'Inertia Removal',           count: 4  },
  ],
  distribution: [
    { id:'d1', target:'Dashboard (§5)',                 ingested:84, status:'complete' },
    { id:'d2', target:'Collective Brain (§1) · indexing', ingested:84, status:'complete' },
    { id:'d3', target:'Diagnostic Agent (§2)',          ingested:84, status:'complete' },
    { id:'d4', target:'Meeting Recall (§3)',            ingested:84, status:'complete' },
    { id:'d5', target:'Continuity Agent (§6)',          ingested:84, status:'complete' },
  ],
};

window.THESIS_MEMORY = {
  before_m1: {
    dominant_logic: 'Transformation = cost program',
    cited_anchors: [
      'Globex 2018 (governance)',
    ],
    unresolved: [
      'Innovation reporting line — source of slowdown?',
      'Is the Transformation Office a permanent function?',
    ],
  },
  after_m1: {
    dominant_logic: 'Transformation = cost program, hardening into a structural pattern — CEO acknowledges capability concern but is not acting on it yet.',
    cited_anchors: [
      'Globex 2018 (governance)',
      'Globex 2018 (CDO reporting line — new)',
      'Initech 2019 (dual P&L — new)',
    ],
    unresolved: [
      'Is the Transformation Office a permanent function?',
      'AI governance inside the TO — open, 24h memo committed (new)',
    ],
  },
  diffs: [
    { kind: 'add', field: 'dominant_logic', text: '+ “hardening into a structural pattern — CEO acknowledges capability concern but is not acting on it yet.”', trigger: 'Meeting 1 · 0:24:12 — CEO on innovation reporting', source: 'Globex 2018 · CDO line analogy' },
    { kind: 'add', field: 'cited_anchors', text: '+ Globex 2018 (CDO reporting line)', trigger: 'Meeting 1 · 0:31:08 — CEO challenged the anchor', source: 'CGS-2018-GLBX-M042' },
    { kind: 'add', field: 'cited_anchors', text: '+ Initech 2019 (dual P&L)', trigger: 'Meeting 1 · 0:48:50 — CFO asked about governance model', source: 'CGS-2019-INTK-M018' },
    { kind: 'resolve', field: 'unresolved', text: '✓ Innovation reporting line — answered with Globex precedent', trigger: 'Meeting 1 · 0:34:20', source: 'CGS-2018-GLBX-M042' },
    { kind: 'add', field: 'unresolved', text: '+ AI governance inside TO — 24h memo committed', trigger: 'Meeting 1 · 0:52:40 — no-anchor question', source: '24h Memo · sent Apr 22' },
  ],
};
