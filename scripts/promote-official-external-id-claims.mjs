import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultReportPath = path.join(repoRoot, 'data-sources', 'missing-person-external-ids-report.json');

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
    reportPath: defaultReportPath,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--report') {
      options.reportPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function patchClaim(claimId) {
  const url = restUrl('person_claims');
  url.searchParams.set('id', `eq.${claimId}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify({
      review_status: 'verified',
      visibility: 'public',
      is_public: true,
      scoring_version: 'official-external-id-public-v1',
      scoring_reasons: [
        {
          version: 'official-external-id-public-v1',
          reason: 'official non-sensitive external_id claim is safe for public identity resolution',
          reviewedAt: new Date().toISOString(),
        },
      ],
      auto_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to promote claim ${claimId}: ${body?.message ?? response.statusText}`);
  }

  return body[0] ?? null;
}

function isOfficialPublicExternalIdClaim(claim) {
  if (!claim.claimId || typeof claim.claimValue !== 'string') {
    return false;
  }

  if (claim.sourceName?.includes('中央選舉委員會') && claim.claimValue.startsWith('cec-')) {
    return true;
  }

  if (claim.sourceName?.includes('立法院開放資料') && claim.claimValue.startsWith('ly-legislator-')) {
    return true;
  }

  return false;
}

function claimIdsFromReport(report) {
  return Array.from(new Set(
    (report.records ?? [])
      .filter((record) => record.category === 'B_external_id_claim_not_public')
      .flatMap((record) => record.ownExternalClaims ?? [])
      .filter(isOfficialPublicExternalIdClaim)
      .map((claim) => claim.claimId),
  ));
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for official external ID promotion.');
  }

  const options = parseArgs(process.argv.slice(2));
  const report = JSON.parse(fs.readFileSync(options.reportPath, 'utf8'));
  const claimIds = claimIdsFromReport(report);

  if (!options.write) {
    console.log(JSON.stringify({
      status: 'ok',
      dryRun: true,
      claimCount: claimIds.length,
      claimIds,
    }, null, 2));
    return;
  }

  const promoted = [];
  for (const claimId of claimIds) {
    promoted.push(await patchClaim(claimId));
  }

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: false,
    promotedCount: promoted.length,
    promoted,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`official external ID promotion failed: ${message}`);
  process.exit(1);
});
