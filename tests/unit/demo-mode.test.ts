import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  canUseClaude,
  canUseOpenAIEmbed,
  hasAnthropicKey,
  hasOpenAIKey,
  isOfflineMode,
  offlineReason,
} from '@/lib/config/demo-mode';

const KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'NEXT_PUBLIC_DEMO_MODE'] as const;

function setEnv(patch: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
  for (const k of KEYS) {
    if (k in patch) {
      const v = patch[k];
      if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
      else (process.env as Record<string, string>)[k] = v;
    }
  }
}

describe('demo-mode', () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) snapshot[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of KEYS) setEnv({ [k]: snapshot[k] });
  });

  it('real keys → live mode', () => {
    setEnv({
      ANTHROPIC_API_KEY: 'sk-ant-real123',
      OPENAI_API_KEY: 'sk-real456',
      NEXT_PUBLIC_DEMO_MODE: undefined,
    });
    expect(hasAnthropicKey()).toBe(true);
    expect(hasOpenAIKey()).toBe(true);
    expect(isOfflineMode()).toBe(false);
    expect(canUseClaude()).toBe(true);
    expect(canUseOpenAIEmbed()).toBe(true);
    expect(offlineReason()).toBeNull();
  });

  it('placeholder keys → offline', () => {
    setEnv({
      ANTHROPIC_API_KEY: 'sk-ant-REPLACE_ME',
      OPENAI_API_KEY: 'sk-REPLACE_ME',
      NEXT_PUBLIC_DEMO_MODE: undefined,
    });
    expect(hasAnthropicKey()).toBe(false);
    expect(hasOpenAIKey()).toBe(false);
    expect(isOfflineMode()).toBe(true);
    expect(canUseClaude()).toBe(false);
    expect(canUseOpenAIEmbed()).toBe(false);
    expect(offlineReason()).toBe('missing-both');
  });

  it('empty string keys → offline (missing-both)', () => {
    setEnv({ ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', NEXT_PUBLIC_DEMO_MODE: undefined });
    expect(isOfflineMode()).toBe(true);
    expect(offlineReason()).toBe('missing-both');
  });

  it('undefined keys → offline', () => {
    setEnv({ ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined, NEXT_PUBLIC_DEMO_MODE: undefined });
    expect(isOfflineMode()).toBe(true);
    expect(offlineReason()).toBe('missing-both');
  });

  it('only anthropic missing → missing-anthropic', () => {
    setEnv({
      ANTHROPIC_API_KEY: 'sk-ant-REPLACE_ME',
      OPENAI_API_KEY: 'sk-real',
      NEXT_PUBLIC_DEMO_MODE: undefined,
    });
    expect(isOfflineMode()).toBe(true);
    expect(offlineReason()).toBe('missing-anthropic');
  });

  it('only openai missing → missing-openai', () => {
    setEnv({
      ANTHROPIC_API_KEY: 'sk-ant-real',
      OPENAI_API_KEY: '',
      NEXT_PUBLIC_DEMO_MODE: undefined,
    });
    expect(isOfflineMode()).toBe(true);
    expect(offlineReason()).toBe('missing-openai');
  });

  it('explicit NEXT_PUBLIC_DEMO_MODE=offline wins over real keys', () => {
    setEnv({
      ANTHROPIC_API_KEY: 'sk-ant-real',
      OPENAI_API_KEY: 'sk-real',
      NEXT_PUBLIC_DEMO_MODE: 'offline',
    });
    expect(hasAnthropicKey()).toBe(true);
    expect(hasOpenAIKey()).toBe(true);
    expect(isOfflineMode()).toBe(true);
    expect(canUseClaude()).toBe(false);
    expect(canUseOpenAIEmbed()).toBe(false);
    expect(offlineReason()).toBe('explicit');
  });

  it('whitespace-only key is treated as missing', () => {
    setEnv({
      ANTHROPIC_API_KEY: '   ',
      OPENAI_API_KEY: 'sk-real',
      NEXT_PUBLIC_DEMO_MODE: undefined,
    });
    expect(hasAnthropicKey()).toBe(false);
    expect(isOfflineMode()).toBe(true);
  });
});
