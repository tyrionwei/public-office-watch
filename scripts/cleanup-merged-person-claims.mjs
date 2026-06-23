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
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const options = {
    write: false,
    limit: 100000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    if (arg === '--limit') {
      options.limit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function supabaseJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
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

async function fetchRows(viewName, select, options) {
  const pageSize = 1000;
  const rows = [];

  while (rows.length < options.limit) {
    const url = restUrl(viewName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(rows.length));
    url.searchParams.set('limit', String(Math.min(pageSize, options.limit - rows.length)));

    const page = await supabaseJson(url);
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }

  return rows;
}

function publicClaimKey(claim, personId = claim.person_id) {
  return [
    personId,
    claim.claim_type,
    claim.claim_value ?? '',
    claim.source_name ?? '',
  ].join('|');
}

async function archiveClaim(claim, canonicalClaim) {
  const url = restUrl('person_claims');
  url.searchParams.set('id', `eq.${claim.id}`);

  await supabaseJson(url, {
    method: 'PATCH',
    headers: {
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      review_status: 'archived',
      visibility: 'private',
      is_public: false,
      scoring_version: 'merged-person-claim-cleanup-v1',
      scoring_reasons: [
        ...(Array.isArray(claim.scoring_reasons) ? claim.scoring_reasons : []),
        {
          version: 'merged-person-claim-cleanup-v1',
          reason: 'duplicate person claim archived because canonical person already has the same verified public claim',
          canonicalClaimId: canonicalClaim.id,
          reviewedAt: new Date().toISOString(),
        },
      ],
      updated_at: new Date().toISOString(),
    }),
  });
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for merged person claim cleanup.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [mergeDecisions, claims] = await Promise.all([
    fetchRows('person_merge_decisions', 'duplicate_person_id,canonical_person_id,status', options),
    fetchRows('person_claims', 'id,person_id,claim_type,claim_value,review_status,visibility,is_public,source_name,scoring_reasons', options),
  ]);
  const canonicalByDuplicate = new Map(
    mergeDecisions
      .filter((decision) => decision.status === 'verified')
      .map((decision) => [decision.duplicate_person_id, decision.canonical_person_id]),
  );
  const verifiedCanonicalClaims = new Map();

  for (const claim of claims) {
    if (claim.review_status !== 'verified' || claim.visibility !== 'public' || claim.is_public !== true) {
      continue;
    }

    verifiedCanonicalClaims.set(publicClaimKey(claim), claim);
  }

  const targets = [];

  for (const claim of claims) {
    const canonicalPersonId = canonicalByDuplicate.get(claim.person_id);

    if (!canonicalPersonId || !['pending', 'needs_more_evidence'].includes(claim.review_status)) {
      continue;
    }

    const canonicalClaim = verifiedCanonicalClaims.get(publicClaimKey(claim, canonicalPersonId));

    if (canonicalClaim) {
      targets.push({
        claim,
        canonicalClaim,
        canonicalPersonId,
      });
    }
  }

  if (options.write) {
    for (const target of targets) {
      await archiveClaim(target.claim, target.canonicalClaim);
    }
  }

  console.log(JSON.stringify({
    status: options.write ? 'updated' : 'dry-run',
    mergedDuplicatePeople: canonicalByDuplicate.size,
    scannedClaims: claims.length,
    archivedCandidates: targets.length,
    archivedCount: options.write ? targets.length : 0,
    samples: targets.slice(0, 20).map((target) => ({
      claimId: target.claim.id,
      duplicatePersonId: target.claim.person_id,
      canonicalPersonId: target.canonicalPersonId,
      claimType: target.claim.claim_type,
      claimValue: target.claim.claim_value,
      sourceName: target.claim.source_name,
      canonicalClaimId: target.canonicalClaim.id,
    })),
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`merged person claim cleanup failed: ${message}`);
  process.exit(1);
});
