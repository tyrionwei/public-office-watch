export type StageRegionLevel = 'country' | 'county_city' | 'district';

export type StageRegionNode = {
  id: string;
  label: string;
  level: StageRegionLevel;
  parentId: string | null;
  publicRegionId: string | null;
  displayOrder: number;
  stageLabel: string;
  isPlaceholder: boolean;
  note: string;
};

export type StageRegionSummary = {
  regionId: string;
  label: string;
  nearestElectionName: string;
  nearestElectionDate: string;
  upcomingRaceCount: number;
  sourceNote: string;
  boundaryNote: string;
};
