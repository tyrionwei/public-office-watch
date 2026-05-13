export type TaiwanMapLevel = 'county_city' | 'town_district';

export type TaiwanMapFeatureProperties = {
  id: string;
  code: string;
  name: string;
  level: TaiwanMapLevel;
  parentCode: string | null;
  sourceName: string;
  sourceVersion: string | null;
  isOfficialBoundary: boolean;
  boundaryNote: string;
};

export type TaiwanMapSourceMetadata = {
  id: string;
  title: string;
  provider: string;
  sourceUrl: string;
  license: string;
  downloadedAt: string | null;
  transformedAt: string | null;
  transformNote: string;
};
