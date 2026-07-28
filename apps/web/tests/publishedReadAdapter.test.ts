import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PEOPLE_DIRECTORY_COLUMNS,
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

function createFakeClient(responses: Record<string, FakeResponse>) {
  const calls: RecordedCall[] = [];

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
              return Promise.resolve(responses[relationName]).then(onFulfilled, onRejected);
            },
          };
          return query;
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
