const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'REDACTED_SUPABASE_SERVICE_ROLE_KEY';
const wikidataSourceName = 'Wikidata 人物補充資料';
const downgradeVersion = 'identity-match-required-v1';

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
    'id,claim_type,claim_value,review_status,visibility,is_public,source_name,source_url,claim_json,scoring_reasons',
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

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const claims = await fetchClaims(options);
  const byType = {};
  const byStatus = {};

  for (const claim of claims) {
    increment(byType, claim.claim_type);
    increment(byStatus, [claim.review_status, claim.visibility, claim.is_public ? 'public' : 'private'].join('/'));
  }

  if (options.write) {
    for (const claim of claims) {
      await downgradeClaim(claim);
    }
  }

  console.log(JSON.stringify({
    status: options.write ? 'updated' : 'dry-run',
    sourceName: wikidataSourceName,
    missingIdentityMatch: claims.length,
    downgraded: options.write ? claims.length : 0,
    byType,
    byStatus,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`downgrade missing identityMatch failed: ${message}`);
  process.exit(1);
});
