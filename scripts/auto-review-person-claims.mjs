import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '') : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

const autoReviewVersion = 'auto-verified-external-id-or-identity-match-v3';
const wikidataSourceName = 'Wikidata 人物補充資料';
const voteTwSourceName = 'VoteTW';
const voteTwSourceId = 'votetw-person-enrichment';
const blockedClaimTypes = new Set(['legal_case', 'family_relation']);
const wikidataFallbackOnlyClaimTypes = new Set(['education', 'experience']);
const wikidataExternalIdUnlockedClaimTypes = new Set([
  'external_id',
  'gender',
  'birth_date',
  'education',
  'experience',
  'position',
  'office',
  'district',
  'party',
]);
const voteTwAutoClaimTypes = new Set([
  'external_id',
  'birth_date',
  'gender',
  'education',
  'experience',
  'party_affiliation',
  'platform',
]);

function parseArgs(argv) {
  const options = {
    write: false,
    limit: 500,
    maxBatches: 100,
    minScore: 0,
    sourceName: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      options.write = true;
    } else if (arg === '--limit') {
      options.limit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--min-score') {
      options.minScore = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--max-batches') {
      options.maxBatches = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--source-name') {
      options.sourceName = argv[index + 1] ?? '';
      index += 1;
    }
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error('--limit must be a positive integer');
  }

  if (!Number.isInteger(options.minScore) || options.minScore < 0 || options.minScore > 100) {
    throw new Error('--min-score must be an integer from 0 to 100');
  }

  if (!Number.isInteger(options.maxBatches) || options.maxBatches <= 0) {
    throw new Error('--max-batches must be a positive integer');
  }

  return options;
}

function supabaseUrl(path) {
  return new URL(`${localSupabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`);
}

async function supabaseJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: localServiceRoleKey,
      authorization: `Bearer ${localServiceRoleKey}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url.pathname} failed: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function fetchReviewCandidates(options) {
  const pageSize = 1000;
  const claims = [];

  while (true) {
    const url = supabaseUrl('person_claims');
    url.searchParams.set(
      'select',
      'id,claim_key,person_id,claim_type,claim_value,claim_json,confidence_level,review_score,source_name,source_url,scoring_reasons,updated_at',
    );
    if (options.sourceName) {
      url.searchParams.set('source_name', `eq.${options.sourceName}`);
    }
    url.searchParams.set('review_status', 'in.(pending,needs_more_evidence)');
    url.searchParams.set('claim_type', 'not.eq.legal_case');
    url.searchParams.set('review_score', `gte.${options.minScore}`);
    url.searchParams.set('order', 'review_score.desc,updated_at.desc,id.asc');
    url.searchParams.set('offset', String(claims.length));
    url.searchParams.set('limit', String(pageSize));

    const page = await supabaseJson(url);
    claims.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return claims.map((claim) => ({
    ...claim,
    claim_id: claim.id,
  }));
}

function inFilter(values) {
  return `in.(${Array.from(values).join(',')})`;
}

function hasPublicValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

function fallbackClaimKey(claim) {
  if (!claim.person_id || !wikidataFallbackOnlyClaimTypes.has(claim.claim_type)) {
    return null;
  }

  return `${claim.person_id}:${claim.claim_type}`;
}

async function fetchPrimaryPublicFieldKeys(claims) {
  const personIds = new Set(
    claims
      .filter((claim) => claim.source_name === wikidataSourceName && fallbackClaimKey(claim))
      .map((claim) => claim.person_id),
  );

  if (personIds.size === 0) {
    return new Set();
  }

  const url = supabaseUrl('public_people');
  url.searchParams.set('select', 'person_id,education,experience');
  url.searchParams.set('person_id', inFilter(personIds));
  url.searchParams.set('limit', String(personIds.size));

  const rows = await supabaseJson(url);
  const keys = new Set();

  for (const row of rows) {
    for (const claimType of wikidataFallbackOnlyClaimTypes) {
      if (hasPublicValue(row[claimType])) {
        keys.add(`${row.person_id}:${claimType}`);
      }
    }
  }

  return keys;
}

async function fetchPrimaryPublicClaimKeys(claims) {
  const personIds = new Set();
  const claimTypes = new Set();

  for (const claim of claims) {
    if (claim.source_name === wikidataSourceName && fallbackClaimKey(claim)) {
      personIds.add(claim.person_id);
      claimTypes.add(claim.claim_type);
    }
  }

  if (personIds.size === 0 || claimTypes.size === 0) {
    return new Set();
  }

  const url = supabaseUrl('public_person_claims');
  url.searchParams.set('select', 'person_id,claim_type,source_name');
  url.searchParams.set('person_id', inFilter(personIds));
  url.searchParams.set('claim_type', inFilter(claimTypes));
  url.searchParams.set('limit', '10000');

  const rows = await supabaseJson(url);
  return new Set(
    rows
      .filter((row) => row.source_name !== wikidataSourceName)
      .map((row) => `${row.person_id}:${row.claim_type}`),
  );
}

async function fetchVerifiedExternalIdKeys(sourceName) {
  const url = supabaseUrl('public_person_claims');
  url.searchParams.set('select', 'person_id,claim_value,claim_json');
  url.searchParams.set('source_name', `eq.${sourceName}`);
  url.searchParams.set('claim_type', 'eq.external_id');
  url.searchParams.set('limit', '10000');

  const rows = await supabaseJson(url);
  return new Set(rows.flatMap((row) => {
    const qidFromValue = String(row.claim_value ?? '').match(/^wikidata:(Q\d+)$/i)?.[1];
    const qidFromJson = row.claim_json?.wikidataQid;
    return [qidFromValue, qidFromJson]
      .filter((qid) => row.person_id && typeof qid === 'string' && /^Q\d+$/i.test(qid))
      .map((qid) => `${row.person_id}:wikidata:${qid.toUpperCase()}`);
  }));
}

function normalizePartyAffiliation(value) {
  return String(value ?? '')
    .trim()
    .replace(/臺/g, '台')
    .replace(/\s+/g, '')
    .replace(/^無黨派$/, '無黨籍');
}

async function fetchCurrentPartyByPersonId(claims) {
  const personIds = new Set(
    claims
      .filter((claim) =>
        claim.source_name === wikidataSourceName &&
        claim.claim_type === 'party_affiliation' &&
        claim.person_id,
      )
      .map((claim) => claim.person_id),
  );

  if (personIds.size === 0) {
    return new Map();
  }

  const url = supabaseUrl('people');
  url.searchParams.set('select', 'id,party');
  url.searchParams.set('id', inFilter(personIds));
  url.searchParams.set('limit', String(personIds.size));

  const rows = await supabaseJson(url);
  return new Map(rows.map((row) => [row.id, row.party]));
}

async function countPublicClaimsByType(claimType) {
  const url = supabaseUrl('public_person_claims');
  url.searchParams.set('select', 'claim_id');
  url.searchParams.set('claim_type', `eq.${claimType}`);

  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      apikey: localServiceRoleKey,
      authorization: `Bearer ${localServiceRoleKey}`,
      prefer: 'count=exact',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`COUNT public_person_claims/${claimType} failed: ${response.status} ${response.statusText}`);
  }

  const range = response.headers.get('content-range') ?? '';
  const total = range.split('/')[1];
  return total === '*' || total === undefined ? 0 : Number.parseInt(total, 10);
}

async function countSensitivePublicClaims() {
  const entries = await Promise.all(Array.from(blockedClaimTypes).map(async (claimType) => [
    claimType,
    await countPublicClaimsByType(claimType),
  ]));
  return Object.fromEntries(entries);
}

function verifiedExternalIdKeyForClaim(claim) {
  const qid = claim.claim_json?.wikidataQid;
  if (!claim.person_id || typeof qid !== 'string' || !/^Q\d+$/i.test(qid)) {
    return null;
  }

  return `${claim.person_id}:wikidata:${qid.toUpperCase()}`;
}

function isVoteTwClaim(claim) {
  return claim.source_name === voteTwSourceName || claim.claim_json?.sourceId === voteTwSourceId;
}

function explainVoteTwEligibility(claim) {
  if (!voteTwAutoClaimTypes.has(claim.claim_type)) {
    return { eligible: false, reason: 'votetw-claim-type-not-auto-unlocked' };
  }

  if (claim.claim_json?.identityMatch?.status !== 'matched') {
    return { eligible: false, reason: 'votetw-identity-match-not-confirmed' };
  }

  if (claim.claim_json?.publicationGate?.status !== 'passed') {
    return { eligible: false, reason: 'votetw-publication-gate-not-passed' };
  }

  return { eligible: true, reason: 'votetw-publication-gate-passed' };
}

function explainWikidataPartyAffiliationEligibility(claim, verifiedExternalIdKeys, currentPartyByPersonId) {
  const externalIdKey = verifiedExternalIdKeyForClaim(claim);
  if (!externalIdKey || !verifiedExternalIdKeys.has(externalIdKey)) {
    return { eligible: false, reason: 'wikidata-party-affiliation-qid-not-verified' };
  }

  const hasExplicitDates =
    claim.claim_json?.explicitDateSource === true &&
    (Boolean(claim.claim_json?.startDate) || Boolean(claim.claim_json?.endDate));
  if (hasExplicitDates) {
    return { eligible: true, reason: 'wikidata-party-affiliation-dated-verified-qid' };
  }

  const currentParty = normalizePartyAffiliation(currentPartyByPersonId.get(claim.person_id));
  const claimedParty = normalizePartyAffiliation(claim.claim_value);
  if (currentParty && claimedParty === currentParty) {
    return { eligible: true, reason: 'wikidata-party-affiliation-current-party-corroborated' };
  }

  return { eligible: false, reason: 'wikidata-party-affiliation-undated-conflict' };
}

function explainEligibility(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys, currentPartyByPersonId) {
  if (blockedClaimTypes.has(claim.claim_type)) {
    return { eligible: false, reason: 'blocked-sensitive-claim-type' };
  }

  if (Number(claim.review_score) < options.minScore) {
    return { eligible: false, reason: 'below-min-score' };
  }

  if (isVoteTwClaim(claim)) {
    return explainVoteTwEligibility(claim);
  }

  if (claim.source_name !== wikidataSourceName) {
    return { eligible: true, reason: 'non-wikidata-non-sensitive' };
  }

  if (claim.claim_type === 'party_affiliation') {
    return explainWikidataPartyAffiliationEligibility(claim, verifiedExternalIdKeys, currentPartyByPersonId);
  }

  if (!wikidataExternalIdUnlockedClaimTypes.has(claim.claim_type)) {
    return { eligible: false, reason: 'wikidata-claim-type-not-auto-unlocked' };
  }

  const primaryKey = fallbackClaimKey(claim);
  if (primaryKey && primaryPublicFieldKeys.has(primaryKey)) {
    return { eligible: false, reason: 'wikidata-fallback-skipped-public-field-exists' };
  }

  if (primaryKey && primaryPublicClaimKeys.has(primaryKey)) {
    return { eligible: false, reason: 'wikidata-fallback-skipped-primary-claim-exists' };
  }

  const externalIdKey = verifiedExternalIdKeyForClaim(claim);
  if (!externalIdKey) {
    return { eligible: false, reason: 'wikidata-missing-person-or-qid' };
  }

  if (verifiedExternalIdKeys.has(externalIdKey)) {
    return { eligible: true, reason: 'wikidata-verified-external-id-unlocked' };
  }

  if (claim.claim_json?.identityMatch?.status === 'matched') {
    return { eligible: true, reason: 'wikidata-identity-match-auto-unlocked' };
  }

  return { eligible: false, reason: 'wikidata-external-id-not-verified' };
}

function isEligibleClaim(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys, currentPartyByPersonId) {
  return explainEligibility(
    claim,
    options,
    verifiedExternalIdKeys,
    primaryPublicFieldKeys,
    primaryPublicClaimKeys,
    currentPartyByPersonId,
  ).eligible;
}

function incrementReason(reasonCounts, reason) {
  reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
}

function nextScoringReasons(claim) {
  const existing = Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : [];
  return [
    ...existing,
    {
      version: autoReviewVersion,
      reason: 'low-sensitivity claim auto-approved after verified external_id or matched identity evidence for the same person and source entity',
      reviewedAt: new Date().toISOString(),
    },
  ];
}

async function approveClaim(claim) {
  const url = supabaseUrl('person_claims');
  url.searchParams.set('id', `eq.${claim.claim_id}`);

  const reviewedAt = new Date().toISOString();
  await supabaseJson(url, {
    method: 'PATCH',
    headers: {
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      review_status: 'verified',
      visibility: 'public',
      is_public: true,
      scoring_version: autoReviewVersion,
      scoring_reasons: nextScoringReasons(claim),
      auto_reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    }),
  });

  if (claim.claim_type === 'party_affiliation' && claim.claim_key) {
    const affiliationUrl = supabaseUrl('person_party_affiliations');
    affiliationUrl.searchParams.set('source_claim_key', 'eq.' + claim.claim_key);
    await supabaseJson(affiliationUrl, {
      method: 'PATCH',
      headers: {
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        review_status: 'verified',
        is_public: true,
        updated_at: reviewedAt,
      }),
    });
  }
}

async function main() {
  if (!localServiceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for auto review.');
  }

  const options = parseArgs(process.argv.slice(2));
  const sensitiveBefore = await countSensitivePublicClaims();
  const verifiedExternalIdKeys = await fetchVerifiedExternalIdKeys(wikidataSourceName);
  let totalScanned = 0;
  let totalEligible = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const eligibilityReasonCounts = {};
  let batches = 0;

  while (batches < options.maxBatches) {
    const candidates = await fetchReviewCandidates(options);
    const primaryPublicFieldKeys = await fetchPrimaryPublicFieldKeys(candidates);
    const primaryPublicClaimKeys = await fetchPrimaryPublicClaimKeys(candidates);
    const currentPartyByPersonId = await fetchCurrentPartyByPersonId(candidates);
    for (const claim of candidates) {
      incrementReason(
        eligibilityReasonCounts,
        explainEligibility(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys, currentPartyByPersonId).reason,
      );
    }
    const allEligibleClaims = candidates.filter((claim) =>
      isEligibleClaim(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys, currentPartyByPersonId),
    );
    const eligibleClaims = options.write ? allEligibleClaims.slice(0, options.limit) : allEligibleClaims;
    totalScanned += candidates.length;
    totalEligible += eligibleClaims.length;
    totalSkipped += candidates.length - eligibleClaims.length;

    if (!options.write) {
      break;
    }

    if (eligibleClaims.length === 0) {
      break;
    }

    for (const claim of eligibleClaims) {
      await approveClaim(claim);
    }

    totalUpdated += eligibleClaims.length;
    batches += 1;

    if (candidates.length < options.limit) {
      break;
    }
  }

  const sensitiveAfter = await countSensitivePublicClaims();

  for (const claimType of blockedClaimTypes) {
    if (sensitiveAfter[claimType] > sensitiveBefore[claimType]) {
      throw new Error(`sensitive claims became public: ${JSON.stringify({ claimType, before: sensitiveBefore, after: sensitiveAfter })}`);
    }
  }

  console.log(JSON.stringify({
    status: options.write ? 'updated' : 'dry-run',
    sourceName: options.sourceName || 'all',
    minScore: options.minScore,
    batchLimit: options.limit,
    maxBatches: options.maxBatches,
    batches,
    scanned: totalScanned,
    eligible: totalEligible,
    updated: totalUpdated,
    skipped: totalSkipped,
    verifiedExternalIdKeyCount: verifiedExternalIdKeys.size,
    eligibilityReasonCounts,
    autoReviewedRule: 'VoteTW claims require a passed publicationGate; Wikidata party affiliations require a canonical verified QID plus explicit dates or agreement with the current party; other Wikidata low-sensitivity claims require a verified external_id or matched identity evidence',
    sourceSpecificRules: {
      votetw: {
        requiresIdentityMatch: true,
        requiresPublicationGate: 'passed',
        autoClaimTypes: Array.from(voteTwAutoClaimTypes),
      },
      wikidata: {
        requiresIdentityMatch: 'when external_id has not been verified yet',
        requiresVerifiedExternalId: 'party affiliations only',
        fallbackOnlyClaimTypes: Array.from(wikidataFallbackOnlyClaimTypes),
        autoClaimTypes: [...wikidataExternalIdUnlockedClaimTypes, 'party_affiliation'],
        partyAffiliationRules: {
          explicitDatesOrCurrentPartyAgreement: true,
          usesCanonicalPersonMapping: true,
        },
      },
    },
    keptManualReview: Array.from(blockedClaimTypes),
    sensitivePublicBefore: sensitiveBefore,
    sensitivePublicAfter: sensitiveAfter,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`auto review failed: ${message}`);
  process.exit(1);
});
