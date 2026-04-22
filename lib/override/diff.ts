// Pure reducer that folds a stream of OverrideStreamEvent into a
// render-ready DiffState. DiagnosticPage uses this to transition from
// baseline hypotheses to the override's incoming set as the Claude stream
// arrives.
//
// Invariants per plan §5.5:
//  - `hypothesis_start` opens an active Partial<InertiaHypothesis> slot.
//  - per-field tags mutate the active slot (or `rationale`).
//  - `hypothesis_end` promotes active → incoming[] and clears active.
//  - `done` flips `done: true`. A `done` without a matching
//    `hypothesis_end` discards the half-built active slot (plan §4.4).

import type {
  InertiaEvidence,
  InertiaHypothesis,
  InertiaKind,
} from './dims';
import type { OverrideStreamEvent } from './override-parser';

export type DiffState = {
  rationale: string | null;
  incoming: Partial<InertiaHypothesis>[];
  active: Partial<InertiaHypothesis> | null;
  done: boolean;
};

export const INITIAL_DIFF_STATE: Readonly<DiffState> = Object.freeze({
  rationale: null,
  incoming: [],
  active: null,
  done: false,
});

function cloneActive(
  active: Partial<InertiaHypothesis> | null
): Partial<InertiaHypothesis> | null {
  if (!active) return null;
  return {
    ...active,
    evidence: active.evidence ? [...active.evidence] : undefined,
    intervention_ids: active.intervention_ids ? [...active.intervention_ids] : undefined,
  };
}

// Evidence accumulates in lockstep: every `evidence_quote` event pairs
// with a subsequent `evidence_source`. If a source arrives before a quote
// we stash it on the pending record so the pairing stays deterministic.
function pushEvidenceQuote(
  active: Partial<InertiaHypothesis>,
  quote: string
): void {
  const evs = active.evidence ?? [];
  const last = evs[evs.length - 1];
  if (last && !last.quote) {
    evs[evs.length - 1] = { source_id: last.source_id, quote };
  } else {
    evs.push({ source_id: '', quote } as InertiaEvidence);
  }
  active.evidence = evs;
}

function pushEvidenceSource(
  active: Partial<InertiaHypothesis>,
  source: string
): void {
  const evs = active.evidence ?? [];
  const last = evs[evs.length - 1];
  if (last && !last.source_id) {
    evs[evs.length - 1] = { source_id: source, quote: last.quote };
  } else {
    evs.push({ source_id: source, quote: '' } as InertiaEvidence);
  }
  active.evidence = evs;
}

function pushIntervention(
  active: Partial<InertiaHypothesis>,
  id: string
): void {
  const ids = active.intervention_ids ?? [];
  ids.push(id);
  active.intervention_ids = ids;
}

export function reduceDiff(state: DiffState, ev: OverrideStreamEvent): DiffState {
  if (!ev.isComplete) {
    // Partial events drive fade-in on the UI but do not mutate the diff
    // state — the DiagnosticPage tracks partial text in a sibling slot.
    return state;
  }

  switch (ev.field) {
    case 'rationale':
      return { ...state, rationale: String(ev.value) };

    case 'hypothesis_start': {
      const id = String(ev.value);
      return {
        ...state,
        active: { id, evidence: [], intervention_ids: [] },
      };
    }

    case 'kind': {
      if (!state.active) return state;
      const kind = String(ev.value) as InertiaKind;
      const active = cloneActive(state.active)!;
      active.kind = kind;
      return { ...state, active };
    }

    case 'label': {
      if (!state.active) return state;
      const active = cloneActive(state.active)!;
      active.label = String(ev.value);
      return { ...state, active };
    }

    case 'statement': {
      if (!state.active) return state;
      const active = cloneActive(state.active)!;
      active.statement = String(ev.value);
      return { ...state, active };
    }

    case 'confidence': {
      if (!state.active) return state;
      const raw = String(ev.value).trim();
      const n = Number(raw);
      const active = cloneActive(state.active)!;
      if (!Number.isNaN(n)) active.confidence = n;
      return { ...state, active };
    }

    case 'evidence_quote': {
      if (!state.active) return state;
      const active = cloneActive(state.active)!;
      pushEvidenceQuote(active, String(ev.value));
      return { ...state, active };
    }

    case 'evidence_source': {
      if (!state.active) return state;
      const active = cloneActive(state.active)!;
      pushEvidenceSource(active, String(ev.value));
      return { ...state, active };
    }

    case 'intervention_id': {
      if (!state.active) return state;
      const active = cloneActive(state.active)!;
      pushIntervention(active, String(ev.value));
      return { ...state, active };
    }

    case 'hypothesis_end': {
      if (!state.active) return state;
      return {
        ...state,
        incoming: [...state.incoming, state.active],
        active: null,
      };
    }

    case 'done': {
      // A done mid-hypothesis discards the half-built active slot — the
      // turn closes without rendering an incomplete card (plan §4.4).
      return { ...state, active: null, done: true };
    }

    default:
      return state;
  }
}
