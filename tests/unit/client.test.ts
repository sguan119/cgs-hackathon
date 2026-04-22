import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Anthropic SDK so streamCompletion's SDK shape is controllable
// without a real API key.
const streamCallArgs: Array<Record<string, unknown>> = [];

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    messages: {
      stream: (
        args: Record<string, unknown>
      ) => {
        on: (_ev: string, _cb: (_d: string) => void) => void;
        finalMessage: () => Promise<{
          usage: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens: number;
            cache_read_input_tokens: number;
          };
        }>;
      };
    };
    constructor(_opts: unknown) {
      this.messages = {
        stream: (args) => {
          streamCallArgs.push(args);
          return {
            on: (_ev: string, _cb: (_d: string) => void) => {},
            finalMessage: async () => ({
              usage: {
                input_tokens: 1,
                output_tokens: 1,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
              },
            }),
          };
        },
      };
    }
  }
  return { default: Anthropic };
});

describe('streamCompletion maxTokens override', () => {
  beforeEach(() => {
    streamCallArgs.length = 0;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('passes options.maxTokens through to messages.stream when provided', async () => {
    const { streamCompletion } = await import('@/lib/llm/client');
    await streamCompletion({
      mode: 'override',
      clientId: 'acme',
      query: 'hi',
      maxTokens: 4096,
      onDelta: () => {},
      onComplete: () => {},
    });
    expect(streamCallArgs).toHaveLength(1);
    expect(streamCallArgs[0]!['max_tokens']).toBe(4096);
  });

  it('falls back to the mode-based default when maxTokens is omitted', async () => {
    const { streamCompletion } = await import('@/lib/llm/client');
    await streamCompletion({
      mode: 'recall',
      clientId: 'acme',
      query: 'hi',
      onDelta: () => {},
      onComplete: () => {},
    });
    expect(streamCallArgs[0]!['max_tokens']).toBe(1024); // DEFAULT_MAX_TOKENS
  });

  it('heartbeat mode uses HEARTBEAT_MAX_TOKENS (16) when maxTokens is omitted', async () => {
    const { streamCompletion } = await import('@/lib/llm/client');
    await streamCompletion({
      mode: 'heartbeat',
      clientId: 'acme',
      query: 'ping',
      onDelta: () => {},
      onComplete: () => {},
    });
    expect(streamCallArgs[0]!['max_tokens']).toBe(16);
  });

  it('explicit maxTokens overrides heartbeat default', async () => {
    const { streamCompletion } = await import('@/lib/llm/client');
    await streamCompletion({
      mode: 'heartbeat',
      clientId: 'acme',
      query: 'ping',
      maxTokens: 512,
      onDelta: () => {},
      onComplete: () => {},
    });
    expect(streamCallArgs[0]!['max_tokens']).toBe(512);
  });

  it('model field reaches messages.stream call', async () => {
    const { streamCompletion } = await import('@/lib/llm/client');
    await streamCompletion({
      mode: 'recall',
      clientId: 'acme',
      query: 'hi',
      onDelta: () => {},
      onComplete: () => {},
    });
    expect(typeof streamCallArgs[0]!['model']).toBe('string');
    expect((streamCallArgs[0]!['model'] as string).length).toBeGreaterThan(0);
  });

  it('onComplete receives fullText and usage', async () => {
    const { streamCompletion } = await import('@/lib/llm/client');
    let captured: unknown = null;
    await streamCompletion({
      mode: 'recall',
      clientId: 'acme',
      query: 'hi',
      onDelta: () => {},
      onComplete: (r) => { captured = r; },
    });
    expect(captured).toMatchObject({
      fullText: expect.any(String),
      usage: expect.objectContaining({ inputTokens: expect.any(Number) }),
    });
  });
});
