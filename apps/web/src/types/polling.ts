import type { PartyThemeKey } from '../styles/partyThemes';

export type PollComparisonCandidate = {
  candidateId: string;
  displayName: string;
  partyKey: PartyThemeKey;
  partyLabel: string;
  supportPercent: number;
  trendLabel: string;
  spriteVariant: string;
  note: string;
};

export type PollComparisonSourceSummary = {
  sourceCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  updatedAt: string;
  methodologyNote: string;
  disclaimer: string;
};

export type PollComparison = {
  electionId: string;
  title: string;
  summary: string;
  leadingCandidates: PollComparisonCandidate[];
  otherCandidates: PollComparisonCandidate[];
  sourceSummary: PollComparisonSourceSummary;
};
