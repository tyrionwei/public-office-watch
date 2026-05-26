const localSupabaseUrl = process.env.SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const localServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const wikidataSourceName = 'Wikidata 人物補充資料';

function parseArgs(argv) {
  const options = {
    limit: 5000,
    sampleLimit: 30,
    publicOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--limit') {
      options.limit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--sample-limit') {
      options.sampleLimit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--public-only') {
      options.publicOnly = true;
    }
  }

  return options;
}

function supabaseUrl(path) {
  return new URL(`${localSupabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`);
}

async function fetchClaims(options) {
  const url = supabaseUrl('person_claims');
  url.searchParams.set(
    'select',
    'id,claim_type,claim_value,review_status,visibility,is_public,source_name,source_url,claim_json,people(name,party,position,district)',
  );
  url.searchParams.set('source_name', `eq.${wikidataSourceName}`);
  url.searchParams.set('order', 'updated_at.desc');
  url.searchParams.set('limit', String(options.limit));

  if (options.publicOnly) {
    url.searchParams.set('is_public', 'eq.true');
  }

  const response = await fetch(url, {
    headers: {
      apikey: localServiceRoleKey,
      authorization: `Bearer ${localServiceRoleKey}`,
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to fetch person_claims: ${body?.message ?? response.statusText}`);
  }

  return body;
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

async function main() {
  if (!localServiceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for missing identityMatch report.');
  }

  const options = parseArgs(process.argv.slice(2));
  const claims = await fetchClaims(options);
  const missing = claims.filter((claim) => !claim.claim_json?.identityMatch);
  const byType = {};
  const byStatus = {};

  for (const claim of missing) {
    increment(byType, claim.claim_type);
    increment(byStatus, [claim.review_status, claim.visibility, claim.is_public ? 'public' : 'private'].join('/'));
  }

  console.log(JSON.stringify({
    sourceName: wikidataSourceName,
    scanned: claims.length,
    missingIdentityMatch: missing.length,
    publicOnly: options.publicOnly,
    byType,
    byStatus,
    samples: missing.slice(0, options.sampleLimit).map((claim) => ({
      claimId: claim.id,
      person: claim.people?.name ?? null,
      party: claim.people?.party ?? null,
      position: claim.people?.position ?? null,
      district: claim.people?.district ?? null,
      claimType: claim.claim_type,
      claimValue: claim.claim_value,
      reviewStatus: claim.review_status,
      visibility: claim.visibility,
      isPublic: claim.is_public,
      sourceUrl: claim.source_url,
    })),
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`missing identityMatch report failed: ${message}`);
  process.exit(1);
});
