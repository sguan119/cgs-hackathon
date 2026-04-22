// LLM client types. Keeps the `streamCompletion` surface and cache-hit
// bookkeeping decoupled from the SDK's shape so we can swap providers later
// without rewriting callers.

export type StreamMode = 'recall' | 'override' | 'heartbeat';

export type CacheUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

export type StreamCompleteResult = {
  fullText: string;
  usage: CacheUsage;
};

export type StreamOptions = {
  mode: StreamMode;
  clientId: string | null;
  precedentIds?: string[];
  query?: string;
  // Gen scripts override to 2048 / 4096 so long JSON outputs don't truncate
  // mid-struct (B1). When omitted, the mode-based default applies.
  maxTokens?: number;
  onDelta: (_textDelta: string) => void;
  onComplete: (_result: StreamCompleteResult) => void;
  onError?: (_err: unknown) => void;
  signal?: AbortSignal;
};

export type CacheSegmentSpec = {
  text: string;
  cache: boolean;
};
