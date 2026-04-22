'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { TrafficLight } from '@/lib/components/TrafficLight';
import { pingAnthropic, pingOpenAI, type PingResult } from '@/lib/preflight/ping';

type ServiceKey = 'anthropic' | 'openai';

type ServiceState = {
  status: 'idle' | 'checking' | 'ok' | 'fail';
  latencyMs: number;
  error?: string;
};

const INITIAL: ServiceState = { status: 'idle', latencyMs: 0 };

function colorFor(key: ServiceKey, state: ServiceState): 'red' | 'yellow' | 'green' {
  if (state.status === 'ok') return 'green';
  if (state.status === 'fail') return key === 'openai' ? 'yellow' : 'red';
  return 'red';
}

function labelFor(state: ServiceState): string {
  if (state.status === 'idle') return 'pending';
  if (state.status === 'checking') return 'checking…';
  if (state.status === 'ok') return `ok · ${state.latencyMs}ms`;
  return state.error ?? 'failed';
}

export default function PreflightPage() {
  const router = useRouter();
  const [anthropic, setAnthropic] = useState<ServiceState>(INITIAL);
  const [openai, setOpenai] = useState<ServiceState>(INITIAL);

  const runChecks = useCallback(async (signal?: AbortSignal) => {
    setAnthropic({ status: 'checking', latencyMs: 0 });
    setOpenai({ status: 'checking', latencyMs: 0 });

    const apply = (res: PingResult): ServiceState => ({
      status: res.ok ? 'ok' : 'fail',
      latencyMs: res.latencyMs,
      error: res.error,
    });

    const [aRes, oRes] = await Promise.allSettled([pingAnthropic(signal), pingOpenAI(signal)]);

    if (signal?.aborted) return;

    setAnthropic(
      aRes.status === 'fulfilled'
        ? apply(aRes.value)
        : { status: 'fail', latencyMs: 0, error: String(aRes.reason) }
    );
    setOpenai(
      oRes.status === 'fulfilled'
        ? apply(oRes.value)
        : { status: 'fail', latencyMs: 0, error: String(oRes.reason) }
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const controller = new AbortController();
    void runChecks(controller.signal);
    return () => controller.abort();
  }, [runChecks]);

  const canEnter = anthropic.status === 'ok';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ivory)',
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{ width: 520, maxWidth: '100%', padding: 0 }}
      >
        <div className="card-h">
          <div className="t">
            Pre-flight check <em>— connectivity</em>
          </div>
          <button type="button" className="btn sm" onClick={() => void runChecks()}>
            Recheck
          </button>
        </div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Row
            name="Anthropic · Claude streaming"
            subtitle="Recall, Override, Tone Guard"
            state={anthropic}
            color={colorFor('anthropic', anthropic)}
          />
          <Row
            name="OpenAI · embeddings"
            subtitle="Free-text Recall fallback only (D4)"
            state={openai}
            color={colorFor('openai', openai)}
          />
          <div
            style={{
              borderTop: '1px solid var(--rule-2)',
              paddingTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div className="foot">
              {canEnter
                ? 'Anthropic online. OK to enter demo.'
                : 'Anthropic must be green to enter.'}
            </div>
            <button
              type="button"
              className="btn primary"
              disabled={!canEnter}
              onClick={() => router.replace('/dashboard/')}
            >
              Enter demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  name,
  subtitle,
  state,
  color,
}: {
  name: string;
  subtitle: string;
  state: ServiceState;
  color: 'red' | 'yellow' | 'green';
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <TrafficLight color={color} size="md" />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 13,
            color: 'var(--navy)',
            fontWeight: 500,
          }}
        >
          {name}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--slate)' }}>
          {subtitle}
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          color: 'var(--slate)',
          textAlign: 'right',
          maxWidth: 220,
          wordBreak: 'break-word',
        }}
      >
        {labelFor(state)}
      </div>
    </div>
  );
}
