'use client';

import callFixture from '../../../fixtures/diagnostic_fixtures/call.json';
import memoFixture from '../../../fixtures/diagnostic_fixtures/memo.json';
import orgFixture from '../../../fixtures/diagnostic_fixtures/org.json';

type MemoSentence = {
  id: string;
  text: string;
  dim: string;
  conflict: boolean;
};

type MemoDoc = {
  title: string;
  author: string;
  date: string;
  sentences: MemoSentence[];
};

type OrgDoc = {
  title: string;
  nodes: Array<{ id: string; label: string; parent?: string; lvl?: number }>;
};

type CallSpeaker = { who: string; line: string; dim?: string; conflict?: boolean };

type CallDoc = {
  title: string;
  speakers: CallSpeaker[];
};

const memo = memoFixture as MemoDoc;
const org = orgFixture as OrgDoc;
const call = callFixture as CallDoc;

export function DiagnosticDocs() {
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Source documents</div>
        <span className="tag sage">3 files · tagged</span>
      </div>
      <div className="card-b" style={{ padding: 0 }}>
        <div className="diagnostic-doc">
          <div className="diagnostic-doc-kicker">
            Fixture · CEO Memo ·{' '}
            <span style={{ color: 'var(--crimson-ink)' }}>fictional · demo-only</span>
          </div>
          <div className="diagnostic-doc-title">{memo.title}</div>
          <div className="diagnostic-doc-meta">
            {memo.author} · {memo.date}
          </div>
          <div className="diagnostic-doc-body">
            {memo.sentences.map((s) => (
              <span key={s.id} className={`diagnostic-memo-span${s.conflict ? ' conflict' : ''}`}>
                {s.text}{' '}
              </span>
            ))}
          </div>
        </div>
        <div className="diagnostic-doc">
          <div className="diagnostic-doc-kicker">Fixture · Org Structure</div>
          <div className="diagnostic-doc-title">{org.title}</div>
          {org.nodes.length === 0 ? (
            <div className="diagnostic-doc-placeholder">
              Phase 3.2 content owner fills the org tree from acme_fixtures.
            </div>
          ) : (
            <ul>
              {org.nodes.map((n) => (
                <li key={n.id}>{n.label}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="diagnostic-doc">
          <div className="diagnostic-doc-kicker">Fixture · Earnings Transcript</div>
          <div className="diagnostic-doc-title">{call.title}</div>
          {call.speakers.length === 0 ? (
            <div className="diagnostic-doc-placeholder">
              Phase 3.2 content owner fills the transcript from acme_fixtures.
            </div>
          ) : (
            <ul>
              {call.speakers.map((s, i) => (
                <li key={`${s.who}-${i}`}>
                  <strong>{s.who}:</strong> {s.line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
