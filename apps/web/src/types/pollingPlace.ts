export type PollingPlace = {
  id: string;
  voting_date: string;
  village_code: string;
  village_name: string;
  station_no: string;
  station_name: string;
  address: string;
  coverage_kind: 'neighborhoods' | 'whole_village' | 'unpartitioned' | 'ambiguous';
  raw_neighborhoods: string;
  neighborhoods: number[];
  source_name: string;
  source_url: string;
  source_published_on: string | null;
};
