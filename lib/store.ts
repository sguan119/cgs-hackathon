// Typed wrapper around `tauri-plugin-store` that brokers cross-window state
// via a single file (`session.json`). The schema is closed — any key not in
// `SessionStore` is rejected by TypeScript.
//
// SSR / hydration rule: Tauri APIs only exist in the webview runtime. All
// callers must guard with `typeof window !== 'undefined'` and perform reads
// inside `useEffect`; initial component state should fall back to schema
// defaults.

import { load, type Store } from '@tauri-apps/plugin-store';

export type WheelScore = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MeetingState = 'idle' | 'in_meeting' | 'post_meeting';
export type ThesisDiffState = 'before_m1' | 'before_m2';

export type RecallHistoryEntry = {
  query: string;
  precedent_id: string | null;
  ts: number;
};

export type SessionStore = {
  current_client: string | null;
  meeting_state: MeetingState;
  recall_history: RecallHistoryEntry[];
  thesis_diff_state: ThesisDiffState;
  wheel_scores: Record<string, WheelScore>;
};

export const SESSION_DEFAULTS: SessionStore = {
  current_client: null,
  meeting_state: 'idle',
  recall_history: [],
  thesis_diff_state: 'before_m1',
  wheel_scores: {},
};

export type Unlisten = () => void;

const STORE_FILE = 'session.json';

let storePromise: Promise<Store> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

async function getStore(): Promise<Store> {
  if (!isBrowser()) {
    throw new Error('lib/store: called outside the webview runtime');
  }
  if (!storePromise) {
    storePromise = load(STORE_FILE, {
      autoSave: true,
      defaults: SESSION_DEFAULTS as Record<string, unknown>,
    });
  }
  return storePromise;
}

export async function get<K extends keyof SessionStore>(key: K): Promise<SessionStore[K]> {
  const store = await getStore();
  const value = await store.get<SessionStore[K]>(key);
  // Only fall back on `undefined` (key never written). `null` is a
  // legitimate stored value for `current_client` and must be preserved.
  if (value === undefined) {
    return SESSION_DEFAULTS[key];
  }
  return value;
}

export async function set<K extends keyof SessionStore>(
  key: K,
  value: SessionStore[K]
): Promise<void> {
  const store = await getStore();
  await store.set(key, value);
  await store.save();
}

// Debounce per-key change notifications via microtask so bursty writes
// (e.g. Phase 2B wheel updates) collapse into one cb invocation.
export async function subscribe<K extends keyof SessionStore>(
  key: K,
  cb: (_value: SessionStore[K]) => void
): Promise<Unlisten> {
  const store = await getStore();
  let pending: { value: SessionStore[K] } | null = null;
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    if (!pending) return;
    const { value } = pending;
    pending = null;
    cb(value);
  };

  const unlisten = await store.onKeyChange<SessionStore[K]>(key, (value) => {
    // Only substitute the default when the plugin reports `undefined`
    // (key unset). `null` is a legitimate stored value.
    const next = value === undefined ? SESSION_DEFAULTS[key] : value;
    pending = { value: next };
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  });

  return unlisten;
}

export async function resetSession(): Promise<void> {
  const store = await getStore();
  for (const key of Object.keys(SESSION_DEFAULTS) as Array<keyof SessionStore>) {
    await store.set(key, SESSION_DEFAULTS[key]);
  }
  await store.save();
}
