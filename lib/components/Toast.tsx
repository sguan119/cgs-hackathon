'use client';

import { useEffect, type ReactNode } from 'react';
import { StreamingDots } from './StreamingDots';

type ToastVariant = 'info' | 'warning' | 'error' | 'success' | 'loading';

type Props = {
  variant: ToastVariant;
  children: ReactNode;
  onDismiss?: () => void;
};

const AUTO_DISMISS_MS: Partial<Record<ToastVariant, number>> = {
  info: 4000,
  success: 4000,
};

export function Toast({ variant, children, onDismiss }: Props) {
  useEffect(() => {
    const ms = AUTO_DISMISS_MS[variant];
    if (!ms || !onDismiss) return;
    const id = setTimeout(onDismiss, ms);
    return () => clearTimeout(id);
  }, [variant, onDismiss]);

  return (
    <div className={`toast ${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      {variant === 'loading' ? <StreamingDots /> : null}
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" className="dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  );
}
