import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ELECTION_EDUCATION_DISTRIBUTION_LIMIT,
  ELECTION_FACET_BATCH_LIMIT,
  ELECTION_ID_BATCH_SIZE,
  ELECTION_PARTY_PERFORMANCE_LIMIT,
  ELECTION_RACE_PAGE_ELECTION_LIMIT,
  ELECTION_RACE_PAGE_SIZE,
  HOME_RACE_LIMIT,
  HOME_REGION_LIMIT,
  LOCAL_OFFICE_PERSON_LIMIT,
  LEGISLATOR_PARTY_SUMMARY_COLUMNS,
  LEGISLATOR_PARTY_SUMMARY_LIMIT,
  NATIONAL_OFFICE_HOLDER_COLUMNS,
  NATIONAL_OFFICE_HOLDER_LIMIT,
  PEOPLE_DIRECTORY_COLUMNS,
  PARTY_ANNUAL_FINANCE_COLUMNS,
  PARTY_ANNUAL_FINANCE_LIMIT,
  PARTY_COLUMNS,
  PARTY_COMPANY_CONTRIBUTION_COLUMNS,
  PARTY_COMPANY_CONTRIBUTION_PAGE_SIZE,
  PARTY_FINANCE_COLUMNS,
  PARTY_FINANCE_LIMIT,
  PARTY_LIMIT,
  PARTY_OFFICER_COLUMNS,
  PARTY_OFFICER_LIMIT,
  PARTY_PLATFORM_HISTORY_LIMIT,
  PERSON_CANDIDATE_LIMIT,
  PERSON_CANDIDATE_COLUMNS,
  PERSON_CLAIM_LIMIT,
  PERSON_PROFILE_BATCH_LIMIT,
  PUBLIC_UPDATE_COLUMNS,
  PUBLIC_UPDATE_LIMIT,
  REGION_RACE_LIMIT,
  RACE_DETAIL_CANDIDATE_LIMIT,
  RACE_DETAIL_PARTY_LIST_CANDIDATE_LIMIT,
  RACE_DETAIL_PARTY_LIST_RESULT_LIMIT,
  createPublishedReadAdapter,
  type PublishedSchemaClient,
} from '../src/lib/publishedReadAdapter.ts';

const payloadMetadata = {
  api_version: 1,
  release_id: 'release-1',
  published_at: '2026-08-27T00:00:00Z',
};

type FakeResponse = {
  data: unknown[] | null;
  error: { message: string } | null;
  count: number | null;
};

type RecordedCall = [string, ...unknown[]];

function createFakeClient(responses: Record<string, FakeResponse | FakeResponse[]>) {
  const calls: RecordedCall[] = [];
  const responseIndexes = new Map<string, number>();

  function nextResponse(key: string) {
    const configuredResponse = responses[key];
    const responseIndex = responseIndexes.get(key) ?? 0;
    const response = Array.isArray(configuredResponse)
      ? configuredResponse[responseIndex]
      : configuredResponse;
    responseIndexes.set(key, responseIndex + 1);
    return response ?? { data: [], error: null, count: null };
  }

  const client = {
    schema(schemaName: string) {
      calls.push(['schema', schemaName]);
      return {
        from(relationName: string) {
          calls.push(['from', relationName]);
          const query = {
            select(...args: unknown[]) {
              calls.push(['select', ...args]);
              return query;
            },
            eq(...args: unknown[]) {
              calls.push(['eq', ...args]);
              return query;
            },
            ilike(...args: unknown[]) {
              calls.push(['ilike', ...args]);
              return query;
            },
            like(...args: unknown[]) {
              calls.push(['like', ...args]);
              return query;
            },
            in(...args: unknown[]) {
              calls.push(['in', ...args]);
              return query;
            },
            or(...args: unknown[]) {
              calls.push(['or', ...args]);
              return query;
            },
            not(...args: unknown[]) {
              calls.push(['not', ...args]);
              return query;
            },
            order(...args: unknown[]) {
              calls.push(['order', ...args]);
              return query;
            },
            range(...args: unknown[]) {
              calls.push(['range', ...args]);
              return query;
            },
            limit(...args: unknown[]) {
              calls.push(['limit', ...args]);
              return query;
            },
            then(onFulfilled: (value: FakeResponse) => unknown, onRejected?: (reason: unknown) => unknown) {
              return Promise.resolve(nextResponse(relationName))
                .then(onFulfilled, onRejected);
            },
          };
          return query;
        },
        rpc(functionName: string, args: Record<string, unknown>) {
          calls.push(['rpc', functionName, args]);
          return Promise.resolve(nextResponse(`rpc:${functionName}`));
        },
      };
    },
  };

  return { calls, client: client as unknown as PublishedSchemaClient };
}

test('people directory reads one bounded page with explicit columns and deterministic order', async () => {
  const row = { person_id: 'person-1', name: '測試人物' };
  const fake = createFakeClient({
    people_directory: { data: [row], error: null, count: 42 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  const result = await adapter.loadPeoplePage({ page: 3, pageSize: 200 });

  assert.deepEqual(result, { rows: [row], total: 42 });
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'people_directory'],
    ['select', PEOPLE_DIRECTORY_COLUMNS, { count: 'exact' }],
    ['eq', 'list_is_grassroots', false],
    ['eq', 'list_is_party_only', false],
    ['order', 'list_status_order', { ascending: true }],
    ['order', 'list_role_order', { ascending: true }],
    ['order', 'name', { ascending: true }],
    ['order', 'person_id', { ascending: true }],
    ['range', 40, 59],
  ]);
});

test('people directory applies published filters without hiding party officers', async () => {
  const fake = createFakeClient({
    people_directory: { data: [], error: null, count: 0 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await adapter.loadPeoplePage({
    page: 1,
    query: ' 王 ',
    party: '臺灣民眾黨',
    role: 'party_officer',
    status: 'current',
    districtPrefixes: ['台北市', '臺北市'],
  });

  assert.deepEqual(fake.calls.slice(3, 8), [
    ['ilike', 'name', '%王%'],
    ['in', 'party', ['台灣民眾黨', '臺灣民眾黨']],
    ['or', 'district.ilike.台北市%,district.ilike.臺北市%'],
    ['eq', 'list_role', 'party_officer'],
    ['eq', 'list_status', 'current'],
  ]);
  assert.equal(fake.calls.some((call) => call[0] === 'eq' && call[1] === 'list_is_party_only'), false);
});

test('candidate status includes current officeholders who are also upcoming candidates', async () => {
  const fake = createFakeClient({
    people_directory: { data: [], error: null, count: 0 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await adapter.loadPeoplePage({
    page: 1,
    status: 'candidate',
  });

  assert.equal(fake.calls.some((call) => call[0] === 'eq' && call[1] === 'list_status'), false);
  assert.equal(fake.calls.some((call) => call[0] === 'not' && call[1] === 'upcoming_candidate_label' && call[2] === 'is' && call[3] === null), true);
});

test('party candidate page reads the active published candidate view with stable pagination', async () => {
  const row = { candidate_id: 'candidate-1', person_name: '測試候選人' };
  const fake = createFakeClient({
    active_party_candidates: { data: [row], error: null, count: 17 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  const result = await adapter.loadPartyCandidatePage(' 臺灣民眾黨 ', 2, 8);

  assert.deepEqual(result, { rows: [row], total: 17 });
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'active_party_candidates'],
    ['select', PERSON_CANDIDATE_COLUMNS, { count: 'exact' }],
    ['in', 'party', ['台灣民眾黨', '臺灣民眾黨']],
    ['order', 'election_year', { ascending: false, nullsFirst: false }],
    ['order', 'region_name', { ascending: true, nullsFirst: false }],
    ['order', 'race_title', { ascending: true }],
    ['order', 'person_name', { ascending: true }],
    ['order', 'candidate_id', { ascending: true }],
    ['range', 8, 15],
  ]);
});

test('search calls the ranked published search function with a bounded limit', async () => {
  const row = { document_key: 'region:tp', entity_type: 'region', entity_id: 'tp', title: '臺北市', normalized_search_text: '台北市', party_name: null, href: '/regions/tp' };
  const fake = createFakeClient({
    'rpc:search_public_records': { data: [row], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  const result = await adapter.search('  臺北  ');

  assert.deepEqual(result, [row]);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['rpc', 'search_public_records', { p_query: '台北', p_limit: 12 }],
  ]);
});

test('short search does not query the database', async () => {
  const fake = createFakeClient({});
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.search('台'), []);
  assert.deepEqual(fake.calls, []);
});

test('adapter surfaces database errors', async () => {
  const fake = createFakeClient({
    'rpc:search_public_records': { data: null, error: { message: 'permission denied' }, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(() => adapter.search('台北'), /Published search query failed: permission denied/);
});

test('home page adds plain registration names only for its 2026 races', async () => {
  const ticker = { election_id: 'election-1', election_name: '測試選舉' };
  const regionSummary = { region_id: 'region-taipei', region_name: '臺北市' };
  const region = { region_id: 'region-taipei', name: '臺北市', slug: 'taipei' };
  const race = { race_id: 'race-1', title: '臺北市長', voting_date: '2026-11-28' };
  const candidate = {
    candidate_id: 'candidate-1', race_id: 'race-1', person_id: 'person-1',
    person_name: '測試候選人', gender: 'female', age_group: '40-49',
  };
  const nameOnly = { candidate_id: 'registration-1', race_id: 'race-1', person_id: '', person_name: '同名登記者' };
  const payload = {
    api_version: 1,
    release_id: 'release-1',
    published_at: '2026-08-27T00:00:00Z',
    ticker_rows: [ticker],
    region_summary_rows: [regionSummary],
    region_rows: [region],
    race_rows: [race],
    candidate_rows: [candidate],
    seat_rows: [{ party_name: '測試黨', seat_count: 3 }],
  };
  const fake = createFakeClient({
    'rpc:home_page_for': { data: [{ payload }], error: null, count: null },
    'rpc:registration_names_for': { data: [nameOnly], error: null, count: null },
    regions: { data: [region], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadHomePage(' taipei '), {
    apiVersion: 1,
    releaseId: 'release-1',
    publishedAt: '2026-08-27T00:00:00Z',
    tickerRows: [ticker],
    regionSummaryRows: [regionSummary],
    regionRows: [region],
    raceRows: [race],
    candidateRows: [candidate, nameOnly],
    seatRows: [{ party_name: '測試黨', seat_count: 3 }],
  });
  assert.deepEqual(await adapter.loadRegionDirectory(), [region]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'rpc'), [
    ['rpc', 'home_page_for', { p_region_slug: 'taipei' }],
    ['rpc', 'registration_names_for', { p_race_ids: ['race-1'] }],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'limit'), [
    ['limit', HOME_REGION_LIMIT],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'in'), [
    ['in', 'region_type', ['country', 'municipality', 'county', 'city']],
  ]);
  assert.equal(JSON.stringify(payload).includes('birth_date'), false);
});

test('home page accepts the database 25-race cap and rejects larger payloads', async () => {
  const payloadFor = (count: number) => ({
    ...payloadMetadata,
    ticker_rows: [],
    region_summary_rows: [],
    region_rows: [],
    race_rows: Array.from({ length: count }, (_, index) => ({ race_id: `race-${index + 1}`, title: `選舉 ${index + 1}` })),
    candidate_rows: [],
    seat_rows: [],
  });
  const accepted = createFakeClient({
    'rpc:home_page_for': { data: [{ payload: payloadFor(HOME_RACE_LIMIT) }], error: null, count: null },
  });
  const oversized = createFakeClient({
    'rpc:home_page_for': { data: [{ payload: payloadFor(HOME_RACE_LIMIT + 1) }], error: null, count: null },
  });

  assert.equal((await createPublishedReadAdapter(accepted.client).loadHomePage()).raceRows.length, HOME_RACE_LIMIT);
  await assert.rejects(
    createPublishedReadAdapter(oversized.client).loadHomePage(),
    /Published home races exceeded the 25-row batch limit/,
  );
});

test('region page uses one slug-scoped RPC and bounds payload collections', async () => {
  const region = {
    region_id: 'region-taipei',
    name: '臺北市',
    slug: 'taipei',
    parent_region_id: 'region-taiwan',
  };
  const child = {
    region_id: 'region-xinyi',
    name: '信義區',
    slug: 'xinyi',
    parent_region_id: 'region-taipei',
  };
  const summary = { region_id: 'region-taipei', region_slug: 'taipei' };
  const race = { race_id: 'race-1', region_slug: 'taipei' };
  const fake = createFakeClient({
    'rpc:region_page_for': {
      data: [{ payload: { ...payloadMetadata,
        region_row: region,
        summary_row: summary,
        child_region_rows: [child],
        race_rows: [race],
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadRegionPage(' taipei '), {
    regionRow: region,
    summaryRow: summary,
    childRegionRows: [child],
    raceRows: [race],
  });
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['rpc', 'region_page_for', { p_region_slug: 'taipei' }],
  ]);
});

test('region page accepts the database 25-race cap and rejects larger payloads', async () => {
  const payloadFor = (count: number) => ({
    ...payloadMetadata,
    region_row: null,
    summary_row: null,
    child_region_rows: [],
    race_rows: Array.from({ length: count }, (_, index) => ({ race_id: `race-${index + 1}` })),
  });
  const accepted = createFakeClient({
    'rpc:region_page_for': { data: [{ payload: payloadFor(REGION_RACE_LIMIT) }], error: null, count: null },
  });
  const oversized = createFakeClient({
    'rpc:region_page_for': { data: [{ payload: payloadFor(REGION_RACE_LIMIT + 1) }], error: null, count: null },
  });

  assert.equal((await createPublishedReadAdapter(accepted.client).loadRegionPage('kaohsiung-city')).raceRows.length, REGION_RACE_LIMIT);
  await assert.rejects(
    createPublishedReadAdapter(oversized.client).loadRegionPage('kaohsiung-city'),
    /Published region races exceeded the 25-row batch limit/,
  );
});

test('election index uses one bounded RPC payload', async () => {
  const elections = [
    { election_id: 'election-2', name: '選舉二' },
    { election_id: 'election-1', name: '選舉一' },
  ];
  const summaries = [
    { election_id: 'election-1', race_count: 3, race_types: ['legislator'] },
    { election_id: 'election-2', race_count: 1, race_types: ['president'] },
  ];
  const fake = createFakeClient({
    'rpc:election_index_page': {
      data: [{ payload: { ...payloadMetadata, election_rows: elections, race_summary_rows: summaries } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadElectionIndex(), {
    electionRows: elections,
    raceSummaryRows: summaries,
  });
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['rpc', 'election_index_page', {}],
  ]);
});

test('election facets de-duplicate and batch at 200 ids with a fixed row ceiling', async () => {
  const electionIds = Array.from({ length: ELECTION_ID_BATCH_SIZE + 1 }, (_, index) => `election-${index}`);
  const firstFacet = { election_id: 'election-0', race_type: 'president', region_key: 'national' };
  const secondFacet = { election_id: `election-${ELECTION_ID_BATCH_SIZE}`, race_type: 'legislator', region_key: 'national' };
  const fake = createFakeClient({
    election_race_facets: [
      { data: [firstFacet], error: null, count: 1 },
      { data: [secondFacet], error: null, count: 1 },
    ],
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(
    await adapter.loadElectionRaceFacets([...electionIds, electionIds[0], '']),
    [firstFacet, secondFacet],
  );
  const idFilters = fake.calls.filter((call) => call[0] === 'in');
  assert.equal((idFilters[0]?.[2] as string[]).length, ELECTION_ID_BATCH_SIZE);
  assert.deepEqual(idFilters[1], ['in', 'election_id', [`election-${ELECTION_ID_BATCH_SIZE}`]]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'limit'), [
    ['limit', ELECTION_FACET_BATCH_LIMIT],
    ['limit', ELECTION_FACET_BATCH_LIMIT],
  ]);
});

test('election education distribution uses a bounded reviewed RPC with normalized filters', async () => {
  const row = {
    education_key: 'master',
    candidate_count: 10,
  };
  const fake = createFakeClient({
    'rpc:election_education_distribution': { data: [row], error: null, count: 1 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadElectionEducationDistribution(
    ' 2026-local ',
    ['election-1', 'election-1', ''],
    { raceTypes: ['councilor', 'councilor'], regionKey: ' taipei ' },
  ), [row]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'rpc'), [[
    'rpc',
    'election_education_distribution',
    {
      p_event_key: '2026-local',
      p_election_ids: ['election-1'],
      p_race_types: ['councilor'],
      p_region_key: 'taipei',
    },
  ]]);
  assert.equal(ELECTION_EDUCATION_DISTRIBUTION_LIMIT, 9);
});

test('election party performance uses a bounded reviewed RPC with normalized filters', async () => {
  const row = {
    party_name: '民主進步黨',
    candidate_count: 10,
    elected_count: 6,
    pending_count: 0,
  };
  const fake = createFakeClient({
    'rpc:election_party_performance': { data: [row], error: null, count: 1 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadElectionPartyPerformance(
    ' 2022-local ',
    ['election-1', 'election-1', ''],
    { raceTypes: ['councilor', 'councilor'], regionKey: ' taipei ' },
  ), [row]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'rpc'), [[
    'rpc',
    'election_party_performance',
    {
      p_event_key: '2022-local',
      p_election_ids: ['election-1'],
      p_race_types: ['councilor'],
      p_region_key: 'taipei',
    },
  ]]);
  assert.equal(ELECTION_PARTY_PERFORMANCE_LIMIT, 50);
});
test('party legal statistics reads exactly one aggregate row', async () => {
  const row = {
    party_name: '民主進步黨',
    total_people: 100,
    final_conviction_people: 2,
    non_final_people: 1,
    other_record_people: 1,
    acquittal_only_people: 1,
    no_confirmed_record_people: 95,
    confirmed_record_people: 5,
    record_count: 7,
    final_conviction_records: 3,
    non_final_records: 1,
    other_records: 1,
    acquittal_records: 2,
  };
  const fake = createFakeClient({
    'rpc:party_legal_statistics': { data: [row], error: null, count: 1 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyLegalStatistics(' 民主進步黨 '), row);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'rpc'), [[
    'rpc',
    'party_legal_statistics',
    { p_party_name: '民主進步黨' },
  ]]);
});

test('party legal statistics requires a non-empty party name', async () => {
  const fake = createFakeClient({});
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(
    () => adapter.loadPartyLegalStatistics(' '),
    /require a party name/u,
  );
  assert.deepEqual(fake.calls, []);
});


test('person profiles de-duplicate at most four ids and use one bounded payload', async () => {
  const person = { person_id: 'person-2', name: '測試人物' };
  const candidate = { candidate_id: 'candidate-1', person_id: 'person-2' };
  const claim = { claim_id: 'claim-1', person_id: 'person-2' };
  const affiliation = { affiliation_id: 'affiliation-1', person_id: 'person-2' };
  const fake = createFakeClient({
    'rpc:person_profiles_for': {
      data: [{ payload: { ...payloadMetadata,
        person_rows: [person],
        candidate_rows: [candidate],
        claim_rows: [claim],
        party_affiliation_rows: [affiliation],
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(
    await adapter.loadPersonProfiles([' person-2 ', 'person-1', 'person-2', '']),
    {
      personRows: [person],
      candidateRows: [candidate],
      claimRows: [claim],
      partyAffiliationRows: [affiliation],
    },
  );
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['rpc', 'person_profiles_for', { p_person_ids: ['person-2', 'person-1'] }],
  ]);
});

test('person profile reads reject more than four unique ids before querying', async () => {
  const fake = createFakeClient({});
  const adapter = createPublishedReadAdapter(fake.client);
  const personIds = Array.from(
    { length: PERSON_PROFILE_BATCH_LIMIT + 1 },
    (_, index) => `person-${index}`,
  );

  await assert.rejects(
    () => adapter.loadPersonProfiles(personIds),
    /Published person profiles accept at most 4 person ids/,
  );
  assert.deepEqual(fake.calls, []);
});

test('person profile reads fail closed when a payload collection exceeds its limit', async () => {
  const fake = createFakeClient({
    'rpc:person_profiles_for': {
      data: [{ payload: { ...payloadMetadata,
        person_rows: [],
        candidate_rows: Array.from({ length: PERSON_CANDIDATE_LIMIT + 1 }, (_, index) => ({
          candidate_id: `candidate-${index}`,
          person_id: 'person-1',
        })),
        claim_rows: [],
        party_affiliation_rows: [],
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(
    () => adapter.loadPersonProfiles(['person-1']),
    new RegExp(`Published person candidates exceeded the ${PERSON_CANDIDATE_LIMIT}-row batch limit`),
  );
});

test('person profile reads reject the claims payload sentinel row', async () => {
  const fake = createFakeClient({
    'rpc:person_profiles_for': {
      data: [{ payload: { ...payloadMetadata,
        person_rows: [],
        candidate_rows: [],
        claim_rows: Array.from({ length: PERSON_CLAIM_LIMIT + 1 }, (_, index) => ({
          claim_id: `claim-${index}`,
          person_id: 'person-1',
        })),
        party_affiliation_rows: [],
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(
    () => adapter.loadPersonProfiles(['person-1']),
    new RegExp(`Published person claims exceeded the ${PERSON_CLAIM_LIMIT}-row batch limit`),
  );
});

test('election race page uses one bounded RPC with normalized filters', async () => {
  const race = {
    race_id: 'race-1',
    election_id: 'election-1',
    election_name: '地方公職人員選舉',
    region_id: 'region-1',
    region_name: '新北市板橋區',
    region_slug: 'new-taipei-banqiao',
    race_type: 'village_chief',
    title: '里長選舉',
    voting_date: '2022-11-26',
    status: 'completed',
    source_name: '中選會',
    source_url: 'https://example.test/race-1',
  };
  const fake = createFakeClient({
    'rpc:election_race_page': {
      data: [{ items: [race], total: 1032 }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  const result = await adapter.loadElectionRacePage(
    ' 2022-2022-11-26-local ',
    ['election-2', 'election-1', 'election-2'],
    { raceTypes: ['village_chief', 'village_chief'], regionKey: ' 新北市 ', query: ' 臺北\t信義區 ' },
    2,
    200,
  );

  assert.deepEqual(result, { items: [race], total: 1032 });
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['rpc', 'election_race_page', {
      p_event_key: '2022-2022-11-26-local',
      p_election_ids: ['election-2', 'election-1'],
      p_race_types: ['village_chief'],
      p_region_key: '新北市',
      p_query: '台北 信義區',
      p_page: 2,
      p_page_size: ELECTION_RACE_PAGE_SIZE,
    }],
  ]);
});

test('election race page skips the RPC when no election ids remain', async () => {
  const fake = createFakeClient({});
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(
    await adapter.loadElectionRacePage('event', [' ', ''], {}, 1, 20),
    { items: [], total: 0 },
  );
  assert.deepEqual(fake.calls, []);
});

test('election race page rejects oversized election id batches', async () => {
  const fake = createFakeClient({});
  const adapter = createPublishedReadAdapter(fake.client);
  const electionIds = Array.from(
    { length: ELECTION_RACE_PAGE_ELECTION_LIMIT + 1 },
    (_, index) => `election-${index}`,
  );

  await assert.rejects(
    adapter.loadElectionRacePage('event', electionIds, {}, 1, 20),
    new RegExp(`at most ${ELECTION_RACE_PAGE_ELECTION_LIMIT} election ids`),
  );
  assert.deepEqual(fake.calls, []);
});

test('election race page surfaces function failures', async () => {
  const fake = createFakeClient({
    'rpc:election_race_page': {
      data: null,
      error: { message: 'function unavailable' },
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(
    adapter.loadElectionRacePage('event', ['election-1'], {}, 1, 20),
    /Published election race page query failed: function unavailable/,
  );
});

test('race detail combines linked candidates and unlinked registration names', async () => {
  const race = {
    race_id: 'race-1',
    election_id: 'election-1',
    race_type: 'municipality_mayor',
    title: '新北市長選舉',
  };
  const election = { election_id: 'election-1', name: '地方公職人員選舉', year: 2026 };
  const candidate = { candidate_id: 'candidate-1', person_id: 'person-1' };
  const partyAffiliation = { affiliation_id: 'affiliation-1', person_id: 'person-1' };
  const nameOnly = { candidate_id: 'registration-1', person_id: '', person_name: '純姓名登記者' };
  const fake = createFakeClient({
    'rpc:registration_names_for': { data: [nameOnly], error: null, count: null },
    'rpc:race_page_for': {
      data: [{ payload: { ...payloadMetadata,
        race_row: race,
        election_row: election,
        candidate_rows: [candidate],
        party_affiliation_rows: [partyAffiliation],
        referendum_question_row: null,
        referendum_option_rows: [],
        referendum_region_result_rows: [],
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadRaceDetail(' race-1 '), {
    raceRow: race,
    electionRow: election,
    candidateRows: [candidate, nameOnly],
    partyAffiliationRows: [partyAffiliation],
    partyListResultRows: [],
    referendumQuestionRow: null,
    referendumOptionRows: [],
    referendumRegionResultRows: [],
  });
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['rpc', 'race_page_for', { p_race_id: 'race-1' }],
    ['schema', 'published'],
    ['rpc', 'registration_names_for', { p_race_ids: ['race-1'] }],
  ]);
});

test('race detail returns the empty shape for a missing race payload', async () => {
  const fake = createFakeClient({
    'rpc:race_page_for': {
      data: [{ payload: { ...payloadMetadata,
        race_row: null,
        election_row: null,
        candidate_rows: [],
        party_affiliation_rows: [],
        referendum_question_row: null,
        referendum_option_rows: [],
        referendum_region_result_rows: [],
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadRaceDetail('missing-race'), {
    raceRow: null,
    electionRow: null,
    candidateRows: [],
    partyAffiliationRows: [],
    partyListResultRows: [],
    referendumQuestionRow: null,
    referendumOptionRows: [],
    referendumRegionResultRows: [],
  });
  assert.equal(fake.calls.filter((call) => call[0] === 'rpc').length, 1);
});

test('race detail payload includes a referendum question and bounded result rows', async () => {
  const race = { race_id: 'race-referendum', election_id: 'election-referendum', race_type: 'referendum' };
  const election = { election_id: 'election-referendum', election_type: 'referendum' };
  const question = { question_id: 'question-1', proposal_text: '您是否同意測試？' };
  const options = [
    { option_id: 'yes', question_id: 'question-1', display_order: 1 },
    { option_id: 'no', question_id: 'question-1', display_order: 2 },
  ];
  const regionResults = [{ result_id: 'result-1', question_id: 'question-1', region_name: '臺北市' }];
  const fake = createFakeClient({
    'rpc:race_page_for': {
      data: [{ payload: { ...payloadMetadata,
        race_row: race,
        election_row: election,
        candidate_rows: [],
        party_affiliation_rows: [],
        referendum_question_row: question,
        referendum_option_rows: options,
        referendum_region_result_rows: regionResults,
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadRaceDetail('race-referendum'), {
    raceRow: race,
    electionRow: election,
    candidateRows: [],
    partyAffiliationRows: [],
    partyListResultRows: [],
    referendumQuestionRow: question,
    referendumOptionRows: options,
    referendumRegionResultRows: regionResults,
  });
});

test('party-list race detail switches to the dedicated bounded RPC payload', async () => {
  const race = { race_id: 'race-party-list', election_id: 'election-1', race_type: 'party_list_legislator' };
  const candidates = Array.from({ length: 177 }, (_, index) => ({ candidate_id: `candidate-${index + 1}` }));
  const partyListResults = Array.from({ length: 16 }, (_, index) => ({
    result_id: `result-${index + 1}`,
    party_ballot_number: index + 1,
  }));
  const fake = createFakeClient({
    'rpc:race_page_for': {
      data: [{ payload: { ...payloadMetadata,
        race_row: race,
        election_row: { election_id: 'election-1' },
        candidate_rows: Array.from({ length: RACE_DETAIL_CANDIDATE_LIMIT + 1 }, (_, index) => ({ candidate_id: `sentinel-${index}` })),
        party_affiliation_rows: [],
        referendum_question_row: null,
        referendum_option_rows: [],
        referendum_region_result_rows: [],
      } }],
      error: null,
      count: null,
    },
    'rpc:party_list_race_page_for': {
      data: [{ payload: { ...payloadMetadata,
        race_row: race,
        election_row: { election_id: 'election-1' },
        candidate_rows: candidates,
        party_affiliation_rows: [],
        party_list_result_rows: partyListResults,
        referendum_question_row: null,
        referendum_option_rows: [],
        referendum_region_result_rows: [],
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  const detail = await adapter.loadRaceDetail('race-party-list');
  assert.equal(detail.candidateRows.length, 177);
  assert.equal(detail.partyListResultRows.length, 16);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'rpc'), [
    ['rpc', 'race_page_for', { p_race_id: 'race-party-list' }],
    ['rpc', 'party_list_race_page_for', { p_race_id: 'race-party-list' }],
  ]);
  assert.ok(detail.candidateRows.length <= RACE_DETAIL_PARTY_LIST_CANDIDATE_LIMIT);
  assert.ok(detail.partyListResultRows.length <= RACE_DETAIL_PARTY_LIST_RESULT_LIMIT);
});

test('race detail rejects a candidate payload sentinel row', async () => {
  const fake = createFakeClient({
    'rpc:race_page_for': {
      data: [{ payload: { ...payloadMetadata,
        race_row: { race_id: 'race-1' },
        election_row: null,
        candidate_rows: Array.from({ length: RACE_DETAIL_CANDIDATE_LIMIT + 1 }, (_, index) => ({
          candidate_id: `candidate-${index}`,
        })),
        party_affiliation_rows: [],
        referendum_question_row: null,
        referendum_option_rows: [],
        referendum_region_result_rows: [],
      } }],
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(
    adapter.loadRaceDetail('race-1'),
    new RegExp(`Published race candidates exceeded the ${RACE_DETAIL_CANDIDATE_LIMIT}-row`),
  );
});

test('local office reads one bounded current-role set for trusted district prefixes', async () => {
  const row = { person_id: 'person-1', name: '測試首長' };
  const fake = createFakeClient({
    people_directory: { data: [row], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(
    await adapter.loadLocalOfficePeople([' 臺北市 ', '台北市', '臺北市']),
    [row],
  );
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'people_directory'],
    ['select', PEOPLE_DIRECTORY_COLUMNS],
    ['eq', 'list_status', 'current'],
    ['in', 'list_role', ['local_chief', 'local_deputy', 'agency_head', 'councilor']],
    ['or', 'district.ilike.臺北市%,district.ilike.台北市%'],
    ['order', 'list_role_order', { ascending: true }],
    ['order', 'name', { ascending: true }],
    ['order', 'person_id', { ascending: true }],
    ['limit', LOCAL_OFFICE_PERSON_LIMIT + 1],
  ]);
});

test('local office skips the database when no trusted district prefix remains', async () => {
  const fake = createFakeClient({});
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadLocalOfficePeople([' ', '']), []);
  assert.deepEqual(fake.calls, []);
});

test('local office rejects a person sentinel row', async () => {
  const fake = createFakeClient({
    people_directory: {
      data: Array.from({ length: LOCAL_OFFICE_PERSON_LIMIT + 1 }, (_, index) => ({
        person_id: `person-${index}`,
      })),
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(
    adapter.loadLocalOfficePeople(['臺北市']),
    new RegExp(`Published local office people exceeded the ${LOCAL_OFFICE_PERSON_LIMIT}-row`),
  );
});

test('national office summary requires all twelve ordered slots', async () => {
  const rows = Array.from({ length: NATIONAL_OFFICE_HOLDER_LIMIT }, (_, index) => ({
    institution_key: index < 2 ? 'presidency' : 'executive_yuan',
    role_key: index % 2 === 0 ? 'chief' : 'deputy',
    display_order: index,
  }));
  const fake = createFakeClient({
    national_office_holders: { data: rows, error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadNationalOfficeHolders(), rows);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'national_office_holders'],
    ['select', NATIONAL_OFFICE_HOLDER_COLUMNS],
    ['order', 'display_order', { ascending: true }],
    ['limit', NATIONAL_OFFICE_HOLDER_LIMIT + 1],
  ]);
});

test('current legislator party summary reads one bounded aggregate', async () => {
  const rows = [
    { party_name: '中國國民黨', legislator_count: 52 },
    { party_name: '民主進步黨', legislator_count: 51 },
  ];
  const fake = createFakeClient({
    current_legislator_party_summary: { data: rows, error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadCurrentLegislatorPartySummary(), rows);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'current_legislator_party_summary'],
    ['select', LEGISLATOR_PARTY_SUMMARY_COLUMNS],
    ['order', 'legislator_count', { ascending: false }],
    ['order', 'party_name', { ascending: true }],
    ['limit', LEGISLATOR_PARTY_SUMMARY_LIMIT + 1],
  ]);
});

test('public update feed reads only the newest bounded published rows', async () => {
  const row = {
    update_id: 'update-1',
    update_type: 'site',
    title: '公開更新動態上線',
    summary: '測試公開更新。',
    published_at: '2026-08-11T01:00:00Z',
  };
  const fake = createFakeClient({
    update_feed: { data: [row], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPublicUpdates(PUBLIC_UPDATE_LIMIT + 10), [row]);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'update_feed'],
    ['select', PUBLIC_UPDATE_COLUMNS],
    ['order', 'published_at', { ascending: false }],
    ['order', 'update_id', { ascending: false }],
    ['limit', PUBLIC_UPDATE_LIMIT],
  ]);
});


test('party directory is a separate long-lived reference query', async () => {
  const party = { party_id: 'party-1', name: 'Test Party' };
  const fake = createFakeClient({
    parties: { data: [party], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyDirectory(), [party]);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'parties'],
    ['select', PARTY_COLUMNS],
    ['order', 'name', { ascending: true }],
    ['order', 'party_id', { ascending: true }],
    ['limit', PARTY_LIMIT + 1],
  ]);
});
test('party finance data excludes company contribution details', async () => {
  const annualFinance = { party_id: 'party-1', report_year: 2025 };
  const finance = { party_id: 'party-1', report_year: 2024 };
  const fake = createFakeClient({
    party_annual_finance_filings: { data: [annualFinance], error: null, count: null },
    party_finance_summaries: { data: [finance], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyData(), {
    partyRows: [],
    annualFinanceFilingRows: [annualFinance],
    financeRows: [finance],
  });
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'from'), [
    ['from', 'party_annual_finance_filings'],
    ['from', 'party_finance_summaries'],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'select'), [
    ['select', PARTY_ANNUAL_FINANCE_COLUMNS],
    ['select', PARTY_FINANCE_COLUMNS],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'limit'), [
    ['limit', PARTY_ANNUAL_FINANCE_LIMIT + 1],
    ['limit', PARTY_FINANCE_LIMIT + 1],
  ]);
});

test('party company contribution counts use one bounded aggregate RPC', async () => {
  const counts = [
    { party_id: 'party-1', contribution_count: 12 },
    { party_id: 'party-2', contribution_count: 3 },
  ];
  const fake = createFakeClient({
    'rpc:party_company_contribution_counts': {
      data: counts,
      error: null,
      count: null,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyCompanyContributionCounts(), counts);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['rpc', 'party_company_contribution_counts', {}],
  ]);
});

test('party company contributions use server pagination and an exact total', async () => {
  const contribution = { party_id: 'party-1', company_id: 'company-1' };
  const fake = createFakeClient({
    party_company_contribution_summaries: {
      data: [contribution],
      error: null,
      count: 120,
    },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyCompanyContributionPage(' party-1 ', 2, 200), {
    rows: [contribution],
    total: 120,
  });
  assert.deepEqual(fake.calls.filter((call) => ['select', 'eq', 'range'].includes(call[0])), [
    ['select', PARTY_COMPANY_CONTRIBUTION_COLUMNS, { count: 'exact' }],
    ['eq', 'party_id', 'party-1'],
    ['range', PARTY_COMPANY_CONTRIBUTION_PAGE_SIZE, PARTY_COMPANY_CONTRIBUTION_PAGE_SIZE * 2 - 1],
  ]);
});

test('party officers read one deterministic bounded roster', async () => {
  const officer = { affiliation_id: 'affiliation-1', party_id: 'party-1' };
  const fake = createFakeClient({
    party_officers: { data: [officer], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyOfficers(' party-1 '), [officer]);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'party_officers'],
    ['select', PARTY_OFFICER_COLUMNS],
    ['eq', 'party_id', 'party-1'],
    ['order', 'display_order', { ascending: true, nullsFirst: false }],
    ['order', 'person_name', { ascending: true }],
    ['order', 'affiliation_id', { ascending: true }],
    ['limit', PARTY_OFFICER_LIMIT + 1],
  ]);
});

test('party officers skip the database for an empty party id', async () => {
  const fake = createFakeClient({});
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyOfficers(' '), []);
  assert.deepEqual(fake.calls, []);
});

test('party platform history uses one bounded reviewed RPC', async () => {
  const record = { result_id: 'result-1', election_year: 2024 };
  const fake = createFakeClient({
    'rpc:party_platform_history_for': { data: [record], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyPlatformHistory(' party-1 '), [record]);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['rpc', 'party_platform_history_for', { p_party_id: 'party-1' }],
  ]);

  const oversized = createFakeClient({
    'rpc:party_platform_history_for': {
      data: Array.from({ length: PARTY_PLATFORM_HISTORY_LIMIT + 1 }, (_, index) => ({ result_id: String(index) })),
      error: null,
      count: null,
    },
  });
  await assert.rejects(
    () => createPublishedReadAdapter(oversized.client).loadPartyPlatformHistory('party-1'),
    /exceeded the 16-row batch limit/u,
  );
});
test('party people statistics use the published RPC and require all buckets', async () => {
  const bucketPairs = [
    ['current_status', 'current'],
    ['current_status', 'not_current'],
    ['gender', 'male'],
    ['gender', 'female'],
    ['gender', 'unknown'],
    ['age', 'under_40'],
    ['age', '40_49'],
    ['age', '50_59'],
    ['age', '60_plus'],
    ['age', 'unknown'],
    ['education', 'doctorate'],
    ['education', 'master'],
    ['education', 'university'],
    ['education', 'tertiary_unspecified'],
    ['education', 'junior_college'],
    ['education', 'high_school'],
    ['education', 'secondary_or_below'],
    ['education', 'other'],
    ['education', 'unknown'],
  ];
  const rows = bucketPairs.map(([dimension_key, bucket_key]) => ({
    party_name: '民主進步黨',
    dimension_key,
    bucket_key,
    people_count: 0,
    total_people: 1,
  }));
  const fake = createFakeClient({
    'rpc:party_people_statistics': { data: rows, error: null, count: 19 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadPartyPeopleStatistics(' 民主進步黨 '), rows);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'rpc'), [[
    'rpc',
    'party_people_statistics',
    { p_party_name: '民主進步黨' },
  ]]);
});

test('party people statistics require a non-empty party name', async () => {
  const fake = createFakeClient({});
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(
    () => adapter.loadPartyPeopleStatistics(' '),
    /require a party name/u,
  );
  assert.deepEqual(fake.calls, []);
});
