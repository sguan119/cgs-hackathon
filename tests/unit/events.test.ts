import { describe, it, expect, vi } from 'vitest';

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
  listen: vi.fn(),
}));

import { EVENTS } from '@/lib/events';

describe('EVENTS constants', () => {
  it('MEETING_START is "meeting:start"', () => {
    expect(EVENTS.MEETING_START).toBe('meeting:start');
  });

  it('MEETING_END is "meeting:end"', () => {
    expect(EVENTS.MEETING_END).toBe('meeting:end');
  });

  it('RECALL_QUERY_COMPLETE is "recall:query_complete"', () => {
    expect(EVENTS.RECALL_QUERY_COMPLETE).toBe('recall:query_complete');
  });
});
