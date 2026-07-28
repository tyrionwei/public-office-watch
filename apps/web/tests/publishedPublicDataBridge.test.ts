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

test('bridge resolves region filters and maps a published people page to frontend rows', async () => {
  const requests: PublishedPeoplePageRequest[] = [];
  const adapter: PublishedReadAdapter = {
    async loadPeoplePage(request) {
      requests.push(request);
      return { rows: [peopleRow], total: 1 };
    },
    async search() {
      return [];
    },
  };
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
  const adapter: PublishedReadAdapter = {
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
  };
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
  const adapter: PublishedReadAdapter = {
    async loadPeoplePage(nextRequest) {
      request = nextRequest;
      return { rows: [], total: 0 };
    },
    async search() {
      return [];
    },
  };
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
