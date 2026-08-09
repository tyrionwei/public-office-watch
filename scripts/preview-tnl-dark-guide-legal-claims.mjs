import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');
const defaultOutputPath = path.join(repoRoot, 'local-data', 'tnl-dark-guide-legal-claims-preview.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const acceptedEvidenceTiers = new Set(['official', 'institutional', 'trusted_media']);
const evidenceTierRank = ['official', 'institutional', 'trusted_media'];

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      }),
  );
}

function parseArgs(argv) {
  const options = { outputPath: defaultOutputPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error('Unsupported argument: ' + arg);
  }
  return options;
}

function uniqueBy(rows, keyFor) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFor(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizedText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedFactKey(value) {
  return normalizedText(value).normalize('NFKC').replace(/[，。；、：:「」『』"'（）()]/g, '').toLowerCase();
}

function evidenceScore(source) {
  const text = source.supports;
  let score = { official: 30, institutional: 20, trusted_media: 10 }[source.tier] ?? 0;
  if (/定讞|確定|最高法院|裁罰|彈劾/u.test(text)) score += 50;
  if (/判刑|有罪|無罪|當選無效/u.test(text)) score += 40;
  if (/起訴/u.test(text)) score += 30;
  if (/羈押|偵查|案件/u.test(text)) score += 10;
  return score;
}

function evidenceSources(row) {
  return uniqueBy([
    ...(row.externalResearch?.sources ?? []).map((source) => ({
      tier: source.tier,
      name: source.name,
      url: source.url,
      supports: normalizedText(source.supports),
    })),
    ...(row.localEvidence ?? []).map((source) => ({
      tier: source.tier,
      name: source.sourceName,
      url: source.sourceUrl,
      supports: normalizedText(source.claimValue),
    })),
  ].filter((source) => (
    acceptedEvidenceTiers.has(source.tier)
    && /^https?:\/\//.test(source.url ?? '')
    && source.supports.length > 0
  )), (source) => source.url).sort((left, right) => (
    evidenceScore(right) - evidenceScore(left)
    || evidenceTierRank.indexOf(left.tier) - evidenceTierRank.indexOf(right.tier)
    || left.url.localeCompare(right.url)
  ));
}

function stageFrom(text) {
  const explicitlyNonFinal = /尚非定讞|未定讞|非定讞/u.test(text);
  if (/彈劾/u.test(text)) return 'administrative_impeachment';
  if (/裁罰|沒入/u.test(text)) return 'administrative_sanction';
  if (!explicitlyNonFinal && /當選無效/u.test(text) && /定讞|確定/u.test(text)) return 'election_invalidated_final';
  if (/無罪/u.test(text) && /定讞|確定/u.test(text)) return 'acquitted_final';
  if (!explicitlyNonFinal && /(判刑|有罪|違反.+罪)/u.test(text) && /定讞|確定|最高法院.*駁回/u.test(text)) {
    return 'criminal_judgment_final';
  }
  if (/一審|二審|判刑|原判|減為|法院.*(判決|認定.+罪)|有罪/u.test(text)) return 'criminal_judgment_non_final';
  if (/起訴/u.test(text)) return 'indicted';
  if (/羈押|偵查|審理中/u.test(text)) return 'investigation_or_trial';
  if (/十大槍擊要犯/u.test(text)) return 'historical_designation';
  if (/違反.+罪/u.test(text)) return 'criminal_outcome_unspecified';
  return 'legal_record_unspecified';
}

function recordTypeFrom(stage) {
  if (stage.startsWith('administrative_')) return 'administrative';
  if (stage.startsWith('election_')) return 'election_civil';
  if (stage === 'historical_designation') return 'historical_context';
  return 'criminal';
}

function caseKindFrom(text) {
  if (/政治獻金/u.test(text)) return 'political_finance';
  if (/賄選|買票|行賄|走路工|農會選舉/u.test(text)) return 'election_bribery';
  if (/助理費|助理補助費/u.test(text)) return 'assistant_expense';
  if (/貪污/u.test(text)) return 'corruption';
  if (/國安法|國家安全法/u.test(text)) return 'national_security';
  if (/傷害|致死|槍擊|恐嚇/u.test(text)) return 'violence_or_threat';
  if (/登載不實/u.test(text)) return 'document_falsification';
  if (/當選無效/u.test(text)) return 'election_validity';
  if (/兼任|彈劾/u.test(text)) return 'public_discipline';
  return 'other';
}

export function classifyLegalResearchRow(row) {
  const evidence = evidenceSources(row);
  const evidenceText = evidence.map((source) => source.supports).join('；');
  const basis = evidenceText || normalizedText(row.text);
  const notes = normalizedText(row.externalResearch?.notes);
  const caseStage = stageFrom(basis);
  const recordType = recordTypeFrom(caseStage);
  const safetyFlags = [];

  if (/樁腳/u.test(basis + ' ' + notes)) safetyFlags.push('third_party_conduct_must_not_be_attributed');
  if ([
    'criminal_judgment_non_final',
    'indicted',
    'investigation_or_trial',
    'criminal_outcome_unspecified',
    'legal_record_unspecified',
  ].includes(caseStage)) safetyFlags.push('stage_or_finality_must_be_stated');
  if (/後續|其後|更新|無罪|尚非定讞|審級.*不一致|法律見解有變化|仍需.*核對|須人工核對/u.test(notes)) {
    safetyFlags.push('later_outcome_review_needed');
  }
  if (recordType === 'administrative') safetyFlags.push('must_not_be_described_as_criminal_conviction');
  if (recordType === 'election_civil') safetyFlags.push('must_not_attribute_criminal_liability');
  if (recordType === 'historical_context') safetyFlags.push('historical_label_requires_context');
  if (evidence.length > 0 && evidence.every((source) => source.tier === 'trusted_media')) {
    safetyFlags.push('media_evidence_capped_at_b');
  }
  if (
    evidence.length > 0
    && !evidence.some((source) => normalizedFactKey(source.supports).includes(normalizedFactKey(row.personName)))
  ) {
    safetyFlags.push('source_summary_omits_person_name');
  }

  return {
    researchId: row.researchId,
    canonicalPersonId: row.canonicalPersonId,
    personName: row.personName,
    researchStatus: row.status,
    caseKind: caseKindFrom(basis),
    caseStage,
    recordType,
    classificationBasis: evidenceText ? 'independent_evidence_summary' : 'research_lead_text',
    primaryEvidenceTier: evidence[0]?.tier ?? null,
    evidenceSourceCount: evidence.length,
    safetyFlags: [...new Set(safetyFlags)].sort(),
    publicationCandidate: row.status === 'auto_reviewable' && evidence.length > 0,
  };
}

function countsBy(rows, keyFor) {
  return Object.fromEntries([...rows.reduce((counts, row) => {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)));
}

export function buildTnlLegalClaimPreview({
  sourceResearchReport,
  people = [],
  personCanonicalMap = [],
  existingClaims = [],
}) {
  const legalRows = (sourceResearchReport.claims ?? []).filter((row) => row.category === '涉案紀錄');
  const canonicalIds = new Map(personCanonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const canonicalPersonId = (personId) => canonicalIds.get(personId) ?? personId;
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const existingKeys = new Set(existingClaims.filter((claim) => (
    claim.claim_type === 'legal_case'
    && claim.review_status === 'verified'
    && claim.visibility === 'public'
    && claim.is_public === true
  )).map((claim) => [canonicalPersonId(claim.person_id), claim.source_url ?? ''].join('|')));
  const existingReviewedClaimKeys = new Set(existingClaims.filter((claim) => (
    claim.claim_type === 'legal_case'
    && claim.review_status === 'verified'
  )).map((claim) => claim.claim_key));
  const existingReviewedResearchClaimKeys = new Map();
  for (const claim of existingClaims) {
    if (claim.claim_type !== 'legal_case' || claim.review_status !== 'verified') continue;
    for (const researchId of claim.claim_json?.researchIds ?? []) {
      existingReviewedResearchClaimKeys.set(researchId, claim.claim_key);
    }
  }
  const classifiedRecords = legalRows.map(classifyLegalResearchRow);
  const candidateRows = legalRows.filter((row) => row.status === 'auto_reviewable');
  const plannedClaims = [];
  const held = [];
  const alreadyPublic = [];
  const alreadyReviewed = [];

  for (const row of candidateRows) {
    const personId = canonicalPersonId(row.canonicalPersonId);
    const person = peopleById.get(personId);
    const evidence = evidenceSources(row);
    const classification = classifyLegalResearchRow(row);
    if (!person || person.is_public !== true) {
      held.push({ researchId: row.researchId, personName: row.personName, reason: 'person_missing_or_private' });
      continue;
    }
    if (evidence.length === 0) {
      held.push({ researchId: row.researchId, personName: row.personName, reason: 'acceptable_independent_evidence_missing' });
      continue;
    }

    const linkedClaimKey = existingReviewedResearchClaimKeys.get(row.researchId);
    if (linkedClaimKey) {
      alreadyReviewed.push({ researchId: row.researchId, personId, claimKey: linkedClaimKey });
      continue;
    }

    const hash = crypto.createHash('sha256').update(row.researchId).digest('hex').slice(0, 16);
    const claimKey = 'research:tnl-dark-guide-legal:' + hash;
    if (existingReviewedClaimKeys.has(claimKey)) {
      alreadyReviewed.push({ researchId: row.researchId, personId, claimKey });
      continue;
    }

    const primaryEvidence = evidence[0];
    const claimValue = primaryEvidence.supports;
    if (claimValue.length > 180) {
      held.push({ researchId: row.researchId, personName: row.personName, reason: 'evidence_summary_too_long' });
      continue;
    }
    if (existingKeys.has([personId, primaryEvidence.url].join('|'))) {
      alreadyPublic.push({ researchId: row.researchId, personId, sourceUrl: primaryEvidence.url });
      continue;
    }

    plannedClaims.push({
      claimKey,
      personId,
      claimType: 'legal_case',
      claimValue,
      claimJson: {
        sourceId: 'tnl-dark-guide-independent-legal-research',
        researchIds: [row.researchId],
        caseKind: classification.caseKind,
        caseStage: classification.caseStage,
        recordType: classification.recordType,
        evidenceSources: evidence,
        safetyFlags: classification.safetyFlags,
        legalCasePublicEligible: false,
        publicationGate: {
          status: 'preview_only',
          requiresHumanApproval: true,
          requiresCurrentOutcomeReview: classification.safetyFlags.includes('later_outcome_review_needed'),
        },
      },
      confidenceLevel: primaryEvidence.tier === 'official' ? 'A' : 'B',
      reviewStatus: 'pending',
      visibility: 'review_only',
      sourceName: primaryEvidence.name,
      sourceUrl: primaryEvidence.url,
      isPublic: false,
    });
  }

  const allFlags = classifiedRecords.flatMap((row) => row.safetyFlags.map((flag) => ({ flag })));
  const payload = {
    policy: {
      databaseWrites: false,
      originalGuideTextPublished: false,
      guideIsResearchLeadOnly: true,
      independentEvidenceRequired: true,
      publicPersonRequired: true,
      officialEvidenceConfidence: 'A',
      mediaEvidenceMaximumConfidence: 'B',
      publicClaimsRequireHumanApproval: true,
      legalCasePublicEligible: false,
    },
    summary: {
      legalResearchRows: legalRows.length,
      researchStatusCounts: countsBy(classifiedRecords, (row) => row.researchStatus),
      stageCounts: countsBy(classifiedRecords, (row) => row.caseStage),
      recordTypeCounts: countsBy(classifiedRecords, (row) => row.recordType),
      riskFlagCounts: countsBy(allFlags, (row) => row.flag),
      autoReviewableResearchRows: candidateRows.length,
      plannedReviewClaims: plannedClaims.length,
      confidenceCounts: countsBy(plannedClaims, (row) => row.confidenceLevel),
      alreadyPublicClaims: alreadyPublic.length,
      alreadyReviewedClaims: alreadyReviewed.length,
      heldResearchRows: held.length,
      heldReasonCounts: countsBy(held, (row) => row.reason),
    },
    classifiedRecords,
    plannedClaims,
    alreadyReviewed,
    alreadyPublic,
    held,
  };
  return {
    ...payload,
    summary: {
      ...payload.summary,
      estimatedPreviewBytes: Buffer.byteLength(JSON.stringify(payload), 'utf8'),
    },
  };
}

function restUrl(config, tableName) {
  return new URL(config.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + tableName);
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: 'Bearer ' + config.serviceRoleKey,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error('Failed to fetch ' + tableName + ': ' + (body?.message ?? response.statusText));
    rows.push(...body);
    if (body.length < 1000) return rows;
  }
}

async function fetchRowsByIds(config, tableName, select, column, ids) {
  const rows = [];
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  for (let index = 0; index < uniqueIds.length; index += 80) {
    const chunk = uniqueIds.slice(index, index + 80);
    rows.push(...await fetchRows(config, tableName, select, {
      [column]: 'in.(' + chunk.join(',') + ')',
    }));
  }
  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('This preview only reads local Supabase');
  }

  const sourceResearchReport = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'source-research-report.json'), 'utf8'),
  );
  const legalRows = sourceResearchReport.claims.filter((row) => row.category === '涉案紀錄');
  const autoReviewableRows = legalRows.filter((row) => row.status === 'auto_reviewable');
  if (legalRows.length !== 177 || autoReviewableRows.length !== 32) {
    throw new Error('Expected 177 legal rows and 32 auto-reviewable rows, found '
      + legalRows.length + ' and ' + autoReviewableRows.length);
  }

  const existingClaims = await fetchRows(
    config,
    'person_claims',
    'claim_key,person_id,claim_type,review_status,visibility,is_public,source_url,claim_json',
    { claim_type: 'eq.legal_case', order: 'claim_key.asc' },
  );
  const referencedPersonIds = [
    ...legalRows.map((row) => row.canonicalPersonId),
    ...existingClaims.map((claim) => claim.person_id),
  ];
  const personCanonicalMap = await fetchRowsByIds(
    config, 'person_canonical_map', 'person_id,canonical_person_id', 'person_id', referencedPersonIds,
  );
  const people = await fetchRowsByIds(
    config,
    'people',
    'id,name,is_public',
    'id',
    [...referencedPersonIds, ...personCanonicalMap.map((row) => row.canonical_person_id)],
  );
  const preview = buildTnlLegalClaimPreview({
    sourceResearchReport,
    people,
    personCanonicalMap,
    existingClaims,
  });
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, JSON.stringify(preview, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ output: path.relative(repoRoot, options.outputPath), ...preview.summary }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
