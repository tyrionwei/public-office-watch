const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'REDACTED_SUPABASE_SERVICE_ROLE_KEY';

const allowedSourceName = 'Wikidata 人物補充資料';
const autoReviewVersion = 'auto-low-risk-v1';
const lowRiskClaimTypes = new Set(['gender', 'external_id']);

function parseArgs(argv) {
  const options = {
    write: false,
    limit: 500,
    minScore: 45,
    sourceName: allowedSourceName,
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
  const url = supabaseUrl('person_claim_review_queue');
  url.searchParams.set(
    'select',
    'claim_id,raw_name,claim_type,claim_value,confidence_level,review_score,source_name,source_url,scoring_reasons,updated_at',
  );
  url.searchParams.set('source_name', `eq.${options.sourceName}`);
  url.searchParams.set('claim_type', 'in.(gender,external_id)');
  url.searchParams.set('confidence_level', 'in.(A,B,C)');
  url.searchParams.set('review_score', `gte.${options.minScore}`);
  url.searchParams.set('order', 'review_score.desc,updated_at.desc');
  url.searchParams.set('limit', String(options.limit));

  return supabaseJson(url);
}

async function countPublicClaimsByType(claimType) {
  const url = supabaseUrl('public_person_claims');
  url.searchParams.set('select', 'claim_id');
  url.searchParams.set('source_name', `eq.${allowedSourceName}`);
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

function isEligibleClaim(claim) {
  return (
    claim.source_name === allowedSourceName &&
    lowRiskClaimTypes.has(claim.claim_type) &&
    Number(claim.review_score) >= 45 &&
    ['A', 'B', 'C'].includes(claim.confidence_level)
  );
}

function nextScoringReasons(claim) {
  const existing = Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : [];
  return [
    ...existing,
    {
      version: autoReviewVersion,
      reason: 'low-risk Wikidata claim type auto-approved for local review workflow',
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
  const options = parseArgs(process.argv.slice(2));
  const candidates = await fetchReviewCandidates(options);
  const eligibleClaims = candidates.filter(isEligibleClaim);
  const sensitiveBefore = {
    family_relation: await countPublicClaimsByType('family_relation'),
    legal_case: await countPublicClaimsByType('legal_case'),
  };

  if (options.write) {
    for (const claim of eligibleClaims) {
      await approveClaim(claim);
    }
  }

  const sensitiveAfter = {
    family_relation: await countPublicClaimsByType('family_relation'),
    legal_case: await countPublicClaimsByType('legal_case'),
  };

  if (sensitiveAfter.family_relation !== 0 || sensitiveAfter.legal_case !== 0) {
    throw new Error(`sensitive Wikidata claims were public: ${JSON.stringify(sensitiveAfter)}`);
  }

  console.log(JSON.stringify({
    status: options.write ? 'updated' : 'dry-run',
    sourceName: options.sourceName,
    minScore: options.minScore,
    scanned: candidates.length,
    eligible: eligibleClaims.length,
    updated: options.write ? eligibleClaims.length : 0,
    skipped: candidates.length - eligibleClaims.length,
    autoReviewedTypes: Array.from(lowRiskClaimTypes),
    keptManualReview: ['birth_date', 'education', 'experience', 'platform', 'finance_summary', 'family_relation', 'legal_case'],
    sensitivePublicBefore: sensitiveBefore,
    sensitivePublicAfter: sensitiveAfter,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`auto review failed: ${message}`);
  process.exit(1);
});
