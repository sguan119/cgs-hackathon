// Phase 2D shell types — follow/detach state machine contract.
//
// The coordinator lives as an in-process singleton in the `main` window.
// Recall mirrors its `mode` via `SHELL_MODE_CHANGED` events.
// Deliberately NOT persisted in SessionStore — shell geometry is ephemeral
// per-session state; persisting a detached layout from a prior demo would
// be a footgun on a cold boot where window bounds no longer exist.

/**
 * Positioning contract between main and recall windows.
 * - 'follow'   : recall tracks main on move/resize via repositionToMainRight()
 * - 'detached' : user has manually dragged recall; coordinator stops
 *                repositioning until reattach() fires or meeting:start
 *                forces a clean slate.
 */
export type ShellMode = 'follow' | 'detached';

export type MainMovePayload = {
  x: number; // outer physical x
  y: number; // outer physical y
};

export type MainResizePayload = {
  width: number; // outer physical width
  height: number; // outer physical height
};

export type FollowCoordinatorState = {
  mode: ShellMode;
  /** monotonically increasing; bumped on every mode transition */
  rev: number;
  /** timestamp (ms) of the last programmatic reposition — used by drift detector */
  lastProgrammaticRepositionAt: number | null;
  /** expected recall outer position after the last reposition (for drift comparison) */
  lastExpectedPosition: { x: number; y: number } | null;
};

export type FollowCoordinatorHandle = {
  getState(): FollowCoordinatorState;
  subscribe(_cb: (_s: FollowCoordinatorState) => void): () => void;
  reattach(): Promise<void>;
  dispose(): Promise<void>;
};

export type StartOptions = {
  /** Optional debounce window for batching move/resize reposition calls. Default: 16ms. */
  repositionDebounceMs?: number;
  /** Drift threshold (physical px) beyond which a recall-position delta is read as "user drag". Default: 30. */
  driftThresholdPx?: number;
  /** Drift inspection window (ms) after the last programmatic reposition. Default: 200. */
  driftWindowMs?: number;
};

export type CoordinatorDeps = {
  emitMode: (_mode: ShellMode) => void;
  reposition: () => Promise<void>;
  readExpected: () => Promise<{ x: number; y: number } | null>;
  readActual: () => Promise<{ x: number; y: number } | null>;
  now: () => number;
  setTimer: (_cb: () => void, _ms: number) => unknown;
  clearTimer: (_h: unknown) => void;
  opts: Required<StartOptions>;
};
