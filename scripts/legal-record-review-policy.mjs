export const LEGAL_RECORD_SCORING_VERSION = 'legal-record-v1';

const officialSourceTypes = new Set([
  'court_document',
  'judicial_api',
  'government_open_data',
]);

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function addScore(state, condition, points, reason) {
  if (!condition) return;
  state.score += points;
  state.reasons.push(reason);
}

function hasConflict(conflicts) {
  return Array.isArray(conflicts) && conflicts.some(Boolean);
}

export function assessLegalRecordMatch(input) {
  const identity = input.identityEvidence ?? {};
  const court = input.caseEvidence ?? {};
  const conflicts = input.conflicts ?? [];
  const identityState = { score: 0, reasons: [] };
  const caseState = { score: 0, reasons: [] };
  const blockers = [];

  addScore(identityState, input.normalizedNameMatch, 35, 'normalized name matched');
  addScore(identityState, identity.exactBirthDate, 35, 'exact birth date matched');
  addScore(identityState, identity.exactOfficeAndDistrict, 30, 'office and district matched');
  addScore(identityState, identity.newsIdentityBridge, 25, 'reliable news linked the officeholder to the case');
  addScore(identityState, identity.caseNarrativeBridge, 25, 'court narrative uniquely matched the person');
  addScore(identityState, !identity.exactOfficeAndDistrict && identity.exactOffice, 15, 'office matched');
  addScore(identityState, !identity.exactOfficeAndDistrict && identity.district, 10, 'district matched');
  addScore(identityState, identity.partyAtIncident, 5, 'party at incident time matched');
  addScore(identityState, identity.educationOrExperience, 10, 'education or experience matched');
  addScore(identityState, identity.gender, 5, 'gender matched');

  if (input.normalizedNameMatch && identityState.score === 35) {
    identityState.score = Math.min(identityState.score, 49);
    identityState.reasons.push('name-only match cannot establish identity');
  }

  const officialJudicialSource = officialSourceTypes.has(input.sourceType) && Boolean(input.sourceUrl);
  addScore(caseState, officialJudicialSource, 55, 'official judicial source with URL');
  addScore(caseState, court.caseNumberConfirmed, 10, 'case number confirmed');
  addScore(caseState, court.judgmentDateConfirmed, 5, 'judgment date confirmed');
  addScore(caseState, court.offenseConfirmed, 10, 'offense or statute confirmed');
  addScore(caseState, court.caseStageConfirmed, 5, 'case stage confirmed');
  addScore(caseState, court.outcomeConfirmed, 5, 'case outcome confirmed');
  addScore(caseState, court.finalityChecked, 10, 'later appeals and finality checked');

  if (!input.normalizedNameMatch) blockers.push('name mismatch');
  if (input.scope === 'non_criminal') blockers.push('outside criminal-proceeding scope');
  if (input.subjectRole && !['defendant', 'unknown'].includes(input.subjectRole)) {
    blockers.push('person is not the defendant');
  }
  if (hasConflict(conflicts)) blockers.push('identity or case evidence conflicts');
  if (
    Number.isInteger(input.incidentYear) &&
    Number.isInteger(input.judgmentYear) &&
    input.judgmentYear < input.incidentYear &&
    !input.allowPreIncidentJudgment
  ) {
    blockers.push('judgment predates incident-year lower bound');
  }

  const identityScore = clampScore(identityState.score);
  const caseEvidenceScore = clampScore(caseState.score);
  const overallScore = blockers.length > 0 ? 0 : Math.min(identityScore, caseEvidenceScore);
  const autoVerified =
    blockers.length === 0 &&
    identityScore >= 90 &&
    caseEvidenceScore >= 90 &&
    officialJudicialSource &&
    court.officialDocumentUrlConfirmed === true &&
    input.scope === 'criminal' &&
    input.subjectRole === 'defendant' &&
    court.finalityChecked === true &&
    court.isFinal === true;

  let decision = 'needs_more_evidence';
  if (autoVerified) {
    decision = 'auto_verified';
  } else if (blockers.length === 0 && identityScore >= 50 && caseEvidenceScore >= 55) {
    decision = 'manual_review';
  } else if (blockers.length > 0) {
    decision = 'rejected_or_hold';
  }

  return {
    scoringVersion: LEGAL_RECORD_SCORING_VERSION,
    identityScore,
    caseEvidenceScore,
    overallScore,
    decision,
    blockers,
    reasons: [...identityState.reasons, ...caseState.reasons],
    publicationApproved: false,
  };
}
