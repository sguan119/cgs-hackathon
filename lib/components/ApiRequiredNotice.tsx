'use client';

import { hasAnthropicKey, hasOpenAIKey } from '@/lib/config/demo-mode';

type Service = 'anthropic' | 'openai' | 'both';
type Size = 'inline' | 'block';

type Props = {
  service: Service;
  size?: Size;
};

function envLine(service: Service): string {
  const missing: string[] = [];
  if (service === 'anthropic' || service === 'both') {
    if (!hasAnthropicKey()) missing.push('ANTHROPIC_API_KEY');
  }
  if (service === 'openai' || service === 'both') {
    if (!hasOpenAIKey()) missing.push('OPENAI_API_KEY');
  }
  if (missing.length === 0) missing.push(service === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY');
  return missing.join(' + ');
}

export function ApiRequiredNotice({ service, size = 'inline' }: Props) {
  const keys = envLine(service);
  const style: React.CSSProperties =
    size === 'block'
      ? {
          padding: '12px 14px',
          border: '1px dashed var(--rule-2)',
          borderRadius: 4,
          background: 'var(--ivory)',
        }
      : { padding: '6px 0' };
  return (
    <div
      role="note"
      data-testid="api-required-notice"
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        color: 'var(--slate)',
        lineHeight: 1.5,
        ...style,
      }}
    >
      Requires {keys} — add to <code>.env.local</code> and restart.
    </div>
  );
}
