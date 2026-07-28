import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  PublishedPeopleDirectoryRow,
  PublishedPersonProfileRow,
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
    async loadElectionRacePage() {
      return { items: [], total: 0 };
    },
    async loadPeoplePage() {
      return { rows: [], total: 0 };
    },
    async loadPersonProfiles() {
      return { personRows: [], candidateRows: [], claimRows: [], partyAffiliationRows: [] };
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

test('bridge maps complete published person profile rows to the existing frontend contract', async () => {
  const profileRow: PublishedPersonProfileRow = {
    ...peopleRow,
    education: '測試大學',
    experience: '測試經歷',
    primary_photo_url: 'https://example.test/person-1.png',
    photo_source_name: '測試來源',
    photo_source_url: 'https://example.test/source',
    photo_license_type: 'government_open_data',
    photo_license_url: 'https://example.test/license',
    photo_attribution: '測試署名',
    candidate_count: 1,
    primary_region_id: 'region-taipei',
    primary_region_name: '臺北市',
  };
  const candidate = {
    candidate_id: 'candidate-1',
    person_id: 'person-1',
    person_name: '測試市長',
    person_party: '民主進步黨',
    person_position: '市長',
    race_id: 'race-1',
    race_title: '臺北市長',
    election_id: 'election-2022',
    election_name: '2022 地方選舉',
    election_year: 2022,
    region_id: 'region-taipei',
    region_name: '臺北市',
    party: '民主進步黨',
    candidate_no: '1',
    registration_status: 'elected' as const,
    candidacy_status: 'qualified' as const,
    election_result: 'elected' as const,
    status_updated_at: '2022-11-26T00:00:00Z',
    candidate_updated_at: '2022-11-26T00:00:00Z',
    vote_count: 100,
    vote_rate: 51.2,
    is_elected: true,
    is_incumbent: false,
    source_name: '中選會',
    source_url: 'https://example.test/election',
    primary_photo_url: null,
    primary_photo_thumbnail_url: null,
    photo_attribution: null,
    photo_license_type: null,
  };
  const claim = {
    claim_id: 'claim-1',
    person_id: 'person-1',
    claim_type: 'platform' as const,
    claim_value: '測試政見',
    claim_json: {},
    confidence_level: 'A' as const,
    review_score: 100,
    source_name: '官方政見',
    source_url: 'https://example.test/platform',
    observed_at: '2022-11-01',
    updated_at: '2022-11-01T00:00:00Z',
  };
  const affiliation = {
    affiliation_id: 'affiliation-1',
    affiliation_key: 'person-1:dpp',
    person_id: 'person-1',
    person_name: '測試市長',
    source_claim_key: null,
    party_name: '民主進步黨',
    role_context: 'candidate' as const,
    role_title: null,
    organization_unit: null,
    display_order: 1,
    role_tier: 'primary' as const,
    observed_year: 2022,
    observed_date: '2022-11-01',
    start_date: null,
    end_date: null,
    is_current: true,
    confidence_level: 'A' as const,
    source_name: '中選會',
    source_url: 'https://example.test/election',
    updated_at: '2022-11-01T00:00:00Z',
  };
  const requestedIds: string[][] = [];
  const adapter = createAdapter({
    async loadPersonProfiles(personIds) {
      requestedIds.push(personIds);
      return {
        personRows: [profileRow],
        candidateRows: [candidate],
        claimRows: [claim],
        partyAffiliationRows: [affiliation],
      };
    },
  });
  const bridge = createPublishedPublicDataBridge(adapter);

  const profiles = await bridge.loadPersonProfiles([' person-1 ', 'person-1']);

  assert.deepEqual(requestedIds, [['person-1']]);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0]?.person.education, '測試大學');
  assert.equal(profiles[0]?.person.primary_photo_url, 'https://example.test/person-1.png');
  assert.equal(profiles[0]?.person.candidate_count, 1);
  assert.equal(profiles[0]?.person.region_id, 'region-taipei');
  assert.equal(profiles[0]?.candidate_records[0]?.source_name, '中選會');
  assert.equal(profiles[0]?.public_claims[0]?.claim_type, 'platform');
  assert.equal(profiles[0]?.party_affiliations[0]?.party_name, '民主進步黨');
  assert.equal(profiles[0]?.platform_status, 'available');
  assert.equal(profiles[0]?.experience_status, 'available');
  assert.equal(profiles[0]?.identity_records.length, 1);
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

test('bridge forwards election race pagination without remapping public rows', async () => {
  const requests: unknown[][] = [];
  const page = {
    items: [{
      race_id: 'race-1',
      election_id: 'election-1',
      election_name: '地方公職人員選舉',
      region_id: null,
      region_name: null,
      region_slug: null,
      race_type: 'village_chief' as const,
      title: '里長選舉',
      voting_date: '2022-11-26',
      status: 'completed' as const,
      source_name: null,
      source_url: null,
    }],
    total: 1,
  };
  const adapter = createAdapter({
    async loadElectionRacePage(...args) {
      requests.push(args);
      return page;
    },
  });
  const bridge = createPublishedPublicDataBridge(adapter);
  const filters = { raceTypes: ['village_chief' as const], regionKey: '新北市' };

  assert.deepEqual(
    await bridge.loadElectionRacePage(
      '2022-2022-11-26-local',
      ['election-1'],
      filters,
      2,
      20,
    ),
    page,
  );
  assert.deepEqual(requests, [[
    '2022-2022-11-26-local', ['election-1'], filters, 2, 20,
  ]]);
});
