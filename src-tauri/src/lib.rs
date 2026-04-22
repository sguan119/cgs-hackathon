// Tauri application entry — wires core plugins for the two-window shell.
//
// Windows are declared statically in `tauri.conf.json`:
//   - `main`   — visible at boot, 1440x900, decorated
//   - `recall` — hidden at boot; shown by `meeting:start` event (frontend)
//
// Vibrancy note: on Windows WebView2, `transparent: true` does not produce
// native vibrancy. The `/recall-panel/layout.tsx` route applies a solid
// semi-opaque paper background as a deliberate fallback
// (architecture.md R9).
//
// Phase 2D — window event wiring:
//   - Main-window Moved/Resized → emit `shell:main_moved` /
//     `shell:main_resized`, throttled at 16ms via a Mutex<Instant> last-
//     emit guard. Trailing-edge timing is acceptable because the final
//     settled frame always emits (mouse-up produces no further moves);
//     the JS follow-coordinator adds a second 16ms debounce on top.
//   - Main-window CloseRequested → emit `shell:app_quit`, do NOT call
//     `api.prevent_close()`. JS-side cleanup is best-effort within ~100ms
//     before Tauri tears down naturally.
//   - DO NOT listen for `Minimized` — plan §5.3 invariant: the recall
//     panel is the Fellow's workspace and must stay visible when the
//     main workbench is tucked into the taskbar.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::json;
use tauri::{Emitter, Manager, WindowEvent};

const MAIN_LABEL: &str = "main";
const THROTTLE_MS: u64 = 16;

// Shared throttle for Moved + Resized — OS drag vs corner-resize don't
// interleave, so 16ms applied across both is demo-safe.
struct MainMoveThrottle {
    last_emit: Mutex<Instant>,
}

fn should_emit(throttle: &MainMoveThrottle) -> bool {
    let mut guard = match throttle.last_emit.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };
    let now = Instant::now();
    if now.duration_since(*guard) >= Duration::from_millis(THROTTLE_MS) {
        *guard = now;
        true
    } else {
        false
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // One throttle state per process. Seed the last-emit timestamp
            // at `now - 2 × THROTTLE_MS` so the first real move/resize
            // passes the `>= THROTTLE_MS` check even with sub-millisecond
            // clock jitter between `setup` and the first event dispatch.
            app.manage(MainMoveThrottle {
                last_emit: Mutex::new(Instant::now() - Duration::from_millis(THROTTLE_MS * 2)),
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // Only main-window events participate in shell wiring. Recall
            // emits are ignored so our own programmatic reposition doesn't
            // feed back into the state machine.
            if window.label() != MAIN_LABEL {
                return;
            }
            match event {
                WindowEvent::Moved(pos) => {
                    let app = window.app_handle();
                    if let Some(throttle) = app.try_state::<MainMoveThrottle>() {
                        if should_emit(&throttle) {
                            let _ = app.emit(
                                "shell:main_moved",
                                json!({ "x": pos.x, "y": pos.y }),
                            );
                        }
                    }
                }
                WindowEvent::Resized(size) => {
                    let app = window.app_handle();
                    if let Some(throttle) = app.try_state::<MainMoveThrottle>() {
                        if should_emit(&throttle) {
                            let _ = app.emit(
                                "shell:main_resized",
                                json!({ "width": size.width, "height": size.height }),
                            );
                        }
                    }
                }
                WindowEvent::CloseRequested { .. } => {
                    // Best-effort: give JS a ~100ms window to run
                    // disposeAll before Tauri tears down. We do NOT call
                    // api.prevent_close() — the app exits normally.
                    let _ = window.app_handle().emit("shell:app_quit", json!({}));
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running CGS Advisors demo");
}
