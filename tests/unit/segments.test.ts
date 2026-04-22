import { describe, it, expect } from 'vitest';
import {
  buildSeg1Framework,
  buildSeg2Precedents,
  buildSeg3AcmeContext,
} from '@/lib/llm/segments';

describe('segment memoization', () => {
  it('buildSeg1Framework returns the same reference on repeated calls', () => {
    const a = buildSeg1Framework();
    const b = buildSeg1Framework();
    expect(a).toBe(b);
  });

  it('buildSeg2Precedents returns the same reference on repeated calls', () => {
    const a = buildSeg2Precedents();
    const b = buildSeg2Precedents();
    expect(a).toBe(b);
  });

  it('buildSeg3AcmeContext returns same reference for same clientId', () => {
    const a = buildSeg3AcmeContext('acme');
    const b = buildSeg3AcmeContext('acme');
    expect(a).toBe(b);
  });

  it('buildSeg3AcmeContext returns null for non-acme clientId', () => {
    expect(buildSeg3AcmeContext('other')).toBeNull();
    expect(buildSeg3AcmeContext(null)).toBeNull();
  });

  it('buildSeg3AcmeContext returns different ref for different clientId (null vs acme)', () => {
    const acme = buildSeg3AcmeContext('acme');
    const none = buildSeg3AcmeContext(null);
    expect(acme).not.toBe(none);
  });
});
