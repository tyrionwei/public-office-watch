import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPreviewPath = path.join(repoRoot, 'local-data', 'tnl-dark-guide-family-claims-preview.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const scoringVersion = 'tnl-dark-guide-family-v1';

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
  const options = { apply: false, expectedCount: null, previewPath: defaultPreviewPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--expected-count') options.expectedCount = Number(argv[++index]);
    else if (arg === '--preview') options.previewPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (options.apply && !Number.isInteger(options.expectedCount)) {
    throw new Error('--apply requires --expected-count');
  }
  return options;
}

export function buildReviewedFamilyClaimRows(preview, reviewedAt) {
  const planned = preview?.plannedClaims;
  if (!Array.isArray(planned)) throw new Error('Preview plannedClaims is missing');
  const rows = planned.map((claim) => {
    if (!['A', 'B'].includes(claim.confidenceLevel)) {
      throw new Error(`Unexpected confidence for ${claim.claimKey}`);
    }
    if (claim.claimType !== 'family_relation') {
      throw new Error(`Unexpected claim type for ${claim.claimKey}`);
    }
    if (claim.claimJson?.publicationGate?.requiresHumanApproval !== true) {
      throw new Error(`Missing publication gate for ${claim.claimKey}`);
    }
    return {
      claim_key: claim.claimKey,
      person_id: claim.personId,
      claim_type: claim.claimType,
      claim_value: claim.claimValue,
      claim_json: {
        ...claim.claimJson,
        verificationPolicy: {
          version: scoringVersion,
          status: 'verified_from_direct_independent_source',
          publicationStillRequired: true,
        },
        publicationGate: {
          status: 'verified_not_published',
          requiresHumanApproval: false,
        },
      },
      confidence_level: claim.confidenceLevel,
      review_status: 'verified',
      visibility: 'review_only',
      source_name: claim.sourceName,
      source_url: claim.sourceUrl,
      is_public: false,
      review_score: claim.confidenceLevel === 'A' ? 100 : 85,
      scoring_version: scoringVersion,
      scoring_reasons: [{
        version: scoringVersion,
        reason: claim.confidenceLevel === 'A'
          ? 'unique person match and direct official family-relationship source'
          : 'unique person match and direct trusted family-relationship source',
        reviewedAt,
      }],
      auto_reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    };
  });
  const keys = new Set(rows.map((row) => row.claim_key));
  if (keys.size !== rows.length) throw new Error('Preview contains duplicate claim keys');
  return rows;
}

export function summarizeReviewedFamilyClaimRows(rows) {
  return {
    total: rows.length,
    confidenceA: rows.filter((row) => row.confidence_level === 'A').length,
    confidenceB: rows.filter((row) => row.confidence_level === 'B').length,
    verified: rows.filter((row) => row.review_status === 'verified').length,
    reviewOnly: rows.filter((row) => row.visibility === 'review_only').length,
    public: rows.filter((row) => row.is_public === true).length,
  };
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

function headers(config, prefer) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {}),
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${label}: ${body?.message ?? response.statusText}`);
  return body;
}

function quotePostgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function fetchRowsByClaimKeys(config, claimKeys) {
  const rows = [];
  for (let index = 0; index < claimKeys.length; index += 80) {
    const chunk = claimKeys.slice(index, index + 80);
    const url = restUrl(config, 'person_claims');
    url.searchParams.set('select', 'claim_key,person_id,claim_type,confidence_level,review_status,visibility,is_public,scoring_version');
    url.searchParams.set('claim_key', `in.(${chunk.map(quotePostgrestValue).join(',')})`);
    const response = await fetch(url, {
      headers: headers(config),
      signal: AbortSignal.timeout(30000),
    });
    rows.push(...await responseJson(response, 'Failed to fetch family claims'));
  }
  return rows;
}

async function upsertRows(config, rows) {
  for (let index = 0; index < rows.length; index += 80) {
    const url = restUrl(config, 'person_claims');
    url.searchParams.set('on_conflict', 'claim_key');
    const response = await fetch(url, {
      method: 'POST',
      headers: headers(config, 'resolution=merge-duplicates,return=minimal'),
      body: JSON.stringify(rows.slice(index, index + 80)),
      signal: AbortSignal.timeout(30000),
    });
    await responseJson(response, 'Failed to upsert family claims');
  }
}

function validateExistingConflicts(existing, plannedRows) {
  const plannedByKey = new Map(plannedRows.map((row) => [row.claim_key, row]));
  for (const row of existing) {
    const planned = plannedByKey.get(row.claim_key);
    if (!planned || row.person_id !== planned.person_id || row.claim_type !== planned.claim_type) {
      throw new Error(`Existing claim conflicts with preview: ${row.claim_key}`);
    }
  }
}

function verifyWrittenRows(written, plannedRows) {
  const expectedKeys = new Set(plannedRows.map((row) => row.claim_key));
  const actualKeys = new Set(written.map((row) => row.claim_key));
  if (actualKeys.size !== expectedKeys.size || [...expectedKeys].some((key) => !actualKeys.has(key))) {
    throw new Error(`Expected ${expectedKeys.size} written claims, found ${actualKeys.size}`);
  }
  const invalid = written.filter((row) => (
    !['A', 'B'].includes(row.confidence_level)
    || row.review_status !== 'verified'
    || row.visibility !== 'review_only'
    || row.is_public !== false
    || row.scoring_version !== scoringVersion
  ));
  if (invalid.length > 0) throw new Error(`Written claim verification failed for ${invalid.length} rows`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const preview = JSON.parse(fs.readFileSync(options.previewPath, 'utf8'));
  const reviewedAt = new Date().toISOString();
  const rows = buildReviewedFamilyClaimRows(preview, reviewedAt);
  const summary = summarizeReviewedFamilyClaimRows(rows);
  if (options.expectedCount != null && rows.length !== options.expectedCount) {
    throw new Error(`Expected ${options.expectedCount} claims, preview contains ${rows.length}`);
  }
  if (!options.apply) {
    console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2));
    return;
  }

  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('This command only writes to local Supabase');
  }

  const existing = await fetchRowsByClaimKeys(config, rows.map((row) => row.claim_key));
  validateExistingConflicts(existing, rows);
  await upsertRows(config, rows);
  const written = await fetchRowsByClaimKeys(config, rows.map((row) => row.claim_key));
  verifyWrittenRows(written, rows);
  console.log(JSON.stringify({
    mode: 'applied-local',
    existingBefore: existing.length,
    ...summarizeReviewedFamilyClaimRows(written),
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
