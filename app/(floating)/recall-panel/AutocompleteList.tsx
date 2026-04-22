'use client';

import type { ScriptedQuery } from '@/lib/retrieval/fixture-types';

type Props = {
  items: ScriptedQuery[];
  activeIndex: number;
  onPick: (_item: ScriptedQuery) => void;
  onHover: (_index: number) => void;
};

export function AutocompleteList({ items, activeIndex, onPick, onHover }: Props) {
  if (items.length === 0) return null;
  return (
    <ul className="recall-autocomplete" role="listbox">
      {items.map((item, i) => (
        <li
          key={item.id}
          role="option"
          aria-selected={i === activeIndex}
          className={`recall-autocomplete-item${i === activeIndex ? ' active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(item);
          }}
          onMouseEnter={() => onHover(i)}
        >
          {item.query}
        </li>
      ))}
    </ul>
  );
}
