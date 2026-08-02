import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMigration,
  buildReviewedRelativePeopleRows,
  normalizedName,
} from './build-reviewed-tnl-family-relative-people-migration.mjs';

function researchClaim(researchId, name, tier = 'trusted_media') {
  return {
    researchId,
    externalResearch: {
      sources: [{
        tier,
        name: tier === 'official' ? '官方來源' : '可信媒體',
        url: `https://example.com/${researchId}`,
        supports: `${name}曾任公職，並為候選人親屬`,
      }],
    },
    localEvidence: [],
  };
}

function familyPersonReport(researchId, name) {
  return {
    found: [{
      mentionedName: name,
      occurrences: [{ id: researchId }],
    }],
    ambiguousSameName: [],
    notFound: [],
  };
}

test('normalizes reviewed names consistently with family identity matching', () => {
  assert.equal(normalizedName('臺 北・黄某'), '台北黃某');
});

test('builds reviewed public-role people, reuses one canonical identity, and ignores holds', () => {
  const rows = buildReviewedRelativePeopleRows({
    reviewedConfig: {
      people: [
        { name: '既有人物', position: '立法委員', reviewStatus: 'approved' },
        { name: '新人物', position: '縣議員', reviewStatus: 'approved' },
        { name: '時效人物', position: '市長', reviewStatus: 'hold' },
      ],
    },
    sourceResearchReport: {
      claims: [
        researchClaim('research-existing', '既有人物', 'official'),
        researchClaim('research-new', '新人物'),
      ],
    },
    familyPeopleReport: {
      found: [
        ...familyPersonReport('research-existing', '既有人物').found,
        ...familyPersonReport('research-new', '新人物').found,
      ],
      ambiguousSameName: [],
      notFound: [],
    },
    people: [
      { id: 'duplicate-id', name: '既有人物', is_public: false },
      { id: 'canonical-id', name: '既有人物', is_public: true },
    ],
    personCanonicalMap: [
      { person_id: 'duplicate-id', canonical_person_id: 'canonical-id' },
      { person_id: 'canonical-id', canonical_person_id: 'canonical-id' },
    ],
  });

  assert.equal(rows.length, 2);
  const existing = rows.find((row) => row.name === '既有人物');
  const created = rows.find((row) => row.name === '新人物');
  assert.equal(existing.personId, 'canonical-id');
  assert.equal(existing.createPerson, false);
  assert.equal(existing.confidenceLevel, 'A');
  assert.equal(existing.sourceType, 'official_officeholder');
  assert.equal(created.createPerson, true);
  assert.equal(created.confidenceLevel, 'B');
  assert.equal(created.sourceType, 'public_reference');
  assert.match(created.personId, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('rejects an approved name that still maps to multiple canonical identities', () => {
  assert.throws(() => buildReviewedRelativePeopleRows({
    reviewedConfig: { people: [{ name: '同名人物', position: '議員', reviewStatus: 'approved' }] },
    sourceResearchReport: { claims: [researchClaim('research-one', '同名人物')] },
    familyPeopleReport: familyPersonReport('research-one', '同名人物'),
    people: [
      { id: 'person-one', name: '同名人物', is_public: true },
      { id: 'person-two', name: '同名人物', is_public: true },
    ],
  }), /multiple canonical matches/);
});

test('rejects evidence that does not identify the reviewed relative', () => {
  assert.throws(() => buildReviewedRelativePeopleRows({
    reviewedConfig: { people: [{ name: '待證人物', position: '議員', reviewStatus: 'approved' }] },
    sourceResearchReport: { claims: [researchClaim('research-one', '另一人')] },
    familyPeopleReport: familyPersonReport('research-one', '待證人物'),
  }), /does not identify relative person/);
});

test('renders an idempotent migration with evidence and public-cache guards', () => {
  const rows = buildReviewedRelativePeopleRows({
    reviewedConfig: { people: [{ name: '新人物', position: '縣議員', reviewStatus: 'approved' }] },
    sourceResearchReport: { claims: [researchClaim('research-new', '新人物')] },
    familyPeopleReport: familyPersonReport('research-new', '新人物'),
  });
  const sql = buildMigration(rows);
  assert.match(sql, /ON CONFLICT \(id\) DO UPDATE/);
  assert.match(sql, /ON CONFLICT \(source_person_key\) DO UPDATE/);
  assert.match(sql, /ON CONFLICT \(source_person_id, person_id\) DO UPDATE/);
  assert.match(sql, /REFRESH MATERIALIZED VIEW public\.public_people_list_cached/);
  assert.match(sql, /source_url !~ '\^https:\/\/'/);
});
