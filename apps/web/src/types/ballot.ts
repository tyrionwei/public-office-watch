export type BallotCategory = 'general' | 'lowland' | 'highland' | 'unspecified';
export type BallotOffice = 'mayor' | 'councilor' | 'townshipMayor' | 'townshipRepresentative'
  | 'indigenousDistrictMayor' | 'indigenousDistrictRepresentative' | 'villageChief';
export type BallotSource = {
  url: string;
  publishedOn: string;
  rawScope: string;
  page?: number;
  legalBasis?: string;
  method?: 'announcement-row' | 'administrative-boundary';
};
export type BallotMapping = {
  id: string;
  eventKey: string;
  office: BallotOffice;
  countyCode: string;
  districtCodes?: readonly string[];
  villageCodes?: readonly string[];
  neighborhoods?: readonly number[];
  categories: readonly Exclude<BallotCategory, 'unspecified'>[];
  constituencyName: string;
  raceId?: string;
  source: BallotSource;
  status?: 'ambiguous';
};
export type BallotStatus = 'confirmed' | 'needs-setting' | 'missing-data' | 'ambiguous';
export type BallotSetting = 'county' | 'district' | 'village' | 'neighborhood' | 'category';
export type BallotItem = {
  office: BallotOffice;
  status: BallotStatus;
  constituencyName?: string;
  href?: string;
  missing: BallotSetting[];
  sources: BallotSource[];
};
export type MyBallotResult = {
  eventKey: string;
  items: BallotItem[];
  estimatedLocalBallots?: number;
  supported: boolean;
};
