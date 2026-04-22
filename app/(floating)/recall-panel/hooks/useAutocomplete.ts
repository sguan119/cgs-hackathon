'use client';

import { useEffect, useMemo, useState } from 'react';
import { matchPrefix } from '@/lib/retrieval/autocomplete';
import type { ScriptedQuery } from '@/lib/retrieval/fixture-types';
import { loadScriptedQueries } from '@/lib/retrieval/precedents-loader';

export type UseAutocompleteApi = {
  items: ScriptedQuery[];
  activeIndex: number;
  setActiveIndex: (_i: number) => void;
  step: (_dir: 1 | -1) => void;
  reset: () => void;
};

// e2e stub gate — lets the Playwright spec render predictable dropdown
// content without needing a real fixture fetch. Keep the bypass surface
// explicit so it's easy to audit.
function loadStubQueries(): ScriptedQuery[] {
  return [
    {
      id: 'stub-1',
      query: 'what is the closest analogue',
      embedding: [],
      category: 'first-hit',
    },
    {
      id: 'stub-2',
      query: 'what happened at Globex',
      embedding: [],
      category: 'first-hit',
    },
  ];
}

export function useAutocomplete(input: string): UseAutocompleteApi {
  const [pool, setPool] = useState<ScriptedQuery[]>([]);
  // -1 = nothing highlighted on mount / when dropdown is empty.
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    if (process.env.NEXT_PUBLIC_USE_STUB_CHAIN === '1') {
      setPool(loadStubQueries());
      return;
    }
    loadScriptedQueries()
      .then((list) => {
        if (!cancelled) setPool(list);
      })
      .catch(() => {
        if (!cancelled) setPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => matchPrefix(input, pool), [input, pool]);

  useEffect(() => {
    // Reset highlight when the match set changes.
    setActiveIndex(items.length > 0 ? 0 : -1);
  }, [items]);

  function step(dir: 1 | -1): void {
    if (items.length === 0) return;
    setActiveIndex((i) => {
      const next = i + dir;
      if (next < 0) return items.length - 1;
      if (next >= items.length) return 0;
      return next;
    });
  }

  function reset(): void {
    setActiveIndex(-1);
  }

  return { items, activeIndex, setActiveIndex, step, reset };
}
