import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'missing-person-external-ids-report.json');

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
    outputPath: defaultOutputPath,
    limit: 100000,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      options.limit = Number.parseInt(argv[index + 1] ?? '', 10);
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

async function fetchRows(viewName, select, options) {
  const pageSize = 1000;
  const rows = [];

  while (rows.length < options.limit) {
    const pageStart = rows.length;
    const pageEnd = Math.min(pageStart + pageSize - 1, options.limit - 1);
    const url = restUrl(viewName);
    url.searchParams.set('select', select);

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        range: `${pageStart}-${pageEnd}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch ${viewName}: ${body?.message ?? response.statusText}`);
    }

    if (!Array.isArray(body) || body.length === 0) {
      break;
    }

    rows.push(...body);

    if (body.length < pageSize) {
      break;
    }
  }

  return rows;
}

function isExternalIdClaim(claim) {
  return claim.claim_type === 'external_id';
}

function externalIdValuesFor(claim) {
  if (!isExternalIdClaim(claim)) {
    return [];
  }

  const wikidataQid = typeof claim.claim_json?.wikidataQid === 'string' ? `wikidata:${claim.claim_json.wikidataQid}` : null;
  return [claim.claim_value, wikidataQid].filter(Boolean);
}

function isPublicClaim(claim) {
  return claim.review_status === 'verified' && claim.visibility === 'public' && claim.is_public === true;
}

function groupBy(items, keyFor) {
  const groups = new Map();

  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function publicExternalIdsFor(personId, claimsByPersonId) {
  return (claimsByPersonId.get(personId) ?? [])
    .filter(isExternalIdClaim)
    .filter(isPublicClaim)
    .flatMap(externalIdValuesFor);
}

function allExternalClaimsFor(personId, claimsByPersonId) {
  return (claimsByPersonId.get(personId) ?? [])
    .filter(isExternalIdClaim)
    .map((claim) => ({
      claimId: claim.id,
      claimValue: claim.claim_value,
      wikidataQid: claim.claim_json?.wikidataQid ?? null,
      reviewStatus: claim.review_status,
      visibility: claim.visibility,
      isPublic: claim.is_public,
      sourceName: claim.source_name,
      sourceUrl: claim.source_url,
    }));
}

function personSummary(person) {
  return {
    personId: person.person_id,
    name: person.name,
    gender: person.gender,
    party: person.party,
    position: person.position,
    district: person.district,
    electionYear: person.election_year,
  };
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for missing external ID report.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [people, allClaims, publicClaims, mergeDecisions] = await Promise.all([
    fetchRows('public_people', 'person_id,name,gender,party,position,election_year,district', options),
    fetchRows('person_claims', 'id,person_id,claim_type,claim_value,claim_json,review_status,visibility,is_public,source_name,source_url', options),
    fetchRows('public_person_claims', 'claim_id,person_id,claim_type,claim_value,claim_json,source_name,source_url', options),
    fetchRows('person_merge_decisions', 'duplicate_person_id,canonical_person_id,status', options),
  ]);
  const allClaimsByPersonId = groupBy(allClaims, (claim) => claim.person_id);
  const publicClaimsByPersonId = groupBy(
    publicClaims
      .filter((claim) => claim.claim_type === 'external_id')
      .map((claim) => ({
        ...claim,
        id: claim.claim_id,
        review_status: 'verified',
        visibility: 'public',
        is_public: true,
      })),
    (claim) => claim.person_id,
  );
  const duplicateIdsByCanonicalId = new Map();

  for (const decision of mergeDecisions) {
    if (decision.status !== 'verified') continue;
    duplicateIdsByCanonicalId.set(decision.canonical_person_id, [
      ...(duplicateIdsByCanonicalId.get(decision.canonical_person_id) ?? []),
      decision.duplicate_person_id,
    ]);
  }

  const hasAnyPublicExternalId = (personId) =>
    publicExternalIdsFor(personId, publicClaimsByPersonId).length > 0 ||
    allExternalClaimsFor(personId, allClaimsByPersonId).some((claim) =>
      claim.reviewStatus === 'verified' && claim.visibility === 'public' && claim.isPublic === true,
    );
  const missingPeople = people.filter((person) => !hasAnyPublicExternalId(person.person_id));
  const classified = missingPeople.map((person) => {
    const ownExternalClaims = allExternalClaimsFor(person.person_id, allClaimsByPersonId);
    const duplicateExternalClaims = (duplicateIdsByCanonicalId.get(person.person_id) ?? [])
      .flatMap((duplicatePersonId) => allExternalClaimsFor(duplicatePersonId, allClaimsByPersonId).map((claim) => ({
        ...claim,
        duplicatePersonId,
      })));

    if (ownExternalClaims.length === 0 && duplicateExternalClaims.length === 0) {
      return {
        category: 'A_no_external_id_claim',
        person: personSummary(person),
        ownExternalClaims,
        duplicateExternalClaims,
      };
    }

    if (ownExternalClaims.some((claim) => claim.reviewStatus !== 'verified' || claim.visibility !== 'public' || claim.isPublic !== true)) {
      return {
        category: 'B_external_id_claim_not_public',
        person: personSummary(person),
        ownExternalClaims,
        duplicateExternalClaims,
      };
    }

    if (duplicateExternalClaims.length > 0) {
      return {
        category: 'C_external_id_on_merged_duplicate',
        person: personSummary(person),
        ownExternalClaims,
        duplicateExternalClaims,
      };
    }

    return {
      category: 'D_unknown_pipeline_gap',
      person: personSummary(person),
      ownExternalClaims,
      duplicateExternalClaims,
    };
  });
  const byCategory = Object.fromEntries(
    Array.from(groupBy(classified, (item) => item.category).entries()).map(([category, records]) => [category, records.length]),
  );
  const wikidataRetryTargets = classified
    .filter((item) => item.category === 'A_no_external_id_claim')
    .map((item) => ({
      personId: item.person.personId,
      name: item.person.name,
      gender: item.person.gender,
      party: item.person.party,
      position: item.person.position,
      district: item.person.district,
    }));
  const report = {
    generatedAt: new Date().toISOString(),
    totalPublicPeople: people.length,
    missingPublicExternalId: classified.length,
    byCategory,
    wikidataRetryTargets,
    records: classified,
  };
  const content = `${JSON.stringify(report, null, 2)}\n`;

  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, content);
    console.log(`Wrote missing external ID report: ${path.relative(repoRoot, options.outputPath)}`);
    return;
  }

  console.log(content);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`missing external ID report failed: ${message}`);
  process.exit(1);
});
