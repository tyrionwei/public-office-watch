import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTnlLegalCoverageReport } from './report-tnl-dark-guide-legal-coverage.mjs';

function researchRow(personId, personName, status = 'auto_reviewable') {
  return {
    researchId: 'research-' + personId,
    canonicalPersonId: personId,
    personName,
    category: '涉案紀錄',
    status,
    text: personName + '刑事案件一審判刑，尚未定讞',
    externalResearch: {
      notes: '',
      sources: [{
        tier: 'trusted_media',
        name: '可信媒體',
        url: 'https://news.example/' + personId,
        supports: personName + '刑事案件一審判刑，尚未定讞',
      }],
    },
    localEvidence: [],
  };
}

test('compares dark-guide criminal people with canonical public claims', () => {
  const report = buildTnlLegalCoverageReport({
    sourceResearchReport: { claims: [
      researchRow('duplicate-a', '候選人甲'),
      researchRow('person-b', '候選人乙', 'manual_review'),
    ] },
    personCanonicalMap: [{ person_id: 'duplicate-a', canonical_person_id: 'person-a' }],
    people: [
      { id: 'person-a', name: '候選人甲' },
      { id: 'person-b', name: '候選人乙' },
    ],
    existingClaims: [{
      person_id: 'person-a',
      claim_type: 'legal_case',
      review_status: 'verified',
      visibility: 'public',
      is_public: true,
      claim_json: { recordType: 'criminal' },
    }],
  });

  assert.deepEqual(report.summary, {
    legalResearchRecords: 2,
    legalResearchPeople: 2,
    criminalResearchRecords: 2,
    criminalResearchPeople: 2,
    coveredCriminalResearchPeople: 1,
    uncoveredCriminalResearchPeople: 1,
    publishedVerifiedCriminalPeopleOverall: 1,
    coveragePercent: 50,
  });
  assert.equal(report.coverageGaps[0].personName, '候選人乙');
});
