const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const autoReviewVersion = 'auto-non-criminal-v1';
const blockedClaimTypes = new Set(['legal_case']);

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
    'id,claim_type,claim_value,claim_json,confidence_level,review_score,source_name,source_url,scoring_reasons,updated_at',
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

function isEligibleClaim(claim, options) {
  if (claim.source_name === 'Wikidata 人物補充資料' && claim.claim_json?.identityMatch?.status !== 'matched') {
    return false;
  }

  return (
    !blockedClaimTypes.has(claim.claim_type) &&
    Number(claim.review_score) >= options.minScore
  );
}

function nextScoringReasons(claim) {
  const existing = Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : [];
  return [
    ...existing,
    {
      version: autoReviewVersion,
      reason: 'non-criminal Wikidata claim type auto-approved for local review workflow',
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
  const sensitiveBefore = {
    legal_case: await countPublicClaimsByType('legal_case'),
  };
  let totalScanned = 0;
  let totalEligible = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let batches = 0;

  while (batches < options.maxBatches) {
    const candidates = await fetchReviewCandidates(options);
    const eligibleClaims = candidates.filter((claim) => isEligibleClaim(claim, options));
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

  const sensitiveAfter = {
    legal_case: await countPublicClaimsByType('legal_case'),
  };

  if (sensitiveAfter.legal_case > sensitiveBefore.legal_case) {
    throw new Error(`criminal-record claims became public: ${JSON.stringify({ before: sensitiveBefore, after: sensitiveAfter })}`);
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
    autoReviewedRule: 'all matching review claims except legal_case',
    sourceSpecificRules: {
      wikidata: 'requires claim_json.identityMatch.status=matched',
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
