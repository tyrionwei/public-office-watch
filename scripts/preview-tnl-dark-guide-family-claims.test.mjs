import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTnlFamilyClaimPreview,
  normalizeFamilyRelation,
} from './preview-tnl-dark-guide-family-claims.mjs';

function researchClaim(overrides = {}) {
  return {
    researchId: 'tnl-dark-guide-2022-tpe-1-1-政治家族-1',
    canonicalPersonId: 'person-primary',
    personName: '候選人甲',
    category: '政治家族',
    status: 'auto_reviewable',
    text: '父親是政治人物乙',
    externalResearch: {
      sources: [{
        tier: 'trusted_media',
        name: '可信媒體',
        url: 'https://news.example/family',
        supports: '候選人甲為政治人物乙之子女',
      }],
    },
    localEvidence: [],
    ...overrides,
  };
}

function familyReport(overrides = {}) {
  return {
    found: [{
      mentionedName: '政治人物乙',
      matches: [{ personId: 'person-relative', canonicalPersonId: 'person-relative', name: '政治人物乙' }],
      occurrences: [{
        id: 'tnl-dark-guide-2022-tpe-1-1-family-1',
        relationship: '父親',
      }],
    }],
    ambiguousSameName: [],
    notFound: [],
    ...overrides,
  };
}

function people() {
  return [
    { id: 'person-primary', name: '候選人甲', is_public: true },
    { id: 'person-relative', name: '政治人物乙', is_public: true },
  ];
}

test('normalizes common relationship aliases without guessing unknown labels', () => {
  assert.deepEqual(normalizeFamilyRelation('爸爸'), {
    relationType: 'father',
    relationLabel: '父親',
  });
  assert.deepEqual(normalizeFamilyRelation('表姐夫'), {
    relationType: 'cousin_in_law',
    relationLabel: '表姻親',
  });
  assert.deepEqual(normalizeFamilyRelation('遠房表妹'), {
    relationType: 'distant_cousin',
    relationLabel: '遠房表親',
  });
  assert.equal(normalizeFamilyRelation('重要友人'), null);
});

test('builds one review-only fact from independent evidence without publishing guide prose', () => {
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    familyPeopleReport: familyReport(),
    people: people(),
  });

  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.summary.heldResearchRows, 0);
  const [claim] = preview.plannedClaims;
  assert.equal(claim.claimValue, '父親：政治人物乙');
  assert.equal(claim.reviewStatus, 'pending');
  assert.equal(claim.visibility, 'review_only');
  assert.equal(claim.isPublic, false);
  assert.equal(claim.sourceName, '可信媒體');
  assert.equal(claim.claimJson.relativePersonId, 'person-relative');
  assert.equal(claim.claimJson.publicationGate.requiresHumanApproval, true);
  assert.equal(JSON.stringify(claim).includes('父親是政治人物乙'), false);
});

test('uses only evidence that directly states the family relationship', () => {
  const claim = researchClaim({
    externalResearch: {
      sources: [
        {
          tier: 'official',
          name: '只有履歷的官方資料',
          url: 'https://official.example/profile',
          supports: '政治人物乙曾任議員',
        },
        {
          tier: 'trusted_media',
          name: '直接關係報導',
          url: 'https://news.example/direct-family',
          supports: '政治人物乙為候選人甲父親',
        },
      ],
    },
  });
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [claim] },
    familyPeopleReport: familyReport(),
    people: people(),
  });

  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.plannedClaims[0].sourceName, '直接關係報導');
  assert.deepEqual(
    preview.plannedClaims[0].claimJson.evidenceSources.map((source) => source.name),
    ['直接關係報導'],
  );
});

test('matches direct evidence against the mentioned name while retaining the canonical display name', () => {
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    familyPeopleReport: familyReport(),
    people: [
      { id: 'person-primary', name: '候選人甲', is_public: true },
      { id: 'person-relative', name: '政治人物乙 Example', is_public: true },
    ],
  });

  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.plannedClaims[0].claimValue, '父親：政治人物乙 Example');
  assert.equal(preview.plannedClaims[0].claimJson.relativePersonId, 'person-relative');
});

test('resolves a confirmed married-name alias without creating another person', () => {
  const report = familyReport();
  report.found[0].mentionedName = '陳秀霞';
  report.found[0].occurrences[0].relationship = '母親';
  report.notFound = [{
    mentionedName: '周陳秀霞',
    matches: [],
    occurrences: [{
      id: 'tnl-dark-guide-2022-tpe-1-1-family-1',
      relationship: '母親',
    }],
  }];
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim({
      externalResearch: { sources: [{
        tier: 'trusted_media',
        name: '可信媒體',
        url: 'https://news.example/family',
        supports: '周陳秀霞為候選人甲母親',
      }] },
    })] },
    familyPeopleReport: report,
    reviewedPersonNameAliases: [{
      alias: '周陳秀霞', canonicalName: '陳秀霞', reviewStatus: 'confirmed',
    }],
    people: people().map((person) => person.id === 'person-relative'
      ? { ...person, name: '陳秀霞' }
      : person),
  });

  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.plannedClaims[0].claimValue, '母親：陳秀霞');
});

test('recognizes extended-family words in direct evidence', () => {
  const report = familyReport();
  report.found[0].occurrences[0].relationship = '外甥';
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim({
      externalResearch: {
        sources: [{
          tier: 'trusted_media',
          name: '可信媒體',
          url: 'https://news.example/family',
          supports: '政治人物乙為候選人甲外甥',
        }],
      },
    })] },
    familyPeopleReport: report,
    people: people(),
  });

  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.plannedClaims[0].claimValue, '外甥：政治人物乙');
});

test('recognizes cousin wording that describes the relationship in reverse', () => {
  const report = familyReport();
  report.found[0].occurrences[0].relationship = '堂弟';
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim({
      externalResearch: {
        sources: [{
          tier: 'trusted_media',
          name: '可信媒體',
          url: 'https://news.example/family',
          supports: '候選人甲為政治人物乙堂哥',
        }],
      },
    })] },
    familyPeopleReport: report,
    people: people(),
  });

  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.plannedClaims[0].claimValue, '堂弟：政治人物乙');
});

test('deduplicates two election years and suppresses an already public relation', () => {
  const second = researchClaim({
    researchId: 'tnl-dark-guide-2018-tpe-1-2-政治家族-1',
  });
  const report = familyReport();
  report.found[0].occurrences.push({
    id: 'tnl-dark-guide-2018-tpe-1-2-family-1',
    relationship: '爸爸',
  });
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim(), second] },
    familyPeopleReport: report,
    people: people(),
    existingClaims: [{
      person_id: 'person-primary',
      claim_type: 'family_relation',
      claim_value: '父親：政治人物乙',
      claim_json: { relationType: 'father', relativeName: '政治人物乙' },
      review_status: 'verified',
      visibility: 'public',
      is_public: true,
    }],
  });

  assert.equal(preview.summary.safeResearchRows, 2);
  assert.equal(preview.summary.uniqueSafeFacts, 1);
  assert.equal(preview.summary.alreadyPublicFacts, 1);
  assert.equal(preview.summary.plannedReviewClaims, 0);
});


test('resolves ambiguous raw ids only after verified canonical identity collapse', () => {
  const ambiguousReport = familyReport({
    found: [],
    ambiguousSameName: [{
      mentionedName: '政治人物乙',
      matches: [
        { personId: 'relative-a', canonicalPersonId: 'stale-relative' },
        { personId: 'relative-b', canonicalPersonId: 'relative-b' },
      ],
      occurrences: [{
        id: 'tnl-dark-guide-2022-tpe-1-1-family-1',
        relationship: '父親',
      }],
    }],
  });
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    familyPeopleReport: ambiguousReport,
    personCanonicalMap: [
      { person_id: 'relative-a', canonical_person_id: 'person-relative' },
      { person_id: 'relative-b', canonical_person_id: 'person-relative' },
    ],
    people: [
      { id: 'person-primary', name: '候選人甲', is_public: true },
      { id: 'person-relative', name: '政治人物乙', is_public: true },
    ],
  });

  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.plannedClaims[0].claimJson.relativePersonId, 'person-relative');
});
test('applies only a confirmed occurrence-specific relative resolution', () => {
  const occurrenceId = 'tnl-dark-guide-2022-tpe-1-1-family-1';
  const ambiguousReport = familyReport({
    found: [],
    ambiguousSameName: [{
      mentionedName: '政治人物乙',
      matches: [
        { personId: 'person-relative', canonicalPersonId: 'person-relative' },
        { personId: 'relative-other', canonicalPersonId: 'relative-other' },
      ],
      occurrences: [{ id: occurrenceId, relationship: '父親' }],
    }],
  });
  const reviewed = {
    resolutions: [{
      mentionedName: '政治人物乙',
      selectedPersonId: 'person-relative',
      occurrenceIds: [occurrenceId],
      reviewStatus: 'confirmed',
    }],
  };
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    familyPeopleReport: ambiguousReport,
    reviewedFamilyRelativeResolutions: reviewed,
    people: [
      ...people(),
      { id: 'relative-other', name: '政治人物乙', is_public: true },
    ],
  });

  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.plannedClaims[0].claimJson.relativePersonId, 'person-relative');

  assert.throws(() => buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    familyPeopleReport: ambiguousReport,
    reviewedFamilyRelativeResolutions: {
      resolutions: [{
        ...reviewed.resolutions[0],
        selectedPersonId: 'not-a-candidate',
      }],
    },
    people: people(),
  }), /not one of the ambiguous candidates/);
});

test('allows an occurrence-specific married-name target outside ambiguous short-name candidates', () => {
  const occurrenceId = 'tnl-dark-guide-2022-tpe-1-1-family-1';
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim({
      externalResearch: { sources: [{
        tier: 'trusted_media',
        name: '可信媒體',
        url: 'https://news.example/married-name',
        supports: '周陳秀霞為候選人甲母親',
      }] },
    })] },
    familyPeopleReport: familyReport({
      found: [],
      ambiguousSameName: [{
        mentionedName: '陳秀霞',
        matches: [
          { personId: 'short-name-one', canonicalPersonId: 'short-name-one' },
          { personId: 'short-name-two', canonicalPersonId: 'short-name-two' },
        ],
        occurrences: [{ id: occurrenceId, relationship: '母親' }],
      }],
    }),
    reviewedFamilyRelativeResolutions: {
      resolutions: [{
        mentionedName: '陳秀霞',
        selectedPersonId: 'married-name-person',
        selectedPersonName: '周陳秀霞',
        allowReviewedAlias: true,
        occurrenceIds: [occurrenceId],
        reviewStatus: 'confirmed',
      }],
    },
    people: [
      { id: 'person-primary', name: '候選人甲', is_public: true },
      { id: 'short-name-one', name: '陳秀霞', is_public: true },
      { id: 'short-name-two', name: '陳秀霞', is_public: true },
      { id: 'married-name-person', name: '周陳秀霞', is_public: true },
    ],
  });

  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.plannedClaims[0].claimValue, '母親：周陳秀霞');
  assert.equal(preview.plannedClaims[0].claimJson.relativePersonId, 'married-name-person');
});

test('applies a reviewed occurrence-specific relationship label override', () => {
  const occurrenceId = 'tnl-dark-guide-2022-tpe-1-1-family-1';
  const report = familyReport();
  report.found[0].occurrences[0].relationship = '祖父';
  const preview = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim({
      externalResearch: { sources: [{
        tier: 'trusted_media',
        name: '可信媒體',
        url: 'https://news.example/grandfather',
        supports: '政治人物乙為候選人甲外公',
      }] },
    })] },
    familyPeopleReport: report,
    reviewedFamilyRelativeResolutions: {
      resolutions: [{
        mentionedName: '政治人物乙',
        relationshipOverride: '外公',
        occurrenceIds: [occurrenceId],
        reviewStatus: 'confirmed',
      }],
    },
    people: people(),
  });

  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.plannedClaims[0].claimValue, '外公：政治人物乙');
  assert.equal(preview.plannedClaims[0].claimJson.relationType, 'grandfather');
});


test('holds ambiguous, missing and untrusted relationships for review', () => {
  const ambiguousReport = familyReport({
    found: [],
    ambiguousSameName: [{
      mentionedName: '政治人物乙',
      matches: [
        { personId: 'relative-a', canonicalPersonId: 'relative-a' },
        { personId: 'relative-b', canonicalPersonId: 'relative-b' },
      ],
      occurrences: [{
        id: 'tnl-dark-guide-2022-tpe-1-1-family-1',
        relationship: '父親',
      }],
    }],
  });
  const ambiguous = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    familyPeopleReport: ambiguousReport,
    people: people(),
  });
  assert.equal(ambiguous.summary.heldReasonCounts.ambiguous_relative, 1);

  const untrusted = buildTnlFamilyClaimPreview({
    sourceResearchReport: { claims: [researchClaim({
      externalResearch: {
        sources: [{ tier: 'other', name: '網友留言', url: 'https://forum.example/post' }],
      },
    })] },
    familyPeopleReport: familyReport(),
    people: people(),
  });
  assert.equal(untrusted.summary.heldReasonCounts.acceptable_evidence_missing, 1);
  assert.equal(untrusted.summary.plannedReviewClaims, 0);
});
