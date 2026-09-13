export type ProgressDetail = {
  id: string; label: string; personId?: string; section: string; state: string;
  reason: string; source: string; sourceUrl?: string; date?: string; next: string;
  group?: string; reviewStatus?: string; claimType?: string;
  firstComplete?: boolean; due?: boolean; incomplete?: boolean;
};
export type ProgressMetric = {
  key: string; label: string; missing: number | null; total: number | null;
  unit: string; note: string;
};
export type DataProgressSummary = {
  version: string; generatedAt: string; errors: string[];
  options: { years: string[]; regions: string[]; offices: string[] };
  people: number | null; candidates: number | null;
  gap: { missing: number | null; total: number | null; waiting: number | null };
  metrics: ProgressMetric[];
  research: {
    poolAt: string | null; stateAt: string | null; excluded: number | null;
    groups: { label: string; total: number; complete: number | null; due: number | null; incomplete: number | null; unsearched: number | null }[];
  };
  backlog: { key: string; label: string; count: number | null; note: string }[];
  schedules: {
    label: string; source: string; configured: string; observedAt: string | null;
    status: string; completeAt: string | null; passed: number | null; total: number | null;
    steps: { label: string; status: string }[]; review: string;
  }[];
  details: { rows: ProgressDetail[]; total: number; page: number; pages: number };
};
