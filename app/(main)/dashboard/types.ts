// Phase 4.1 / 4.4 shared fixture types. Mirrors JSON Schema definitions in
// fixtures/dashboard_fixtures/ and fixtures/datahub_fixtures/.

import type { DashboardTimelineEvent } from '@/lib/dashboard/dashboard-timeline';

export type RelationshipStage =
  | 'Signal'
  | 'Pre-RFP'
  | 'Retainer'
  | 'Active Delivery'
  | 'Renewal';

export type DashboardAlertKind =
  | 'retainer_renewal_risk'
  | 'exec_email_overdue'
  | 'pre_rfp_signal'
  | 'prospect_cooling';

export type DashboardAlert = {
  id: string;
  kind: DashboardAlertKind;
  severity: 'high' | 'borderline';
  text: string;
  source?: string;
};

export type DashboardExternalSignal = {
  id: string;
  t: string;
  headline: string;
  relevance: number;
};

export type DashboardFixture = {
  client: {
    name: string;
    industry: string;
    retainer: string;
    nextContact: string;
    relationshipStage: RelationshipStage;
  };
  stages: readonly RelationshipStage[];
  timeline: readonly DashboardTimelineEvent[];
  alerts: readonly DashboardAlert[];
  externalSignals: readonly DashboardExternalSignal[];
  contextLoadSec: number;
};

export type DataHubUploadStatus = 'tagged' | 'tagging' | 'untagged';

export type DataHubUpload = {
  id: string;
  name: string;
  size: string;
  rows: number;
  status: DataHubUploadStatus;
};

export type DataHubServiceLine =
  | 'Strategic Transformation'
  | 'IT Transformation'
  | 'Enterprise Innovation'
  | 'Inertia Removal';

export type DataHubCrmRow = {
  id: string;
  name: string;
  industry: string;
  size: string;
  region: string;
  serviceLine: DataHubServiceLine;
  stage: RelationshipStage;
  flag?: 'new' | null;
};

export type DataHubFolderFile = {
  icon: string;
  name: string;
  meta: string;
};

export type DataHubFixture = {
  uploads: readonly DataHubUpload[];
  crmRows: readonly DataHubCrmRow[];
  acmeFolder: readonly DataHubFolderFile[];
};

export type ThesisScreenshotId = 'before_m1' | 'before_m2';

export type ThesisScreenshot = {
  id: ThesisScreenshotId;
  label: 'Before Meeting 1' | 'Before Meeting 2';
  imagePath: string;
  alt: string;
  caption?: string;
};

export type ThesisFixture = {
  screenshots: readonly [ThesisScreenshot, ThesisScreenshot];
  defaultId: ThesisScreenshotId;
};
