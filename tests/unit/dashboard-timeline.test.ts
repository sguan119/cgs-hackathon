import { describe, expect, it } from 'vitest';
import {
  EVENT_ROUTE_MAP,
  RELOAD_TIMELINE,
  resolveEventRoute,
  routeEventToSurface,
  routeToPath,
  type DashboardEventKind,
  type DashboardTimelineEvent,
} from '@/lib/dashboard/dashboard-timeline';

describe('RELOAD_TIMELINE', () => {
  it('has 6 slots in the expected order with pinned delays', () => {
    expect(RELOAD_TIMELINE.map((s) => s.panel)).toEqual([
      'client_identity',
      'relationship_stage',
      'interaction_timeline',
      'ai_alerts',
      'external_signals',
      'context_loaded_badge',
    ]);
    expect(RELOAD_TIMELINE.map((s) => s.delay)).toEqual([
      0, 5000, 12000, 18000, 23000, 28000,
    ]);
  });

  it('is frozen — consumers cannot mutate it', () => {
    expect(() => {
      (RELOAD_TIMELINE as unknown as { push: (x: unknown) => void }).push({});
    }).toThrow();
  });
});

describe('EVENT_ROUTE_MAP', () => {
  it('covers every DashboardEventKind literal', () => {
    const kinds: DashboardEventKind[] = [
      'meeting',
      'earnings',
      'email',
      'memo',
      'project',
      'signal',
    ];
    for (const k of kinds) {
      expect(EVENT_ROUTE_MAP[k]).toBeDefined();
    }
  });

  it('maps kinds to the canonical surface vocabulary', () => {
    expect(EVENT_ROUTE_MAP.meeting).toBe('meeting');
    expect(EVENT_ROUTE_MAP.earnings).toBe('diagnostic');
    expect(EVENT_ROUTE_MAP.email).toBe('continuity');
    expect(EVENT_ROUTE_MAP.memo).toBe('diagnostic');
    expect(EVENT_ROUTE_MAP.project).toBe('diagnostic');
    expect(EVENT_ROUTE_MAP.signal).toBe('continuity');
  });
});

describe('resolveEventRoute', () => {
  it('uses explicit event.route when present', () => {
    const event: DashboardTimelineEvent = {
      id: 'x',
      t: 'Jan 1',
      kind: 'meeting',
      label: 'custom',
      route: 'diagnostic',
    };
    expect(resolveEventRoute(event)).toBe('diagnostic');
  });

  it('falls back to EVENT_ROUTE_MAP when route is absent', () => {
    const event: DashboardTimelineEvent = {
      id: 'x',
      t: 'Jan 1',
      kind: 'signal',
      label: 'news',
    };
    expect(resolveEventRoute(event)).toBe('continuity');
  });
});

describe('routeToPath', () => {
  it('maps recall → /meeting (floating panel is summoned by meeting state)', () => {
    expect(routeToPath('recall')).toBe('/meeting');
  });
  it('prefixes other routes with /', () => {
    expect(routeToPath('diagnostic')).toBe('/diagnostic');
    expect(routeToPath('continuity')).toBe('/continuity');
    expect(routeToPath('meeting')).toBe('/meeting');
  });
});

describe('routeEventToSurface', () => {
  it('invokes navigate with the resolved path', () => {
    const seen: string[] = [];
    const navigate = (p: string) => {
      seen.push(p);
    };
    routeEventToSurface(
      { id: '1', t: 'a', kind: 'meeting', label: 'bi-weekly' },
      navigate
    );
    routeEventToSurface(
      { id: '2', t: 'b', kind: 'email', label: 'client reply' },
      navigate
    );
    routeEventToSurface(
      {
        id: '3',
        t: 'c',
        kind: 'meeting',
        label: 'override',
        route: 'diagnostic',
      },
      navigate
    );
    expect(seen).toEqual(['/meeting', '/continuity', '/diagnostic']);
  });
});
