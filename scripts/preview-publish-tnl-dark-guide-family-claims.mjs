import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'local-data', 'tnl-dark-guide-family-release-preview.json');
const claimKeyPrefix = 'research:tnl-dark-guide-family:';
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

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
  const options = { expectedCount: null, outputPath: defaultOutputPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--expected-count') options.expectedCount = Number(argv[++index]);
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
}

function publicFactKeys(claim) {
  const relationType = claim.claim_json?.relationType ?? '';
  const relativePersonId = claim.claim_json?.relativePersonId ?? '';
  return [
    `${claim.person_id}|value:${normalizedText(claim.claim_value)}`,
    ...(relationType && relativePersonId ? [`${claim.person_id}|${relationType}|id:${relativePersonId}`] : []),
  ];
}

export function buildFamilyReleasePreview({ claims, people, publicFamilyClaims }) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const existingPublicKeys = new Set(publicFamilyClaims.flatMap(publicFactKeys));
  const eligibleClaims = [];
  const blockedClaims = [];

  for (const claim of claims.sort((left, right) => left.claim_key.localeCompare(right.claim_key))) {
    const person = peopleById.get(claim.person_id);
    const relativePersonId = claim.claim_json?.relativePersonId;
    const relative = peopleById.get(relativePersonId);
    const expectedValue = claim.claim_json?.relationLabel && relative?.name
      ? `${claim.claim_json.relationLabel}：${relative.name}`
      : null;
    let reason = null;
    if (!claim.claim_key.startsWith(claimKeyPrefix)) reason = 'unexpected_claim_key';
    else if (claim.claim_type !== 'family_relation') reason = 'unexpected_claim_type';
    else if (claim.review_status !== 'verified') reason = 'not_verified';
    else if (claim.visibility !== 'review_only' || claim.is_public !== false) reason = 'already_or_unexpectedly_public';
    else if (!['A', 'B'].includes(claim.confidence_level) || Number(claim.review_score) < 70) reason = 'confidence_below_public_threshold';
    else if (!person?.is_public) reason = 'primary_person_not_public';
    else if (!relativePersonId || !relative?.is_public) reason = 'relative_person_not_public';
    else if (!expectedValue || normalizedText(claim.claim_value) !== normalizedText(expectedValue)) reason = 'display_value_mismatch';
    else if (!/^https:\/\//u.test(claim.source_url ?? '')) reason = 'source_url_missing_or_not_https';
    else if (publicFactKeys(claim).some((key) => existingPublicKeys.has(key))) reason = 'already_public_duplicate';

    if (reason) {
      blockedClaims.push({ claimKey: claim.claim_key, reason });
      continue;
    }
    eligibleClaims.push({
      claimId: claim.id,
      claimKey: claim.claim_key,
      personId: claim.person_id,
      personName: person.name,
      claimValue: claim.claim_value,
      relativePersonId,
      relativePersonName: relative.name,
      confidenceLevel: claim.confidence_level,
      reviewScore: Number(claim.review_score),
      sourceName: claim.source_name,
      sourceUrl: claim.source_url,
      publicationUpdate: { visibility: 'public', is_public: true },
    });
  }

  const claimsPerPerson = eligibleClaims.reduce((counts, claim) => {
    counts.set(claim.personId, (counts.get(claim.personId) ?? 0) + 1);
    return counts;
  }, new Map());
  const blockedReasonCounts = Object.fromEntries(
    [...blockedClaims.reduce((counts, claim) => counts.set(claim.reason, (counts.get(claim.reason) ?? 0) + 1), new Map())]
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const payload = {
    policy: {
      databaseWrites: false,
      productionWrites: false,
      publishOnlyExistingVerifiedClaims: true,
    },
    summary: {
      reviewedClaims: claims.length,
      eligibleClaims: eligibleClaims.length,
      blockedClaims: blockedClaims.length,
      confidenceA: eligibleClaims.filter((claim) => claim.confidenceLevel === 'A').length,
      confidenceB: eligibleClaims.filter((claim) => claim.confidenceLevel === 'B').length,
      distinctPeople: claimsPerPerson.size,
      maxClaimsPerPerson: Math.max(0, ...claimsPerPerson.values()),
      alreadyPublicCompared: publicFamilyClaims.length,
      blockedReasonCounts,
    },
    eligibleClaims,
    blockedClaims,
  };
  return {
    ...payload,
    summary: {
      ...payload.summary,
      estimatedReleasePreviewBytes: Buffer.byteLength(JSON.stringify(payload), 'utf8'),
    },
  };
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < 1000) return rows;
  }
}

function quotePostgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function fetchPeopleByIds(config, personIds) {
  const ids = [...new Set(personIds.filter(Boolean))];
  const rows = [];
  for (let index = 0; index < ids.length; index += 80) {
    rows.push(...await fetchRows(config, 'people', 'id,name,is_public', {
      id: `in.(${ids.slice(index, index + 80).map(quotePostgrestValue).join(',')})`,
    }));
  }
  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('This preview only reads local Supabase');
  }

  const claims = await fetchRows(
    config,
    'person_claims',
    'id,claim_key,person_id,claim_type,claim_value,claim_json,confidence_level,review_score,review_status,visibility,is_public,source_name,source_url',
    { claim_key: `like.${claimKeyPrefix}*`, order: 'claim_key.asc' },
  );
  if (options.expectedCount != null && claims.length !== options.expectedCount) {
    throw new Error(`Expected ${options.expectedCount} local claims, found ${claims.length}`);
  }
  const publicFamilyClaims = await fetchRows(
    config,
    'person_claims',
    'id,claim_key,person_id,claim_type,claim_value,claim_json,confidence_level,review_score,review_status,visibility,is_public,source_name,source_url',
    { claim_type: 'eq.family_relation', review_status: 'eq.verified', visibility: 'eq.public', is_public: 'eq.true' },
  );
  const people = await fetchPeopleByIds(config, [
    ...claims.map((claim) => claim.person_id),
    ...claims.map((claim) => claim.claim_json?.relativePersonId),
  ]);
  const preview = buildFamilyReleasePreview({ claims, people, publicFamilyClaims });
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(repoRoot, options.outputPath), ...preview.summary }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
