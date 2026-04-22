// Phase 2D shell cleanup — centralized teardown registry.
//
// Single entry point callable from:
//   - BootEffects useEffect cleanup (dev-time HMR + unmount safety)
//   - SHELL_APP_QUIT event handler (Rust → JS on app exit)
//
// Quit budget: Rust emits SHELL_APP_QUIT then lets Tauri continue with
// the close (no prevent_close). Empirically, unregistering one global
// shortcut + unlistening a handful of event handlers + coordinator
// dispose runs in <5ms on a warm webview — well within the 100ms
// best-effort window documented in plan §4.5.
//
// Sequential-with-catch (not Promise.all): some disposers depend on
// being flushed in a known order, and a failing disposer must not block
// the rest. Simpler than promise-plumbing and safely within the budget.

type Disposable = () => Promise<void> | void;

let disposables: Disposable[] = [];
let cleanedUp = false;

export function registerDisposable(fn: Disposable): void {
  if (cleanedUp) return; // race: registration after disposeAll started is a no-op
  disposables.push(fn);
}

export async function disposeAll(_reason: 'unmount' | 'app_quit'): Promise<void> {
  if (cleanedUp) return; // idempotent
  cleanedUp = true;
  const list = disposables;
  disposables = [];
  for (const fn of list) {
    try {
      await fn();
    } catch (err) {
      // swallow — teardown must finish even if one disposer throws
      // eslint-disable-next-line no-console
      console.warn('[shell/cleanup] disposer failed', err);
    }
  }
}

/** @internal — test-only */
export function resetCleanupForTest(): void {
  disposables = [];
  cleanedUp = false;
}

/** @internal — test-only */
export function isCleanedUpForTest(): boolean {
  return cleanedUp;
}
