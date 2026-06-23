const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const autoReviewVersion = 'auto-verified-external-id-or-identity-match-v2';
const wikidataSourceName = 'Wikidata 人物補充資料';
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
  const url = supabaseUrl('person_claims');
  url.searchParams.set(
    'select',
    'id,person_id,claim_type,claim_value,claim_json,confidence_level,review_score,source_name,source_url,scoring_reasons,updated_at',
  );
  if (options.sourceName) {
    url.searchParams.set('source_name', `eq.${options.sourceName}`);
  }
  url.searchParams.set('review_status', 'in.(pending,needs_more_evidence)');
  url.searchParams.set('claim_type', 'not.eq.legal_case');
  url.searchParams.set('review_score', `gte.${options.minScore}`);
  url.searchParams.set('order', 'review_score.desc,updated_at.desc');
  url.searchParams.set('limit', String(options.limit));

  const claims = await supabaseJson(url);
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
  const url = supabaseUrl('person_claims');
  url.searchParams.set('select', 'person_id,claim_value,claim_json');
  url.searchParams.set('source_name', `eq.${sourceName}`);
  url.searchParams.set('claim_type', 'eq.external_id');
  url.searchParams.set('review_status', 'eq.verified');
  url.searchParams.set('visibility', 'eq.public');
  url.searchParams.set('is_public', 'eq.true');
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

function explainEligibility(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys) {
  if (blockedClaimTypes.has(claim.claim_type)) {
    return { eligible: false, reason: 'blocked-sensitive-claim-type' };
  }

  if (Number(claim.review_score) < options.minScore) {
    return { eligible: false, reason: 'below-min-score' };
  }

  if (claim.source_name !== wikidataSourceName) {
    return { eligible: true, reason: 'non-wikidata-non-sensitive' };
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

function isEligibleClaim(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys) {
  return explainEligibility(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys).eligible;
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
      auto_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
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
    for (const claim of candidates) {
      incrementReason(
        eligibilityReasonCounts,
        explainEligibility(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys).reason,
      );
    }
    const eligibleClaims = candidates.filter((claim) =>
      isEligibleClaim(claim, options, verifiedExternalIdKeys, primaryPublicFieldKeys, primaryPublicClaimKeys),
    );
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
    autoReviewedRule: 'non-Wikidata claims pass existing non-sensitive rule; Wikidata low-sensitivity claims require either a verified external_id for the same person/QID or matched identity evidence',
    sourceSpecificRules: {
      wikidata: {
        requiresIdentityMatch: 'when external_id has not been verified yet',
        requiresVerifiedExternalId: false,
        fallbackOnlyClaimTypes: Array.from(wikidataFallbackOnlyClaimTypes),
        autoClaimTypes: Array.from(wikidataExternalIdUnlockedClaimTypes),
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
