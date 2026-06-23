const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const wikidataSourceName = 'Wikidata 人物補充資料';
const downgradeVersion = 'identity-match-required-v1';
const restoreVersion = 'restore-reviewed-missing-identity-match-v1';
const lowSensitivityClaimTypes = new Set([
  'gender',
  'birth_date',
  'education',
  'experience',
  'position',
  'office',
  'district',
  'party',
  'external_id',
]);

function parseArgs(argv) {
  const options = {
    write: false,
    limit: 5000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      options.write = true;
    } else if (arg === '--limit') {
      options.limit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    }
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error('--limit must be a positive integer');
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

async function fetchClaims(options) {
  const url = supabaseUrl('person_claims');
  url.searchParams.set(
    'select',
    'id,claim_type,claim_value,review_status,visibility,is_public,source_name,source_url,claim_json,scoring_reasons,auto_reviewed_at',
  );
  url.searchParams.set('source_name', `eq.${wikidataSourceName}`);
  url.searchParams.set('limit', String(options.limit));
  url.searchParams.set('order', 'updated_at.desc');

  const claims = await supabaseJson(url);
  return claims.filter((claim) => !claim.claim_json?.identityMatch);
}

function nextScoringReasons(claim) {
  const existing = Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : [];
  return [
    ...existing,
    {
      version: downgradeVersion,
      reason: 'Wikidata claim was created before identityMatch evidence was required; downgraded for re-review',
      reviewedAt: new Date().toISOString(),
    },
  ];
}

async function downgradeClaim(claim) {
  const url = supabaseUrl('person_claims');
  url.searchParams.set('id', `eq.${claim.id}`);

  await supabaseJson(url, {
    method: 'PATCH',
    headers: {
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      review_status: 'needs_more_evidence',
      visibility: 'review_only',
      is_public: false,
      scoring_version: downgradeVersion,
      scoring_reasons: nextScoringReasons(claim),
      auto_reviewed_at: null,
      updated_at: new Date().toISOString(),
    }),
  });
}

function hasPriorAutoApproval(claim) {
  const reasons = Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : [];
  return reasons.some((reason) => {
    const version = typeof reason === 'object' && reason !== null ? reason.version : null;
    return version === 'auto-non-criminal-v1' || version === 'auto-verified-external-id-v1';
  });
}

function restoreDecisionForClaim(claim) {
  const decision = claim.claim_json?.reviewDecision?.decision;

  if (decision === 'reject') {
    return {
      review_status: 'rejected',
      visibility: 'private',
      is_public: false,
      auto_reviewed_at: null,
    };
  }

  if (decision === 'approve') {
    return {
      review_status: 'verified',
      visibility: 'public',
      is_public: true,
      auto_reviewed_at: claim.auto_reviewed_at ?? new Date().toISOString(),
    };
  }

  if (lowSensitivityClaimTypes.has(claim.claim_type) && hasPriorAutoApproval(claim)) {
    return {
      review_status: 'verified',
      visibility: 'public',
      is_public: true,
      auto_reviewed_at: claim.auto_reviewed_at ?? new Date().toISOString(),
    };
  }

  return null;
}

async function restoreClaim(claim, decision) {
  const url = supabaseUrl('person_claims');
  url.searchParams.set('id', `eq.${claim.id}`);

  const existingReasons = Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : [];
  await supabaseJson(url, {
    method: 'PATCH',
    headers: {
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      ...decision,
      scoring_version: restoreVersion,
      scoring_reasons: [
        ...existingReasons,
        {
          version: restoreVersion,
          reason: 'restored previous reviewed state before identityMatch downgrade',
          reviewedAt: new Date().toISOString(),
        },
      ],
      updated_at: new Date().toISOString(),
    }),
  });
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

async function main() {
  if (!localServiceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for missing identityMatch downgrade.');
  }

  const options = parseArgs(process.argv.slice(2));
  const claims = await fetchClaims(options);
  const restorableClaims = claims
    .filter((claim) => ['pending', 'needs_more_evidence'].includes(claim.review_status))
    .map((claim) => ({ claim, decision: restoreDecisionForClaim(claim) }))
    .filter((item) => item.decision);
  const downgradeClaims = claims.filter((claim) =>
    claim.review_status === 'pending' &&
    !claim.claim_json?.reviewDecision &&
    !restoreDecisionForClaim(claim)
  );
  const byType = {};
  const byStatus = {};

  for (const claim of claims) {
    increment(byType, claim.claim_type);
    increment(byStatus, [claim.review_status, claim.visibility, claim.is_public ? 'public' : 'private'].join('/'));
  }

  if (options.write) {
    for (const { claim, decision } of restorableClaims) {
      await restoreClaim(claim, decision);
    }

    for (const claim of downgradeClaims) {
      await downgradeClaim(claim);
    }
  }

  console.log(JSON.stringify({
    status: options.write ? 'updated' : 'dry-run',
    sourceName: wikidataSourceName,
    missingIdentityMatch: claims.length,
    restored: options.write ? restorableClaims.length : 0,
    downgraded: options.write ? downgradeClaims.length : 0,
    byType,
    byStatus,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`downgrade missing identityMatch failed: ${message}`);
  process.exit(1);
});
