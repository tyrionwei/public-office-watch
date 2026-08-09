import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTnlLegalClaimPreview,
  classifyLegalResearchRow,
} from './preview-tnl-dark-guide-legal-claims.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function researchClaim(overrides = {}) {
  return {
    researchId: 'tnl-dark-guide-2022-tpe-1-1-涉案紀錄-1',
    canonicalPersonId: 'person-primary',
    personName: '候選人甲',
    category: '涉案紀錄',
    status: 'auto_reviewable',
    text: '暗公報原始敘述不可直接發布',
    externalResearch: {
      notes: '',
      sources: [{
        tier: 'trusted_media',
        name: '可信媒體',
        url: 'https://news.example/legal',
        supports: '候選人甲案件一審判刑4月',
      }],
    },
    localEvidence: [],
    ...overrides,
  };
}

function publicPeople() {
  return [{ id: 'person-primary', name: '候選人甲', is_public: true }];
}

test('classifies criminal, civil election and administrative outcomes separately', () => {
  assert.equal(classifyLegalResearchRow(researchClaim()).caseStage, 'criminal_judgment_non_final');

  const election = classifyLegalResearchRow(researchClaim({
    externalResearch: {
      notes: '',
      sources: [{
        tier: 'official',
        name: '中選會',
        url: 'https://official.example/election',
        supports: '候選人甲當選無效確定',
      }],
    },
  }));
  assert.equal(election.caseStage, 'election_invalidated_final');
  assert.equal(election.recordType, 'election_civil');
  assert.ok(election.safetyFlags.includes('must_not_attribute_criminal_liability'));

  const sanction = classifyLegalResearchRow(researchClaim({
    externalResearch: {
      notes: '',
      sources: [{
        tier: 'official',
        name: '監察院',
        url: 'https://official.example/sanction',
        supports: '候選人甲遭裁罰20萬元並沒入',
      }],
    },
  }));
  assert.equal(sanction.caseStage, 'administrative_sanction');
  assert.equal(sanction.recordType, 'administrative');
  assert.ok(sanction.safetyFlags.includes('must_not_be_described_as_criminal_conviction'));
});

test('builds a pending review-only claim from independent media evidence', () => {
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    people: publicPeople(),
  });

  assert.equal(preview.summary.plannedReviewClaims, 1);
  assert.equal(preview.summary.heldResearchRows, 0);
  const [claim] = preview.plannedClaims;
  assert.equal(claim.claimValue, '候選人甲案件一審判刑4月');
  assert.equal(claim.confidenceLevel, 'B');
  assert.equal(claim.reviewStatus, 'pending');
  assert.equal(claim.visibility, 'review_only');
  assert.equal(claim.isPublic, false);
  assert.equal(claim.claimJson.legalCasePublicEligible, false);
  assert.equal(claim.claimJson.publicationGate.requiresHumanApproval, true);
  assert.equal(JSON.stringify(claim).includes('暗公報原始敘述不可直接發布'), false);
});

test('official evidence can receive A while media evidence is capped at B', () => {
  const official = researchClaim({
    externalResearch: {
      notes: '',
      sources: [{
        tier: 'official',
        name: '法院',
        url: 'https://official.example/judgment',
        supports: '候選人甲判刑1年確定',
      }],
    },
  });
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport: { claims: [official] },
    people: publicPeople(),
  });

  assert.equal(preview.plannedClaims[0].confidenceLevel, 'A');
  assert.equal(preview.plannedClaims[0].claimJson.caseStage, 'criminal_judgment_final');
});

test('rejects untrusted sources and private people from the safe preview', () => {
  const untrusted = researchClaim({
    externalResearch: {
      notes: '',
      sources: [{
        tier: 'secondary',
        name: '網友整理',
        url: 'https://forum.example/post',
        supports: '候選人甲被網友指控',
      }],
    },
  });
  const noEvidence = buildTnlLegalClaimPreview({
    sourceResearchReport: { claims: [untrusted] },
    people: publicPeople(),
  });
  assert.equal(noEvidence.summary.plannedReviewClaims, 0);
  assert.equal(noEvidence.held[0].reason, 'acceptable_independent_evidence_missing');

  const privatePerson = buildTnlLegalClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    people: [{ id: 'person-primary', name: '候選人甲', is_public: false }],
  });
  assert.equal(privatePerson.summary.plannedReviewClaims, 0);
  assert.equal(privatePerson.held[0].reason, 'person_missing_or_private');
});

test('flags third-party conduct, non-final stages and later outcome review', () => {
  const classification = classifyLegalResearchRow(researchClaim({
    externalResearch: {
      notes: '案件其後已有無罪判決，公開時需呈現最新階段。',
      sources: [{
        tier: 'trusted_media',
        name: '可信媒體',
        url: 'https://news.example/election',
        supports: '樁腳買票案件一審判決',
      }],
    },
  }));

  assert.ok(classification.safetyFlags.includes('third_party_conduct_must_not_be_attributed'));
  assert.ok(classification.safetyFlags.includes('stage_or_finality_must_be_stated'));
  assert.ok(classification.safetyFlags.includes('later_outcome_review_needed'));
});

test('keeps explicitly non-final outcomes non-final and selects the more specific evidence', () => {
  const claim = researchClaim({
    externalResearch: {
      notes: '後續一審結果仍尚非定讞。',
      sources: [
        {
          tier: 'official',
          name: '地方法院',
          url: 'https://official.example/detention',
          supports: '候選人甲羈押案件',
        },
        {
          tier: 'trusted_media',
          name: '可信媒體',
          url: 'https://news.example/later-outcome',
          supports: '候選人甲一審判刑10年，尚非定讞',
        },
      ],
    },
  });
  const classification = classifyLegalResearchRow(claim);
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport: { claims: [claim] },
    people: publicPeople(),
  });

  assert.equal(classification.caseStage, 'criminal_judgment_non_final');
  assert.equal(preview.plannedClaims[0].claimValue, '候選人甲一審判刑10年，尚非定讞');
  assert.equal(preview.plannedClaims[0].confidenceLevel, 'B');
  assert.equal(
    preview.plannedClaims[0].claimJson.publicationGate.requiresCurrentOutcomeReview,
    true,
  );
});

test('suppresses a legal fact already public for the same person and source', () => {
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    people: publicPeople(),
    existingClaims: [{
      person_id: 'person-primary',
      claim_type: 'legal_case',
      review_status: 'verified',
      visibility: 'public',
      is_public: true,
      source_url: 'https://news.example/legal',
    }],
  });

  assert.equal(preview.summary.plannedReviewClaims, 0);
  assert.equal(preview.summary.alreadyPublicClaims, 1);
});

test('suppresses a verified review-only claim by stable claim key', () => {
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    people: publicPeople(),
    existingClaims: [{
      claim_key: 'research:tnl-dark-guide-legal:59742d81bb8e495d',
      person_id: 'person-primary',
      claim_type: 'legal_case',
      review_status: 'verified',
      visibility: 'review_only',
      is_public: false,
      source_url: 'https://official.example/final-judgment',
    }],
  });

  assert.equal(preview.summary.plannedReviewClaims, 0);
  assert.equal(preview.summary.alreadyReviewedClaims, 1);
  assert.equal(
    preview.alreadyReviewed[0].claimKey,
    'research:tnl-dark-guide-legal:59742d81bb8e495d',
  );
});


test('suppresses a research lead already linked to another reviewed claim', () => {
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport: { claims: [researchClaim()] },
    people: publicPeople(),
    existingClaims: [{
      claim_key: 'research:tnl-dark-guide-legal:merged-claim',
      person_id: 'person-primary',
      claim_type: 'legal_case',
      review_status: 'verified',
      visibility: 'review_only',
      is_public: false,
      source_url: 'https://official.example/final-judgment',
      claim_json: {
        researchIds: ['tnl-dark-guide-2022-tpe-1-1-涉案紀錄-1'],
      },
    }],
  });

  assert.equal(preview.summary.plannedReviewClaims, 0);
  assert.equal(preview.summary.alreadyReviewedClaims, 1);
  assert.equal(
    preview.alreadyReviewed[0].claimKey,
    'research:tnl-dark-guide-legal:merged-claim',
  );
});
test('the reviewed dataset remains 177 classified rows and 32 safe preview candidates', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'data-sources', 'tnl-dark-guide', 'source-research-report.json'),
    'utf8',
  ));
  const legalRows = report.claims.filter((row) => row.category === '涉案紀錄');
  const people = [...new Map(legalRows.map((row) => [
    row.canonicalPersonId,
    { id: row.canonicalPersonId, name: row.personName, is_public: true },
  ])).values()];
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport: report,
    people,
  });

  assert.equal(preview.summary.legalResearchRows, 177);
  assert.equal(preview.summary.autoReviewableResearchRows, 32);
  assert.equal(preview.summary.plannedReviewClaims, 32);
  assert.equal(preview.summary.heldResearchRows, 0);
  assert.equal(preview.policy.databaseWrites, false);
  assert.equal(preview.policy.originalGuideTextPublished, false);
  assert.equal(preview.policy.legalCasePublicEligible, false);
});
