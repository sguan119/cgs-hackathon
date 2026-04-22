// Mirror of fixtures/precedents.schema.json. Keep in sync when the schema
// changes — the runtime validator (Phase 0) still owns enforcement; these
// types are for TypeScript ergonomics only.

export type KeyFact = {
  label: string;
  value: string;
};

export type DrilldownLayer = {
  depth: 1 | 2 | 3;
  theme: string;
  quotes: string[];
  key_facts: KeyFact[];
};

export type Precedent = {
  id: string;
  client_name: string;
  year: number;
  industry: string;
  summary: string;
  scene: string;
  key_quotes: string[];
  cgs_tags: string[];
  source_id: string;
  embedding: number[];
  drilldown_layers: DrilldownLayer[];
  metadata?: Record<string, unknown>;
};
