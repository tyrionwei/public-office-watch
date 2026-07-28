import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ELECTION_COLUMNS,
  ELECTION_FACET_BATCH_LIMIT,
  ELECTION_ID_BATCH_SIZE,
  ELECTION_INDEX_LIMIT,
  ELECTION_RACE_PAGE_ELECTION_LIMIT,
  ELECTION_RACE_PAGE_SIZE,
  HOME_RACE_LIMIT,
  HOME_REGION_LIMIT,
  LOCAL_OFFICE_PERSON_LIMIT,
  PEOPLE_DIRECTORY_COLUMNS,
  PERSON_CANDIDATE_LIMIT,
  PERSON_CANDIDATE_COLUMNS,
  PERSON_CLAIM_LIMIT,
  PERSON_PARTY_AFFILIATION_LIMIT,
  PERSON_PROFILE_BATCH_LIMIT,
  RACE_DETAIL_CANDIDATE_LIMIT,
  RACE_DETAIL_COLUMNS,
  REGION_CHILD_LIMIT,
  REGION_RACE_LIMIT,
  SEARCH_RESULT_COLUMNS,
  createPublishedReadAdapter,
  type PublishedSchemaClient,
} from '../src/lib/publishedReadAdapter.ts';

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

test('search reads at most 12 normalized published results', async () => {
  const row = { document_key: 'region:tp', entity_type: 'region', entity_id: 'tp', title: '臺北市' };
  const fake = createFakeClient({
    search_results: { data: [row], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  const result = await adapter.search('  臺北  ');

  assert.deepEqual(result, [row]);
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'search_results'],
    ['select', SEARCH_RESULT_COLUMNS],
    ['like', 'normalized_search_text', '%台北%'],
    ['order', 'entity_type', { ascending: true }],
    ['order', 'title', { ascending: true }],
    ['order', 'document_key', { ascending: true }],
    ['limit', 12],
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
    search_results: { data: null, error: { message: 'permission denied' }, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(() => adapter.search('台北'), /Published search query failed: permission denied/);
});

test('home reads four published surfaces with fixed limits and deterministic order', async () => {
  const ticker = { election_id: 'election-1', election_name: '測試選舉' };
  const regionSummary = { region_id: 'region-taipei', region_name: '臺北市' };
  const region = { region_id: 'region-taipei', name: '臺北市', slug: 'taipei' };
  const race = { race_id: 'race-1', title: '臺北市長' };
  const fake = createFakeClient({
    home_ticker: { data: [ticker], error: null, count: null },
    home_region_summary: { data: [regionSummary], error: null, count: null },
    regions: { data: [region], error: null, count: null },
    races: { data: [race], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadHomePage(), {
    tickerRows: [ticker],
    regionSummaryRows: [regionSummary],
    regionRows: [region],
    raceRows: [race],
  });
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'from'), [
    ['from', 'home_ticker'],
    ['from', 'home_region_summary'],
    ['from', 'regions'],
    ['from', 'races'],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'limit'), [
    ['limit', 1],
    ['limit', HOME_REGION_LIMIT],
    ['limit', HOME_REGION_LIMIT],
    ['limit', HOME_RACE_LIMIT],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'in'), [
    ['in', 'region_type', ['country', 'municipality', 'county', 'city']],
    ['in', 'status', ['announced', 'upcoming', 'registration_open', 'candidates_announced', 'voting']],
  ]);
});

test('region page resolves one slug and bounds direct children and related races', async () => {
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
    regions: [
      { data: [region], error: null, count: null },
      { data: [child], error: null, count: null },
    ],
    home_region_summary: { data: [summary], error: null, count: null },
    races: { data: [race], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadRegionPage(' taipei '), {
    regionRow: region,
    summaryRow: summary,
    childRegionRows: [child],
    raceRows: [race],
  });
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'from'), [
    ['from', 'regions'],
    ['from', 'home_region_summary'],
    ['from', 'races'],
    ['from', 'regions'],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'eq'), [
    ['eq', 'slug', 'taipei'],
    ['eq', 'region_slug', 'taipei'],
    ['eq', 'region_slug', 'taipei'],
    ['eq', 'parent_region_id', 'region-taipei'],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'limit'), [
    ['limit', 1],
    ['limit', 1],
    ['limit', REGION_RACE_LIMIT],
    ['limit', REGION_CHILD_LIMIT],
  ]);
});

test('election index bounds elections and loads only matching summaries', async () => {
  const elections = [
    { election_id: 'election-2', name: '選舉二' },
    { election_id: 'election-1', name: '選舉一' },
  ];
  const summaries = [
    { election_id: 'election-1', race_count: 3, race_types: ['legislator'] },
    { election_id: 'election-2', race_count: 1, race_types: ['president'] },
  ];
  const fake = createFakeClient({
    elections: { data: elections, error: null, count: null },
    election_race_summaries: { data: summaries, error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadElectionIndex(), {
    electionRows: elections,
    raceSummaryRows: summaries,
  });
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'from'), [
    ['from', 'elections'],
    ['from', 'election_race_summaries'],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'in'), [
    ['in', 'election_id', ['election-2', 'election-1']],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'limit'), [
    ['limit', ELECTION_INDEX_LIMIT],
    ['limit', 2],
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

test('person profiles de-duplicate at most four ids and bound every published relation', async () => {
  const person = { person_id: 'person-2', name: '測試人物' };
  const candidate = { candidate_id: 'candidate-1', person_id: 'person-2' };
  const claim = { claim_id: 'claim-1', person_id: 'person-2' };
  const affiliation = { affiliation_id: 'affiliation-1', person_id: 'person-2' };
  const fake = createFakeClient({
    people: { data: [person], error: null, count: null },
    candidates: { data: [candidate], error: null, count: 1 },
    'rpc:person_claims_for': { data: [claim], error: null, count: null },
    person_party_affiliations: { data: [affiliation], error: null, count: 1 },
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
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'from'), [
    ['from', 'people'],
    ['from', 'candidates'],
    ['from', 'person_party_affiliations'],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'rpc'), [
    ['rpc', 'person_claims_for', { p_person_ids: ['person-2', 'person-1'] }],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'in'), [
    ['in', 'person_id', ['person-2', 'person-1']],
    ['in', 'person_id', ['person-2', 'person-1']],
    ['in', 'person_id', ['person-2', 'person-1']],
  ]);
  assert.deepEqual(fake.calls.filter((call) => call[0] === 'limit'), [
    ['limit', 2],
    ['limit', PERSON_CANDIDATE_LIMIT + 1],
    ['limit', PERSON_PARTY_AFFILIATION_LIMIT + 1],
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

test('person profile reads fail closed when a related-row limit truncates data', async () => {
  const fake = createFakeClient({
    people: { data: [], error: null, count: null },
    candidates: {
      data: Array.from({ length: PERSON_CANDIDATE_LIMIT + 1 }, (_, index) => ({
        candidate_id: `candidate-${index}`,
        person_id: 'person-1',
      })),
      error: null,
      count: null,
    },
    'rpc:person_claims_for': { data: [], error: null, count: null },
    person_party_affiliations: { data: [], error: null, count: 0 },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  await assert.rejects(
    () => adapter.loadPersonProfiles(['person-1']),
    new RegExp(`Published person candidates exceeded the ${PERSON_CANDIDATE_LIMIT}-row batch limit`),
  );
});

test('person profile reads reject the claims RPC sentinel row', async () => {
  const fake = createFakeClient({
    people: { data: [], error: null, count: null },
    candidates: { data: [], error: null, count: null },
    'rpc:person_claims_for': {
      data: Array.from({ length: PERSON_CLAIM_LIMIT + 1 }, (_, index) => ({
        claim_id: `claim-${index}`,
        person_id: 'person-1',
      })),
      error: null,
      count: null,
    },
    person_party_affiliations: { data: [], error: null, count: null },
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
    { raceTypes: ['village_chief', 'village_chief'], regionKey: ' 新北市 ' },
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

test('race detail reads one race then bounded election and candidate rows', async () => {
  const race = {
    race_id: 'race-1',
    election_id: 'election-1',
    election_name: '地方公職人員選舉',
    region_id: 'region-1',
    region_name: '新北市',
    region_slug: 'new-taipei',
    race_type: 'municipality_mayor',
    title: '新北市長選舉',
    voting_date: '2022-11-26',
    status: 'completed',
    source_name: '中央選舉委員會',
    source_url: 'https://example.test/race-1',
  };
  const election = {
    election_id: 'election-1',
    name: '地方公職人員選舉',
    year: 2022,
    election_type: 'local',
    voting_date: '2022-11-26',
    status: 'completed',
    source_name: '中央選舉委員會',
    source_url: 'https://example.test/election-1',
  };
  const candidate = {
    candidate_id: 'candidate-1',
    person_id: 'person-1',
    person_name: '測試候選人',
    race_id: 'race-1',
    election_id: 'election-1',
  };
  const fake = createFakeClient({
    races: { data: [race], error: null, count: null },
    elections: { data: [election], error: null, count: null },
    candidates: { data: [candidate], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadRaceDetail(' race-1 '), {
    raceRow: race,
    electionRow: election,
    candidateRows: [candidate],
  });
  assert.deepEqual(fake.calls, [
    ['schema', 'published'],
    ['from', 'races'],
    ['select', RACE_DETAIL_COLUMNS],
    ['eq', 'race_id', 'race-1'],
    ['limit', 1],
    ['from', 'elections'],
    ['select', ELECTION_COLUMNS],
    ['eq', 'election_id', 'election-1'],
    ['limit', 1],
    ['from', 'candidates'],
    ['select', PERSON_CANDIDATE_COLUMNS],
    ['eq', 'race_id', 'race-1'],
    ['order', 'candidate_no', { ascending: true, nullsFirst: false }],
    ['order', 'person_name', { ascending: true }],
    ['order', 'candidate_id', { ascending: true }],
    ['limit', RACE_DETAIL_CANDIDATE_LIMIT + 1],
  ]);
});

test('race detail stops after a missing race', async () => {
  const fake = createFakeClient({
    races: { data: [], error: null, count: null },
  });
  const adapter = createPublishedReadAdapter(fake.client);

  assert.deepEqual(await adapter.loadRaceDetail('missing-race'), {
    raceRow: null,
    electionRow: null,
    candidateRows: [],
  });
  assert.equal(fake.calls.some((call) => call[0] === 'from' && call[1] === 'candidates'), false);
});

test('race detail rejects a candidate sentinel row', async () => {
  const fake = createFakeClient({
    races: {
      data: [{ race_id: 'race-1', election_id: 'election-1' }],
      error: null,
      count: null,
    },
    elections: { data: [], error: null, count: null },
    candidates: {
      data: Array.from({ length: RACE_DETAIL_CANDIDATE_LIMIT + 1 }, (_, index) => ({
        candidate_id: `candidate-${index}`,
      })),
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
