'use client';

import { Toast } from '@/lib/components/Toast';

export type ToastRailEntry = {
  id: string;
  variant: 'info' | 'warning' | 'error' | 'success' | 'loading';
  text: string;
};

type Props = {
  entries: ToastRailEntry[];
  onDismiss: (_id: string) => void;
};

export function ToastRail({ entries, onDismiss }: Props) {
  if (entries.length === 0) return null;
  return (
    <div className="recall-toast-rail">
      {entries.map((e) => (
        <Toast key={e.id} variant={e.variant} onDismiss={() => onDismiss(e.id)}>
          {e.text}
        </Toast>
      ))}
    </div>
  );
}
