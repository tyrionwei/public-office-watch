import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  PublishedPeopleDirectoryRow,
  PublishedPeoplePageRequest,
  PublishedReadAdapter,
} from '../src/lib/publishedReadAdapter.ts';
import { createPublishedPublicDataBridge } from '../src/lib/publishedPublicDataBridge.ts';

const peopleRow: PublishedPeopleDirectoryRow = {
  person_id: 'person-1',
  name: '測試市長',
  alias: null,
  gender: 'female',
  party: '民主進步黨',
  position: '市長',
  current_office_label: '臺北市長',
  upcoming_candidate_label: null,
  election_year: 2022,
  district: '台北市',
  updated_at: '2026-07-28T00:00:00Z',
  primary_photo_thumbnail_url: 'https://example.test/person-1.webp',
  list_role: 'local_chief',
  list_status: 'current',
  list_is_grassroots: false,
  list_is_party_only: false,
  list_status_order: 0,
  list_role_order: 3,
};

function createAdapter(overrides: Partial<PublishedReadAdapter>): PublishedReadAdapter {
  return {
    async loadHomePage() {
      return { tickerRows: [], regionSummaryRows: [], regionRows: [], raceRows: [] };
    },
    async loadRegionPage() {
      return { regionRow: null, summaryRow: null, childRegionRows: [], raceRows: [] };
    },
    async loadElectionIndex() {
      return { electionRows: [], raceSummaryRows: [] };
    },
    async loadElectionRaceFacets() {
      return [];
    },
    async loadPeoplePage() {
      return { rows: [], total: 0 };
    },
    async search() {
      return [];
    },
    ...overrides,
  };
}

test('bridge resolves region filters and maps a published people page to frontend rows', async () => {
  const requests: PublishedPeoplePageRequest[] = [];
  const adapter = createAdapter({
    async loadHomePage() {
      return { tickerRows: [], regionSummaryRows: [], regionRows: [], raceRows: [] };
    },
    async loadRegionPage() {
      return { regionRow: null, summaryRow: null, childRegionRows: [], raceRows: [] };
    },
    async loadPeoplePage(request) {
      requests.push(request);
      return { rows: [peopleRow], total: 1 };
    },
    async search() {
      return [];
    },
  });
  const bridge = createPublishedPublicDataBridge(adapter, (regionId) => ({
    regionId,
    regionName: '臺北市',
    districtPrefixes: ['台北市', '臺北市'],
  }));

  const result = await bridge.loadPeoplePage(
    { regionId: 'region-taipei', party: '民主進步黨', role: 'local_chief', status: 'current' },
    2,
    20,
  );

  assert.deepEqual(requests, [{
    page: 2,
    pageSize: 20,
    districtPrefixes: ['台北市', '臺北市'],
    party: '民主進步黨',
    query: undefined,
    role: 'local_chief',
    status: 'current',
  }]);
  assert.equal(result.total, 1);
  assert.deepEqual(result.items[0], {
    person_id: 'person-1',
    name: '測試市長',
    alias: null,
    gender: 'female',
    party: '民主進步黨',
    position: '市長',
    current_office_label: '臺北市長',
    upcoming_candidate_label: null,
    election_year: 2022,
    district: '台北市',
    education: null,
    experience: null,
    updated_at: '2026-07-28T00:00:00Z',
    primary_photo_url: null,
    primary_photo_thumbnail_url: 'https://example.test/person-1.webp',
    photo_source_name: null,
    photo_source_url: null,
    photo_license_type: null,
    photo_license_url: null,
    photo_attribution: null,
    role: 'local_chief',
    role_label: '縣市首長',
    status: 'current',
    status_label: '現任',
    display_position_label: '臺北市長',
    region_id: 'region-taipei',
    region_name: '臺北市',
    candidate_count: 0,
    external_ids: [],
    merged_person_ids: ['person-1'],
    merged_role_labels: ['縣市首長'],
    merged_candidate_count: 0,
  });
});

test('bridge maps compact search rows to existing frontend result types', async () => {
  const adapter = createAdapter({
    async loadHomePage() {
      return { tickerRows: [], regionSummaryRows: [], regionRows: [], raceRows: [] };
    },
    async loadRegionPage() {
      return { regionRow: null, summaryRow: null, childRegionRows: [], raceRows: [] };
    },
    async loadPeoplePage() {
      return { rows: [], total: 0 };
    },
    async search() {
      return [
        {
          document_key: 'person:person-1',
          entity_type: 'person',
          entity_id: 'person-1',
          title: '測試人物',
          normalized_search_text: '測試人物',
          href: '/people/person-1',
        },
        {
          document_key: 'region:region-taipei',
          entity_type: 'region',
          entity_id: 'region-taipei',
          title: '臺北市',
          normalized_search_text: '台北市',
          href: '/regions/region-taipei',
        },
      ];
    },
  });
  const bridge = createPublishedPublicDataBridge(adapter);

  assert.deepEqual(await bridge.searchPublicRecords('臺北'), [
    {
      id: 'person:person-1',
      type: 'person',
      label: '人物',
      title: '測試人物',
      subtitle: '公開人物資料',
      href: '/people/person-1',
    },
    {
      id: 'region:region-taipei',
      type: 'region',
      label: '地區',
      title: '臺北市',
      subtitle: '公開區域導覽',
      href: '/regions/region-taipei',
    },
  ]);
});

test('bridge keeps a safe region fallback when no resolver is provided', async () => {
  let request: PublishedPeoplePageRequest | null = null;
  const adapter = createAdapter({
    async loadHomePage() {
      return { tickerRows: [], regionSummaryRows: [], regionRows: [], raceRows: [] };
    },
    async loadRegionPage() {
      return { regionRow: null, summaryRow: null, childRegionRows: [], raceRows: [] };
    },
    async loadPeoplePage(nextRequest) {
      request = nextRequest;
      return { rows: [], total: 0 };
    },
    async search() {
      return [];
    },
  });
  const bridge = createPublishedPublicDataBridge(adapter);

  await bridge.loadPeoplePage({ regionId: '臺北市' }, 1, 20);

  assert.deepEqual(request, {
    page: 1,
    pageSize: 20,
    districtPrefixes: ['臺北市'],
    party: undefined,
    query: undefined,
    role: undefined,
    status: undefined,
  });
});

test('bridge maps bounded home and region reads into existing frontend contracts', async () => {
  const region = {
    region_id: 'region-taipei',
    name: '臺北市',
    slug: 'taipei',
    region_type: 'municipality' as const,
    parent_region_id: 'region-taiwan',
    official_code: '63000',
    map_code: '63000',
    display_order: 1,
  };
  const childRegion = {
    region_id: 'region-xinyi',
    name: '信義區',
    slug: 'xinyi',
    region_type: 'district' as const,
    parent_region_id: 'region-taipei',
    official_code: '63000020',
    map_code: '63000020',
    display_order: 2,
  };
  const summary = {
    region_id: 'region-taipei',
    region_name: '臺北市',
    region_slug: 'taipei',
    region_type: 'municipality' as const,
    next_election_id: 'election-2026',
    next_election_name: '2026 地方選舉',
    next_voting_date: '2026-11-28',
    upcoming_race_count: 3,
  };
  const race = {
    race_id: 'race-taipei-mayor',
    election_id: 'election-2026',
    election_name: '2026 地方選舉',
    region_id: 'region-taipei',
    region_name: '臺北市',
    region_slug: 'taipei',
    race_type: 'municipality_mayor' as const,
    title: '臺北市長',
    voting_date: '2026-11-28',
    status: 'upcoming' as const,
  };
  const adapter = createAdapter({
    async loadHomePage() {
      return {
        tickerRows: [{
          election_id: 'election-2026',
          election_name: '2026 地方選舉',
          voting_date: '2026-11-28',
        }],
        regionSummaryRows: [summary],
        regionRows: [region],
        raceRows: [race],
      };
    },
    async loadRegionPage() {
      return {
        regionRow: region,
        summaryRow: summary,
        childRegionRows: [childRegion],
        raceRows: [race],
      };
    },
    async loadPeoplePage() {
      return { rows: [], total: 0 };
    },
    async search() {
      return [];
    },
  });
  const bridge = createPublishedPublicDataBridge(adapter);

  const home = await bridge.loadHomePageData();
  assert.deepEqual(home.ticker, {
    title: '2026 地方選舉',
    date: '2026-11-28',
    electionId: 'election-2026',
  });
  assert.deepEqual(home.regions[0], {
    id: 'taipei',
    name: '臺北市',
    tone: '公開資料導覽區塊',
    electionName: '2026 地方選舉',
    nextVotingDate: '2026-11-28',
    upcomingRaceCount: 3,
  });
  assert.deepEqual(home.stageRegions[0], {
    id: 'taipei',
    label: '臺北市',
    level: 'county_city',
    parentId: null,
    publicRegionId: 'region-taipei',
    displayOrder: 1,
    stageLabel: '63000',
    isPlaceholder: false,
    note: 'published region',
  });
  assert.deepEqual(home.stageRegionSummaries[0], {
    regionId: 'taipei',
    label: '臺北市',
    nearestElectionName: '2026 地方選舉',
    nearestElectionDate: '2026-11-28',
    upcomingRaceCount: 3,
    sourceNote: '依 published 發布摘要資料整理。',
    boundaryNote: '僅顯示已審核的 published 發布資料。',
  });
  assert.deepEqual(home.upcomingRaces[0], {
    id: 'race-taipei-mayor',
    electionId: 'election-2026',
    title: '臺北市長',
    region: '臺北市',
    regionId: 'taipei',
    date: '2026-11-28',
    status: 'upcoming',
    raceType: 'municipality_mayor',
    partyTag: 'unknown',
    partyLabel: '未知政黨',
  });
  assert.equal(home.dataPrinciples.some((principle) => principle.includes('published')), true);

  const regionPage = await bridge.loadRegionPageData('taipei');
  assert.equal(regionPage.region?.id, 'taipei');
  assert.equal(regionPage.summary?.regionId, 'taipei');
  assert.equal(regionPage.card?.id, 'taipei');
  assert.deepEqual(regionPage.childRegions.map((child) => [child.id, child.parentId]), [['xinyi', 'taipei']]);
  assert.deepEqual(regionPage.relatedRaces.map((item) => item.id), ['race-taipei-mayor']);
});

test('bridge maps election index and facets into public provider contracts', async () => {
  const election = {
    election_id: 'election-2028',
    name: '2028 全國選舉',
    year: 2028,
    election_type: 'presidential' as const,
    voting_date: '2028-01-08',
    status: 'upcoming' as const,
    source_name: '中央選舉委員會',
    source_url: 'https://example.test/election-2028',
  };
  const summary = {
    election_id: 'election-2028',
    race_count: 1,
    race_types: ['president' as const],
  };
  const facet = {
    election_id: 'election-2028',
    race_type: 'president' as const,
    region_key: 'national',
    region_label: '全國',
    race_count: 1,
  };
  const facetRequests: string[][] = [];
  const adapter = createAdapter({
    async loadElectionIndex() {
      return { electionRows: [election], raceSummaryRows: [summary] };
    },
    async loadElectionRaceFacets(electionIds) {
      facetRequests.push(electionIds);
      return [facet];
    },
  });
  const bridge = createPublishedPublicDataBridge(adapter);

  assert.deepEqual(await bridge.loadElectionIndex(), {
    elections: [election],
    raceSummaries: [summary],
  });
  assert.deepEqual(await bridge.loadElectionRaceFacets(['election-2028']), [facet]);
  assert.deepEqual(facetRequests, [['election-2028']]);
});
