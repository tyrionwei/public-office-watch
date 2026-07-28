import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicPersonListItem } from '../src/types/publicViews.ts';
import type { PublishedPublicDataBridge } from '../src/lib/publishedPublicDataBridge.ts';
import { createPublishedPublicDataProvider } from '../src/lib/publishedPublicDataProvider.ts';

const person: PublicPersonListItem = {
  person_id: 'person-1',
  name: '測試市長',
  alias: null,
  gender: 'female',
  party: '測試黨',
  position: '市長',
  current_office_label: '臺北市長',
  upcoming_candidate_label: null,
  election_year: 2022,
  district: '臺北市',
  education: null,
  experience: null,
  updated_at: '2026-07-28T00:00:00Z',
  primary_photo_url: null,
  primary_photo_thumbnail_url: null,
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
  candidate_count: 1,
  external_ids: [],
  merged_person_ids: ['person-1'],
  merged_role_labels: ['縣市首長'],
  merged_candidate_count: 1,
};

function createBridge(overrides: Partial<PublishedPublicDataBridge> = {}) {
  return {
    async loadHomePageData() {
      return {
        ticker: { title: '2026 地方選舉', date: '2026-11-28', electionId: 'election-1' },
        regions: [{
          id: 'taipei',
          name: '臺北市',
          tone: '公開資料導覽區塊',
          electionName: '2026 地方選舉',
          nextVotingDate: '2026-11-28',
          upcomingRaceCount: 1,
        }],
        stageRegions: [{
          id: 'taipei',
          label: '臺北市',
          level: 'county_city',
          parentId: null,
          publicRegionId: 'region-taipei',
          displayOrder: 1,
          stageLabel: 'TPE',
          isPlaceholder: false,
          note: 'published region',
        }],
        stageRegionSummaries: [{
          regionId: 'taipei',
          label: '臺北市',
          nearestElectionName: '2026 地方選舉',
          nearestElectionDate: '2026-11-28',
          upcomingRaceCount: 1,
          sourceNote: 'published',
          boundaryNote: 'published',
        }],
        upcomingRaces: [{
          id: 'race-1',
          electionId: 'election-1',
          title: '臺北市長',
          region: '臺北市',
          regionId: 'taipei',
          date: '2026-11-28',
          status: 'upcoming',
          raceType: 'mayor',
          partyTag: 'unknown',
          partyLabel: '未知',
        }],
        dataPrinciples: ['published'],
      };
    },
    async loadRegionPageData() {
      return { region: null, summary: null, card: null, childRegions: [], relatedRaces: [] };
    },
    async loadPartyData() {
      return {
        parties: [{
          party_id: 'party-1',
          name: '測試黨',
          short_name: null,
          slug: 'test-party',
          theme_key: 'unknown',
          official_site_url: null,
          chairperson_name: null,
          registry_no: null,
          founded_date_text: null,
          filed_date_text: null,
          headquarters_address: null,
          contact_phone: null,
          status: 'active',
          source_name: null,
          source_url: null,
          updated_at: '2026-07-28T00:00:00Z',
        }],
        financeSummaries: [],
        companyContributionSummaries: [],
      };
    },
    async loadElectionIndex() {
      return { elections: [], raceSummaries: [] };
    },
    async loadElectionRaceFacets() {
      return [];
    },
    async loadElectionRacePage() {
      return { items: [], total: 0 };
    },
    async loadRaceDetail() {
      return { race: null, election: null, candidates: [] };
    },
    async loadPeoplePage() {
      return { items: [person], total: 1 };
    },
    async loadPersonProfiles() {
      return [];
    },
    async loadLocalOfficeSummaryByRegionId(regionId: string) {
      return {
        region_id: regionId,
        region_name: '臺北市',
        chief_executive: person,
        deputies: [],
        agency_heads: [],
        councilor_party_counts: [],
        councilor_total: 0,
        data_status: [],
      };
    },
    async loadPartyOfficers() {
      return [];
    },
    async searchPublicRecords() {
      return [];
    },
    ...overrides,
  } as PublishedPublicDataBridge;
}

test('published provider refreshes home and party snapshots atomically and caches bounded rows', async () => {
  let homeCalls = 0;
  const baseBridge = createBridge();
  const bridge = createBridge({
    async loadHomePageData() {
      homeCalls += 1;
      return baseBridge.loadHomePageData();
    },
  });
  const assembly = createPublishedPublicDataProvider(bridge);

  await Promise.all([assembly.refresh(), assembly.refresh()]);

  assert.equal(homeCalls, 1);
  assert.equal(assembly.provider.getHomeTicker().electionId, 'election-1');
  assert.equal(assembly.provider.getStageRegion('region-taipei')?.label, '臺北市');
  assert.equal(assembly.provider.getRelatedRacesByRegionId('taipei')[0]?.id, 'race-1');
  assert.equal(assembly.provider.getPartyBySlug('test-party')?.party_id, 'party-1');

  const page = await assembly.provider.loadPeoplePage({}, 1, 20);
  assert.equal(page.total, 1);
  assert.equal(assembly.provider.getPersonById('person-1')?.name, '測試市長');
});

test('published provider keeps the last complete snapshot when refresh fails and can retry', async () => {
  let fail = true;
  const baseBridge = createBridge();
  const bridge = createBridge({
    async loadHomePageData() {
      if (fail) throw new Error('home failed');
      return baseBridge.loadHomePageData();
    },
  });
  const assembly = createPublishedPublicDataProvider(bridge);

  await assert.rejects(() => assembly.refresh(), /home failed/);
  assert.equal(assembly.provider.getHomeTicker().electionId, null);

  fail = false;
  await assembly.refresh();
  assert.equal(assembly.provider.getHomeTicker().electionId, 'election-1');
});
