import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertLocalSupabase,
  buildPendingClaims,
  selectClaimSyncActions,
} from './stage-cec-2022-councilor-profile-ocr-review.mjs';

const entry = {
  candidateId: '00000000-0000-4000-8000-000000000001',
  personId: '00000000-0000-4000-8000-000000000002',
  raceTitle: '屏東縣第10選舉區山地原住民議員選舉',
  sourceDocument: {
    file: 'tmp/example.pdf',
    url: 'https://bulletin.cec.gov.tw/example.pdf',
    sha256: 'a'.repeat(64),
  },
  ocr: {
    page: 1,
    geometrySource: 'image_table_lines_and_district_heading',
    educationRaw: '國立大學畢業',
    education: '國立大學畢業',
    experienceRaw: '現任議員',
    experience: '現任議員',
    birthDateRaw: '60年1月2日',
    birthDate: '1971-01-02',
    genderRaw: '女',
    gender: '女',
    cropFiles: { education: 'education.png', experience: 'experience.png', birth: 'birth.png', gender: 'gender.png' },
  },
};

test('builds only private pending claims with official evidence', () => {
  const claims = buildPendingClaims(entry);
  assert.deepEqual(claims.map((claim) => claim.claim_type), ['education', 'experience', 'birth_date', 'gender']);
  assert.ok(claims.every((claim) => claim.review_status === 'pending'));
  assert.ok(claims.every((claim) => claim.visibility === 'private' && claim.is_public === false));
  assert.ok(claims.every((claim) => claim.candidate_id === entry.candidateId));
  assert.ok(claims.every((claim) => claim.claim_json.identityMapping.candidateLinkNameVerified === false));
});

test('refuses non-local Supabase targets', () => {
  assert.doesNotThrow(() => assertLocalSupabase('http://127.0.0.1:54321'));
  assert.throws(() => assertLocalSupabase('https://production.example.com'));
});

test('stages new claims and archives only stale private pending claims', () => {
  const expected = [{ claim_key: 'expected' }];
  const existing = [
    { claim_key: 'stale', review_status: 'pending', visibility: 'private', is_public: false },
    { claim_key: 'verified', review_status: 'verified', visibility: 'public', is_public: true },
  ];
  const actions = selectClaimSyncActions(expected, existing);
  assert.deepEqual(actions.claims, expected);
  assert.deepEqual(actions.staleClaims.map((claim) => claim.claim_key), ['stale']);
});
