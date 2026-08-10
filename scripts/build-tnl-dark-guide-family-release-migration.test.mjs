import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertLocalSupabase,
  buildFamilyReleaseRows,
  buildMigration,
  expected,
} from './build-tnl-dark-guide-family-release-migration.mjs';

function eligible(index, confidenceLevel = 'B') {
  return {
    claimKey: `research:tnl-dark-guide-family:${String(index).padStart(16, '0')}`,
    personId: '00000000-0000-4000-8000-000000000001',
    claimValue: `父親：人物${index}`,
    confidenceLevel,
    reviewScore: confidenceLevel === 'A' ? 100 : 85,
    sourceName: confidenceLevel === 'A' ? '官方來源' : '可信媒體',
    sourceUrl: `https://source.example/${index}`,
  };
}

function localClaim(item) {
  return {
    claim_key: item.claimKey,
    person_id: item.personId,
    claim_type: 'family_relation',
    claim_value: item.claimValue,
    claim_json: {
      relationType: 'father',
      relationLabel: '父親',
      relativePersonId: '00000000-0000-4000-8000-000000000002',
      publicationGate: { status: 'verified_not_published' },
      verificationPolicy: { publicationStillRequired: true },
    },
    confidence_level: item.confidenceLevel,
    review_score: item.reviewScore,
    review_status: 'verified',
    visibility: 'review_only',
    is_public: false,
    source_name: item.sourceName,
    source_url: item.sourceUrl,
    observed_at: '2026-08-01T00:00:00.000Z',
    scoring_version: 'tnl-dark-guide-family-v1',
    scoring_reasons: [],
    auto_reviewed_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };
}

function fixture() {
  const eligibleClaims = Array.from({ length: expected.claims }, (_, index) => (
    eligible(index, index < expected.confidenceA ? 'A' : 'B')
  ));
  return {
    preview: {
      summary: {
        eligibleClaims: expected.claims,
        blockedClaims: 0,
        confidenceA: expected.confidenceA,
        confidenceB: expected.confidenceB,
      },
      eligibleClaims,
    },
    claims: eligibleClaims.map(localClaim),
  };
}

test('builds the fixed reviewed release boundary without publishing preview drift', () => {
  const { preview, claims } = fixture();
  const rows = buildFamilyReleaseRows(preview, claims);

  assert.equal(rows.length, expected.claims);
  assert.equal(rows.filter((row) => row.confidence_level === 'A').length, expected.confidenceA);
  assert.equal(rows.filter((row) => row.confidence_level === 'B').length, expected.confidenceB);
  assert.equal(rows.every((row) => row.visibility === 'public' && row.is_public === true), true);
  assert.equal(rows.every((row) => row.claim_json.publicationGate.status === 'published'), true);
  assert.equal(rows.every((row) => row.claim_json.verificationPolicy.publicationStillRequired === false), true);
});

test('rejects preview count, confidence and claim-content drift', () => {
  const countFixture = fixture();
  countFixture.preview.summary.eligibleClaims = 98;
  assert.throws(() => buildFamilyReleaseRows(countFixture.preview, countFixture.claims), /preview count drift/u);

  const confidenceFixture = fixture();
  confidenceFixture.preview.summary.confidenceA = 18;
  assert.throws(() => buildFamilyReleaseRows(confidenceFixture.preview, confidenceFixture.claims), /confidence drift/u);

  const contentFixture = fixture();
  contentFixture.claims[0].claim_value = '父親：另一人';
  assert.throws(() => buildFamilyReleaseRows(contentFixture.preview, contentFixture.claims), /drifted after release preview/u);
});

test('generates a transactional and idempotent migration with public guards', () => {
  const { preview, claims } = fixture();
  const sql = buildMigration(buildFamilyReleaseRows(preview, claims));

  assert.match(sql, /^BEGIN;/u);
  assert.match(sql, /ON CONFLICT \(claim_key\) DO UPDATE SET/u);
  assert.match(sql, /public_people_list_cached/u);
  assert.match(sql, /duplicates an existing public relationship/u);
  assert.match(sql, /public_person_claims/u);
  assert.match(sql, /COMMIT;/u);
});

test('refuses production Supabase URLs', () => {
  assert.doesNotThrow(() => assertLocalSupabase('http://127.0.0.1:54321'));
  assert.throws(() => assertLocalSupabase('https://project.supabase.co'), /only reads local Supabase/u);
});
