'use client';

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { ScriptedQuery } from '@/lib/retrieval/fixture-types';
import { AutocompleteList } from './AutocompleteList';
import { useAutocomplete } from './hooks/useAutocomplete';

export type QueryInputSubmit = (_args: {
  query: string;
  source: 'scripted' | 'free-text';
  scriptedId?: string;
}) => void;

type Props = {
  disabled?: boolean;
  onSubmit: QueryInputSubmit;
  focusSignal?: number; // increment to request focus from the parent
};

export function QueryInput({ disabled, onSubmit, focusSignal }: Props) {
  const [value, setValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const auto = useAutocomplete(dropdownOpen ? value : '');
  const listboxId = useId();

  useEffect(() => {
    if (focusSignal === undefined) return;
    textareaRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    function handler(ev: MessageEvent): void {
      if (ev.data === 'focus-query-input') textareaRef.current?.focus();
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  function pick(item: ScriptedQuery): void {
    setValue(item.query);
    setDropdownOpen(false);
    // Defer focus to next tick so the textarea sees the new value.
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }

  function submit(scripted?: ScriptedQuery): void {
    const q = value.trim();
    if (q.length === 0) return;
    if (scripted) {
      onSubmit({ query: scripted.query, source: 'scripted', scriptedId: scripted.id });
    } else {
      onSubmit({ query: q, source: 'free-text' });
    }
    setValue('');
    // Keep dropdown closed after submit — it re-opens on next keystroke.
    // Reviewer B1: leaving it true caused a flash before the 2-char filter.
    setDropdownOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'ArrowDown') {
      if (auto.items.length > 0) {
        e.preventDefault();
        auto.step(1);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      if (auto.items.length > 0) {
        e.preventDefault();
        auto.step(-1);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setDropdownOpen(false);
      auto.reset();
      return;
    }
    if (e.key === 'Tab') {
      const active = auto.items[auto.activeIndex];
      if (active) {
        e.preventDefault();
        pick(active);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const active = auto.items[auto.activeIndex];
      if (active && dropdownOpen) submit(active);
      else submit();
    }
  }

  return (
    <div className="recall-query">
      <textarea
        ref={textareaRef}
        className="recall-query-input"
        placeholder="Ask recall — cmd-K from anywhere"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          setDropdownOpen(true);
        }}
        onKeyDown={onKeyDown}
        rows={2}
        aria-label="Recall query"
        aria-controls={listboxId}
      />
      {dropdownOpen && auto.items.length > 0 ? (
        <div id={listboxId}>
          <AutocompleteList
            items={auto.items}
            activeIndex={auto.activeIndex}
            onPick={pick}
            onHover={(i) => auto.setActiveIndex(i)}
          />
        </div>
      ) : null}
    </div>
  );
}
