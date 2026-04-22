import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireEnv, loadEnv, __resetEnvForTests } from '@/scripts/lib/env';

describe('requireEnv', () => {
  beforeEach(() => {
    __resetEnvForTests();
  });

  afterEach(() => {
    delete process.env['TEST_REQUIRED_KEY'];
    delete process.env['TEST_EMPTY_KEY'];
    __resetEnvForTests();
  });

  it('returns the value when the env var is present', () => {
    process.env['TEST_REQUIRED_KEY'] = 'test-value-123';
    const result = requireEnv('TEST_REQUIRED_KEY', 'gen:test');
    expect(result).toBe('test-value-123');
  });

  it('throws when the env var is missing', () => {
    delete process.env['TEST_REQUIRED_KEY'];
    expect(() => requireEnv('TEST_REQUIRED_KEY', 'gen:test')).toThrow('TEST_REQUIRED_KEY');
  });

  it('throws when the env var is empty string', () => {
    process.env['TEST_EMPTY_KEY'] = '';
    expect(() => requireEnv('TEST_EMPTY_KEY', 'gen:test')).toThrow('TEST_EMPTY_KEY');
  });

  it('error message includes script label and missing key name', () => {
    delete process.env['TEST_REQUIRED_KEY'];
    expect(() => requireEnv('TEST_REQUIRED_KEY', 'gen:diagnostic')).toThrow(/gen:diagnostic/);
    expect(() => {
      __resetEnvForTests();
      requireEnv('TEST_REQUIRED_KEY', 'gen:diagnostic');
    }).toThrow(/TEST_REQUIRED_KEY/);
  });

  it('error message mentions .env.local.example', () => {
    delete process.env['TEST_REQUIRED_KEY'];
    expect(() => requireEnv('TEST_REQUIRED_KEY', 'gen:test')).toThrow(/\.env\.local\.example/);
  });
});

describe('loadEnv', () => {
  beforeEach(() => {
    __resetEnvForTests();
  });

  afterEach(() => {
    __resetEnvForTests();
  });

  it('does not throw when .env.local does not exist (non-existent path)', () => {
    expect(() => loadEnv('/nonexistent/path/to/.env.local')).not.toThrow();
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => {
      loadEnv('/nonexistent/.env.local');
      __resetEnvForTests();
      loadEnv('/nonexistent/.env.local');
    }).not.toThrow();
  });
});
