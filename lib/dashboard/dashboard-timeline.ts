// Phase 4.1 — timeline constants + routing helpers for §5 Dashboard.
// Pinned verbatim per tech-design §2.5. A new DashboardEventKind requires a
// matching entry in EVENT_ROUTE_MAP; the unit test enforces the invariant.

export type DashboardEventKind =
  | 'meeting'
  | 'earnings'
  | 'email'
  | 'memo'
  | 'project'
  | 'signal';

export type DashboardEventRoute = 'recall' | 'diagnostic' | 'continuity' | 'meeting';

export type DashboardTimelineEvent = {
  id: string;
  t: string;
  kind: DashboardEventKind;
  label: string;
  sub?: string;
  route?: DashboardEventRoute;
};

export const EVENT_ROUTE_MAP: Record<DashboardEventKind, DashboardEventRoute> = {
  meeting: 'meeting',
  earnings: 'diagnostic',
  email: 'continuity',
  memo: 'diagnostic',
  project: 'diagnostic',
  signal: 'continuity',
} as const;

export type DashboardPanelId =
  | 'client_identity'
  | 'relationship_stage'
  | 'interaction_timeline'
  | 'ai_alerts'
  | 'external_signals'
  | 'context_loaded_badge';

export type ReloadTimelineSlot = {
  delay: number;
  panel: DashboardPanelId;
};

export const RELOAD_TIMELINE: readonly ReloadTimelineSlot[] = Object.freeze([
  { delay: 0, panel: 'client_identity' },
  { delay: 5000, panel: 'relationship_stage' },
  { delay: 12000, panel: 'interaction_timeline' },
  { delay: 18000, panel: 'ai_alerts' },
  { delay: 23000, panel: 'external_signals' },
  { delay: 28000, panel: 'context_loaded_badge' },
]);

export type NavigateFn = (_path: string) => void;

export function resolveEventRoute(event: DashboardTimelineEvent): DashboardEventRoute {
  return event.route ?? EVENT_ROUTE_MAP[event.kind];
}

export function routeToPath(route: DashboardEventRoute): string {
  // 'recall' is a UX label for the floating panel; the canonical main-window
  // route that summons it is /meeting.
  if (route === 'recall') return '/meeting';
  return `/${route}`;
}

export function routeEventToSurface(
  event: DashboardTimelineEvent,
  navigate: NavigateFn
): void {
  navigate(routeToPath(resolveEventRoute(event)));
}
