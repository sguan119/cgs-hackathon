// Cross-window event bus — single source of truth for event names + payload
// types. Use `emit` / `listen` from this module rather than importing Tauri
// event APIs directly so the payload contract stays enforced.

import { emit as tauriEmit, listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';
import type { MainMovePayload, MainResizePayload, ShellMode } from './shell/types';

export const EVENTS = {
  MEETING_START: 'meeting:start',
  MEETING_END: 'meeting:end',
  RECALL_QUERY_COMPLETE: 'recall:query_complete',
  // Phase 2D shell events — main-window move/resize emitted by Rust;
  // mode transitions emitted by the follow-coordinator; quit + reattach
  // request flow across windows.
  SHELL_MAIN_MOVED: 'shell:main_moved',
  SHELL_MAIN_RESIZED: 'shell:main_resized',
  SHELL_MODE_CHANGED: 'shell:mode_changed',
  SHELL_APP_QUIT: 'shell:app_quit',
  SHELL_REATTACH_REQUESTED: 'shell:reattach_requested',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export type EventPayloads = {
  [EVENTS.MEETING_START]: { client_id: string };
  [EVENTS.MEETING_END]: Record<string, never>;
  [EVENTS.RECALL_QUERY_COMPLETE]: { query: string; precedent_id: string };
  [EVENTS.SHELL_MAIN_MOVED]: MainMovePayload;
  [EVENTS.SHELL_MAIN_RESIZED]: MainResizePayload;
  [EVENTS.SHELL_MODE_CHANGED]: { mode: ShellMode };
  [EVENTS.SHELL_APP_QUIT]: Record<string, never>;
  [EVENTS.SHELL_REATTACH_REQUESTED]: Record<string, never>;
};

export async function emit<N extends EventName>(name: N, payload: EventPayloads[N]): Promise<void> {
  await tauriEmit(name, payload);
}

export async function listen<N extends EventName>(
  name: N,
  cb: (_payload: EventPayloads[N]) => void
): Promise<UnlistenFn> {
  return tauriListen<EventPayloads[N]>(name, (event) => cb(event.payload));
}
