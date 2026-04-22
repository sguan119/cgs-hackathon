// Claude streaming client with 4-segment prompt-cache scaffold.
//
// **API key surface note**: in Tauri (single-host install) bundled keys are
// acceptable; do not reuse this pattern for web deployments.
//
// **Stream parser scope**: Phase 1 forwards raw text deltas via `onDelta`.
// The tagged-stream grammar parser (docs/recall-stream-grammar.md) is
// Phase 2A's responsibility — deliberately not pre-implemented here.

import Anthropic from '@anthropic-ai/sdk';
import {
  buildSeg1Framework,
  buildSeg2Precedents,
  buildSeg3AcmeContext,
  buildSeg4Dynamic,
} from './segments';
import type { CacheSegmentSpec, StreamCompleteResult, StreamOptions } from './types';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
const HEARTBEAT_MAX_TOKENS = 16;
const DEFAULT_MAX_TOKENS = 1024;

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (clientInstance) return clientInstance;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it to .env.local');
  }
  clientInstance = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  return clientInstance;
}

function buildSystemBlocks(clientId: string | null): Anthropic.TextBlockParam[] {
  const blocks: Array<Readonly<CacheSegmentSpec>> = [];
  blocks.push(buildSeg1Framework());
  blocks.push(buildSeg2Precedents());
  const seg3 = buildSeg3AcmeContext(clientId);
  if (seg3) blocks.push(seg3);

  return blocks.map<Anthropic.TextBlockParam>((seg) => ({
    type: 'text',
    text: seg.text,
    ...(seg.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }));
}

export async function streamCompletion(options: StreamOptions): Promise<StreamCompleteResult> {
  const { mode, clientId, precedentIds, query, onDelta, onComplete, onError, signal } = options;

  const system = buildSystemBlocks(clientId);
  const userText = buildSeg4Dynamic(query, precedentIds);
  const defaultMax = mode === 'heartbeat' ? HEARTBEAT_MAX_TOKENS : DEFAULT_MAX_TOKENS;
  const maxTokens = options.maxTokens ?? defaultMax;

  try {
    const client = getClient();
    const stream = client.messages.stream(
      {
        model: DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userText }],
      },
      signal ? { signal } : undefined
    );

    let fullText = '';
    stream.on('text', (delta: string) => {
      fullText += delta;
      onDelta(delta);
    });

    const final = await stream.finalMessage();
    const usage: StreamCompleteResult['usage'] = {
      inputTokens: final.usage.input_tokens ?? 0,
      outputTokens: final.usage.output_tokens ?? 0,
      cacheCreationInputTokens: final.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: final.usage.cache_read_input_tokens ?? 0,
    };

    const result: StreamCompleteResult = { fullText, usage };
    onComplete(result);
    return result;
  } catch (err) {
    onError?.(err);
    throw err;
  }
}
