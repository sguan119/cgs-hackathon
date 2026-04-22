// Single source of truth for "do we have live LLM access right now".
//
// Two triggers for offline mode:
//   1. Auto-detect  — ANTHROPIC_API_KEY or OPENAI_API_KEY is missing, empty,
//      or still the `.env.local.example` placeholder (`*REPLACE_ME*`).
//   2. Explicit     — NEXT_PUBLIC_DEMO_MODE=offline, regardless of keys.
//
// Auto-detect keeps the `pnpm dev` zero-config launch story working: the
// launcher seeds .env.local from the example and the app boots straight
// into offline mode without the user touching anything. Explicit override
// exists so devs with real keys can verify the gates locally.
//
// All `process.env.*` reads here are inlined at build time by next.config.js
// and resolve to `undefined` when the var was missing at build. That is the
// intended UX — do not try to read keys at runtime, the static export
// would not have them anyway.

const PLACEHOLDER = /REPLACE_ME/i;

function isLiveKey(value: string | undefined): boolean {
  if (!value) return false;
  if (value.trim() === '') return false;
  if (PLACEHOLDER.test(value)) return false;
  return true;
}

export function hasAnthropicKey(): boolean {
  return isLiveKey(process.env.ANTHROPIC_API_KEY);
}

export function hasOpenAIKey(): boolean {
  return isLiveKey(process.env.OPENAI_API_KEY);
}

export function isOfflineMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'offline') return true;
  // Auto-offline when either key is unusable. Rationale: Claude streaming
  // is the dominant real path; without it the demo can't do Recall or
  // Override regardless of OpenAI. We mirror the same for OpenAI so free-
  // text Recall degrades cleanly. Users with only one key can set
  // NEXT_PUBLIC_DEMO_MODE=live to force the opposite (not supported — if
  // you need partial live, fill both keys).
  return !hasAnthropicKey() || !hasOpenAIKey();
}

export function canUseClaude(): boolean {
  return !isOfflineMode() && hasAnthropicKey();
}

export function canUseOpenAIEmbed(): boolean {
  return !isOfflineMode() && hasOpenAIKey();
}

export type OfflineReason =
  | 'explicit'
  | 'missing-anthropic'
  | 'missing-openai'
  | 'missing-both'
  | null;

export function offlineReason(): OfflineReason {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'offline') return 'explicit';
  const a = hasAnthropicKey();
  const o = hasOpenAIKey();
  if (!a && !o) return 'missing-both';
  if (!a) return 'missing-anthropic';
  if (!o) return 'missing-openai';
  return null;
}
