'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastRail } from '@/app/(floating)/recall-panel/ToastRail';
import { ApiRequiredNotice } from '@/lib/components/ApiRequiredNotice';
import { ErrorBoundary } from '@/lib/components/ErrorBoundary';
import { SupersededCard } from '@/lib/components/SupersededCard';
import { canUseClaude, isOfflineMode } from '@/lib/config/demo-mode';
import { findDim, type InertiaHypothesis, type StrategyDimensionId } from '@/lib/override/dims';
import { get } from '@/lib/store';
import initialHypothesesFixture from '../../../fixtures/diagnostic_fixtures/initial_hypotheses.json';
import { DiagnosticDocs } from './DiagnosticDocs';
import { EvidenceHealthRail } from './EvidenceHealthRail';
import { useOverrideSession } from './hooks/useOverrideSession';
import { useWheelScores } from './hooks/useWheelScores';
import { HypothesisCard } from './HypothesisCard';
import { ScoreEditor } from './ScoreEditor';
import { StrategyWheel } from './StrategyWheel';

const BASELINE_HYPOTHESES = initialHypothesesFixture as InertiaHypothesis[];

export function DiagnosticPage() {
  const { scores, setScore } = useWheelScores();
  const [clientId, setClientId] = useState<string | null>(null);
  const [editingDim, setEditingDim] = useState<StrategyDimensionId | null>(null);

  const session = useOverrideSession(clientId);

  useEffect(() => {
    let cancelled = false;
    get('current_client')
      .then((c) => {
        if (!cancelled) setClientId(c);
      })
      .catch(() => {
        /* non-Tauri dev */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const commitScore = useCallback(
    async (dim: StrategyDimensionId, next: number) => {
      // Reviewer-3 B2: WheelScores is `Partial<Record<…>>` at the type
      // level — `scores[dim]` can legally be undefined if a dim was
      // somehow dropped from the store. Fall back to 1 so
      // OverrideTurn.prevScore (typed `number`) never receives undefined.
      const prev = scores[dim] ?? 1;
      if (prev === next) {
        setEditingDim(null);
        return;
      }
      await setScore(dim, next);
      setEditingDim(null);
      // Offline guard: the score change itself is local state, but
      // the Claude-driven hypothesis re-compute needs API. Skip the
      // dispatch in offline mode; the block-level notice near the
      // wheel tells the user what's missing.
      if (!canUseClaude()) return;
      session.dispatch({ dimension: dim, prevScore: prev, nextScore: next });
    },
    [scores, setScore, session]
  );

  const handleSectorActivate = useCallback((dim: StrategyDimensionId) => {
    setEditingDim((cur) => (cur === dim ? null : dim));
  }, []);

  const handleSectorStep = useCallback(
    (dim: StrategyDimensionId, delta: 1 | -1) => {
      const prev = scores[dim] ?? 1;
      const next = Math.max(1, Math.min(7, prev + delta));
      if (next === prev) return;
      void commitScore(dim, next);
    },
    [scores, commitScore]
  );

  const editingDimObj = editingDim ? findDim(editingDim) : null;
  const active = session.activeTurn;
  const diffDone = !!active?.diff.done;
  const showingIncoming =
    !!active &&
    (active.status === 'streaming' ||
      active.status === 'hit' ||
      active.status === 'complete' ||
      active.status === 'retrying' ||
      active.status === 'pending');
  const incoming = session.incomingHypotheses;

  // Reviewer-2 B2: the baseline cards must FADE out, not vanish. Three
  // phases:
  //   'baseline'    — no override in progress; full-opacity baseline
  //   'superseded'  — override streaming; baseline rendered at 50% +
  //                   strikethrough via <SupersededCard>
  //   'fading-out'  — <done/> received; keep baseline mounted with the
  //                   `is-fading-out` class for 400 ms so the CSS opacity
  //                   transition runs, THEN unmount.
  const [baselinePhase, setBaselinePhase] = useState<
    'baseline' | 'superseded' | 'fading-out'
  >('baseline');
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showingIncoming && !diffDone) {
      setBaselinePhase('superseded');
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      return;
    }
    if (diffDone && showingIncoming) {
      setBaselinePhase('fading-out');
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setBaselinePhase('baseline');
        fadeTimerRef.current = null;
      }, 400);
      return;
    }
    setBaselinePhase('baseline');
  }, [showingIncoming, diffDone]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  return (
    <ErrorBoundary>
      <section className="page diagnostic-page">
        <div className="page-header">
          <div>
            <div className="crumb">§2 · Active engagement · Acme Industrial</div>
            <h1>
              Acme Industrial <em>— strategy diagnostic</em>
            </h1>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="tag sage">Strategy Wheel · Inertia two-class</span>
              {active && active.status !== 'aborted' && active.status !== 'failed' ? (
                <span className="tag crimson">Fellow override · {active.dimension}</span>
              ) : null}
            </div>
          </div>
          <div className="meta">D. Park · M2 · Apr 21</div>
        </div>

        <div className="grid doc-grid" style={{ marginBottom: 24 }}>
          <DiagnosticDocs />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {isOfflineMode() && !canUseClaude() ? (
              <ApiRequiredNotice service="anthropic" size="block" />
            ) : null}
            <div className="card">
              <div className="card-h">
                <div className="t">Strategy Wheel</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="tag">variant A</span>
                  {active && active.status !== 'aborted' && active.status !== 'failed' ? (
                    <span className="tag crimson">Override</span>
                  ) : null}
                </div>
              </div>
              <div className="card-b" style={{ position: 'relative' }}>
                <StrategyWheel
                  scores={scores}
                  editingDim={editingDim}
                  onSectorActivate={handleSectorActivate}
                  onScoreStep={handleSectorStep}
                />
                {editingDimObj ? (
                  <ScoreEditor
                    dim={editingDimObj}
                    currentScore={scores[editingDimObj.id]}
                    onCommit={(n) => void commitScore(editingDimObj.id, n)}
                    onCancel={() => setEditingDim(null)}
                  />
                ) : null}
                {active && active.diff.rationale ? (
                  <div className="override-rationale">
                    <span className="override-rationale-kicker">
                      Override · {findDim(active.dimension)?.short ?? active.dimension}
                    </span>
                    <div className="override-rationale-body">{active.diff.rationale}</div>
                  </div>
                ) : null}
              </div>
            </div>
            <EvidenceHealthRail />
          </div>
        </div>

        <div style={{ marginTop: 10, marginBottom: 14 }}>
          <div
            className="crumb"
            style={{ letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}
          >
            Inertia hypotheses
          </div>
          <hr className="rule thick" style={{ margin: '4px 0 18px' }} />
        </div>

        <div className="grid two-col hypothesis-grid">
          {baselinePhase !== 'baseline'
            ? BASELINE_HYPOTHESES.map((h) => (
                <div key={`baseline-${h.id}`}>
                  <SupersededCard fadingOut={baselinePhase === 'fading-out'}>
                    <HypothesisCard mode="baseline" hypothesis={h} />
                  </SupersededCard>
                </div>
              ))
            : null}
          {baselinePhase === 'baseline' && !showingIncoming
            ? BASELINE_HYPOTHESES.map((h) => (
                <div key={`baseline-${h.id}`}>
                  <HypothesisCard mode="baseline" hypothesis={h} />
                </div>
              ))
            : null}
          {showingIncoming
            ? incoming.map((h, i) => (
                <HypothesisCard
                  key={`incoming-${h.id ?? i}`}
                  mode="incoming"
                  hypothesis={h}
                />
              ))
            : null}
        </div>

        <div className="recall-footer" style={{ borderTop: 'none', padding: '16px 0 0' }}>
          <ToastRail entries={session.toasts} onDismiss={session.dismissToast} />
        </div>
      </section>
    </ErrorBoundary>
  );
}
