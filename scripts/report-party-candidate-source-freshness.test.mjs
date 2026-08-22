import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSourceFreshnessReport } from './report-party-candidate-source-freshness.mjs';

function snapshot(records) {
  return {
    schemaVersion: 1,
    electionYear: 2026,
    sourceType: 'official_party_nomination',
    party: '民主進步黨',
    source: {
      name: '測試黨候選人專區',
      url: 'https://www.dpp.org.tw/candidates',
      publishedAt: null,
      retrievedAt: '2026-07-30T00:00:00.000Z',
    },
    records,
  };
}

function record(overrides = {}) {
  return {
    sourceCandidateKey: 'test-2026-001',
    personName: '王小明',
    candidacyStatus: 'party_nominee',
    raceType: 'city_councilor',
    regionName: '臺北市',
    districtName: '第一選區',
    nominationAnnouncedAt: '2026-07-01',
    profileUrl: 'https://www.dpp.org.tw/candidates/1',
    photoUrl: null,
    education: ['測試大學'],
    experience: [],
    platform: ['測試政見'],
    socialLinks: [],
    ...overrides,
  };
}

function stagedRow(candidate = record()) {
  return {
    source_id: candidate.sourceCandidateKey,
    source_name: '測試黨候選人專區',
    source_url: candidate.profileUrl,
    raw_name: candidate.personName,
    party: '民主進步黨',
    source_payload: {
      sourceCandidateKey: candidate.sourceCandidateKey,
      candidacyStatus: candidate.candidacyStatus,
      nominationAnnouncedAt: candidate.nominationAnnouncedAt,
      profileUrl: candidate.profileUrl,
      photoUrl: candidate.photoUrl,
      education: candidate.education,
      experience: candidate.experience,
      platform: candidate.platform,
      socialLinks: candidate.socialLinks,
      targetRace: {
        id: 'race-1',
        title: '不參與來源差異比較',
        raceType: candidate.raceType,
        regionName: candidate.regionName,
        districtName: candidate.districtName,
      },
      identitySuggestion: { resolution: 'new_person_review' },
    },
  };
}

test('reports unchanged, changed, missing, and staged-only source records', () => {
  const unchanged = record();
  const changed = record({ sourceCandidateKey: 'test-2026-002', personName: '陳小華', platform: ['新版政見'] });
  const missing = record({ sourceCandidateKey: 'test-2026-003', personName: '林小美' });
  const oldChanged = { ...changed, platform: ['舊版政見'] };
  const stagedOnly = record({ sourceCandidateKey: 'test-2026-old', personName: '舊候選人' });

  const report = buildSourceFreshnessReport(
    [{ snapshot: snapshot([unchanged, changed, missing]), freshnessMode: 'live_fetch', inputPath: 'latest.json' }],
    [stagedRow(unchanged), stagedRow(oldChanged), stagedRow(stagedOnly)],
    '2026-07-30T00:00:00.000Z',
  );

  assert.deepEqual(report.summary, {
    latestRecordCount: 3,
    stagedRecordCount: 3,
    matchedCount: 2,
    unchangedCount: 1,
    changedCount: 1,
    missingInStagedCount: 1,
    stagedOnlyCount: 1,
    liveFetchRecordCount: 3,
    browserSnapshotRecordCount: 0,
  });
  assert.deepEqual(report.changed[0].changedFields, ['platform']);
  assert.equal(report.missingInStaged[0].sourceCandidateKey, 'test-2026-003');
  assert.equal(report.stagedOnly[0].sourceCandidateKey, 'test-2026-old');
});

test('rejects duplicate source candidate keys across snapshots', () => {
  const duplicate = record();
  assert.throws(() => buildSourceFreshnessReport([
    { snapshot: snapshot([duplicate]), freshnessMode: 'live_fetch', inputPath: 'one.json' },
    { snapshot: snapshot([duplicate]), freshnessMode: 'browser_snapshot', inputPath: 'two.json' },
  ], []), /duplicate sourceCandidateKey/u);
});

test('treats full-width and ASCII district separators as equivalent', () => {
  const latest = record({ districtName: '第1選區|平地原住民' });
  const staged = stagedRow({ ...latest, districtName: '第1選區｜平地原住民' });
  const report = buildSourceFreshnessReport([
    { snapshot: snapshot([latest]), freshnessMode: 'live_fetch', inputPath: 'latest.json' },
  ], [staged]);

  assert.equal(report.summary.unchangedCount, 1);
  assert.equal(report.summary.changedCount, 0);
});
