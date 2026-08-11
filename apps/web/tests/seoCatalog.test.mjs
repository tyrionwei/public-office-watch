import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSeoCatalog, fetchPublishedRows, writeSeoCatalogFiles } from '../scripts/generate-seo-catalog.mjs';

test('creates deduplicated public entity metadata from published rows', () => {
  const catalog = createSeoCatalog({
    people: [
      {
        person_id: 'person/1',
        name: '王小明',
        party: '測試黨',
        current_office_label: '市議員',
        updated_at: '2026-08-10T12:00:00Z',
      },
      { person_id: 'person/1', name: '重複資料' },
    ],
    parties: [{ party_id: 'party-1', name: '測試黨', slug: 'test-party' }],
    regions: [{ region_id: 'region-1', name: '臺北市', slug: 'taipei' }],
    elections: [{ election_id: 'election-1', name: '2026 地方選舉', voting_date: '2026-11-28' }],
    races: [{ race_id: 'race-1', title: '臺北市長', election_name: '2026 地方選舉', region_name: '臺北市' }],
  }, '2026-08-11T00:00:00.000Z');

  assert.equal(catalog.version, 1);
  assert.equal(catalog.pages.length, 5);
  assert.equal(catalog.pages.find((page) => page.group === 'people').path, '/people/person%2F1');
  assert.match(catalog.pages.find((page) => page.group === 'people').description, /測試黨、市議員/);
  assert.equal(catalog.pages.find((page) => page.group === 'elections').structuredData['@type'], 'Event');
});

test('reads the published schema with the anon credential and bounded pages', async () => {
  const requests = [];
  const rows = await fetchPublishedRows({
    supabaseUrl: 'https://database.example',
    anonKey: 'anon-key',
    relation: 'parties',
    columns: 'party_id,name',
    orderColumn: 'party_id',
    fetchImpl: async (url, options) => {
      requests.push({ url: url.toString(), options });
      return new Response([{ party_id: 'party-1', name: '測試黨' }].length
        ? JSON.stringify([{ party_id: 'party-1', name: '測試黨' }])
        : '[]', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  assert.equal(rows.length, 1);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /rest\/v1\/parties/);
  assert.equal(requests[0].options.headers['accept-profile'], 'published');
  assert.equal(requests[0].options.headers.authorization, 'Bearer anon-key');
});

test('writes a lightweight manifest and one bounded file per SEO group', () => {
  const directory = mkdtempSync(join(tmpdir(), 'public-office-watch-seo-'));
  try {
    const catalog = createSeoCatalog({
      people: [{ person_id: 'person-1', name: '王小明' }],
      parties: [],
      regions: [],
      elections: [],
      races: [],
    }, '2026-08-11T00:00:00.000Z');
    const outputPath = join(directory, 'seo-catalog.json');
    const manifest = writeSeoCatalogFiles(catalog, outputPath);
    const people = JSON.parse(readFileSync(join(directory, 'seo-catalog', 'people-0.json'), 'utf8'));

    assert.equal(manifest.version, 3);
    assert.deepEqual(manifest.groups.people, { paths: ['/seo-catalog/people-0.json'], count: 1 });
    assert.equal(people.pages[0].path, '/people/person-1');
    assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).groups.people.count, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
