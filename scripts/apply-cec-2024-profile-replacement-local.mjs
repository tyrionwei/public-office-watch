import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regionalSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-bulletin-profile-claims.seed.json');
const partyListSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-party-list-bulletin-profile-claims.seed.json');
const officialProfileSeedPath = path.join(repoRoot, 'data-sources', 'cec-2024-person-profile-claims.seed.json');
const reportPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2024-profile-local-apply.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, '')];
      }),
  );
}

function parseArgs(argv) {
  const supported = new Set(['--write']);
  for (const arg of argv) if (!supported.has(arg)) throw new Error(`Unsupported argument: ${arg}`);
  return { write: argv.includes('--write') };
}

function chunks(values, size = 40) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function restHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'accept-profile': 'public',
    'content-profile': 'public',
    ...extra,
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${label}: ${body?.message ?? response.statusText}`);
  return body;
}

async function fetchRows(config, table, select, personIds) {
  const rows = [];
  for (const batch of chunks(personIds)) {
    const url = new URL(`${config.url}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    url.searchParams.set('person_id', `in.(${batch.join(',')})`);
    const body = await responseJson(await fetch(url, {
      headers: restHeaders(config.key),
      signal: AbortSignal.timeout(30000),
    }), `Fetch ${table}`);
    rows.push(...body);
  }
  return rows;
}

async function fetchPeople(config, personIds) {
  const rows = [];
  for (const batch of chunks(personIds)) {
    const url = new URL(`${config.url}/rest/v1/people`);
    url.searchParams.set('select', 'id,name,party,gender,education,experience,source_url,is_public');
    url.searchParams.set('id', `in.(${batch.join(',')})`);
    const body = await responseJson(await fetch(url, {
      headers: restHeaders(config.key),
      signal: AbortSignal.timeout(30000),
    }), 'Fetch people');
    rows.push(...body);
  }
  return rows;
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\s;；、，。]+/gu, '').replaceAll('臺', '台').toLowerCase();
}

function normalizeParty(value) {
  return normalizeText(value).replace('民主進步黨', '民進黨').replace('中國國民黨', '國民黨').replace('台灣民眾黨', '民眾黨');
}
function basicValuesCompatible(claimType, left, right) { const a = String(left ?? '').trim(); const b = String(right ?? '').trim(); if (normalizeText(a) === normalizeText(b)) return true; return claimType === 'birth_date' && a.slice(0, 4) === b.slice(0, 4) && (a.length === 4 || b.length === 4 || a.includes('-00') || b.includes('-00')); }

function incomingRow(claim) {
  return {
    claim_key: claim.claimKey,
    person_id: claim.personId,
    source_person_id: null,
    claim_type: claim.claimType,
    claim_value: claim.claimValue,
    claim_json: claim.claimJson,
    confidence_level: claim.confidenceLevel,
    review_status: claim.reviewStatus,
    visibility: claim.visibility,
    source_name: claim.sourceName,
    source_url: claim.sourceUrl,
    observed_at: claim.observedAt,
    is_public: claim.visibility === 'public' && claim.reviewStatus === 'verified',
    review_score: 100,
    scoring_version: 'cec-2024-official-bulletin-profile-v1',
    scoring_reasons: [{ version: 'cec-2024-official-bulletin-profile-v1', reason: 'Exact person and election context matched to an official CEC bulletin.' }],
    auto_reviewed_at: new Date().toISOString(),
    candidate_id: claim.claimJson?.candidateId ?? null,
  };
}

function snapshotRow(person, claimType, oldValue, replacementClaimKey) {
  const digest = crypto.createHash('sha256').update(`${person.id}:${claimType}:${oldValue}`).digest('hex').slice(0, 16);
  return {
    claim_key: `audit:pre-cec-2024-canonical:${digest}`,
    person_id: person.id,
    source_person_id: null,
    claim_type: claimType,
    claim_value: oldValue,
    claim_json: {
      value: oldValue,
      auditSnapshot: true,
      snapshotReason: 'Preserved before replacing the public canonical field with the official 2024 CEC bulletin profile.',
      supersededBy: replacementClaimKey,
    },
    confidence_level: 'D',
    review_status: 'archived',
    visibility: 'private',
    source_name: 'Public Office Watch 本機資料覆蓋前快照',
    source_url: person.source_url,
    observed_at: new Date().toISOString(),
    is_public: false,
    review_score: 0,
    scoring_version: 'cec-2024-profile-replacement-audit-v1',
    scoring_reasons: [],
    auto_reviewed_at: null,
    candidate_id: null,
  };
}

async function upsertClaims(config, rows) {
  for (const batch of chunks(rows, 100)) {
    const url = new URL(`${config.url}/rest/v1/person_claims`);
    url.searchParams.set('on_conflict', 'claim_key');
    await responseJson(await fetch(url, {
      method: 'POST',
      headers: restHeaders(config.key, { prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(30000),
    }), 'Upsert person claims');
  }
}

async function patchClaim(config, claim, replacementClaimKey, reason) {
  const url = new URL(`${config.url}/rest/v1/person_claims`);
  url.searchParams.set('id', `eq.${claim.id}`);
  await responseJson(await fetch(url, {
    method: 'PATCH',
    headers: restHeaders(config.key, { prefer: 'return=minimal' }),
    body: JSON.stringify({
      review_status: 'archived',
      visibility: 'private',
      is_public: false,
      claim_json: { ...claim.claim_json, supersededBy: replacementClaimKey, supersededReason: reason },
      updated_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(30000),
  }), `Archive claim ${claim.claim_key}`);
}

async function patchPerson(config, personId, fields) {
  const url = new URL(`${config.url}/rest/v1/people`);
  url.searchParams.set('id', `eq.${personId}`);
  await responseJson(await fetch(url, {
    method: 'PATCH',
    headers: restHeaders(config.key, { prefer: 'return=minimal' }),
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(30000),
  }), `Update person ${personId}`);
}

function mainProfileClaims() {
  const regional = JSON.parse(fs.readFileSync(regionalSeedPath, 'utf8'));
  const partyList = JSON.parse(fs.readFileSync(partyListSeedPath, 'utf8'));
  return [...regional.personClaims, ...partyList.personClaims];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = readLocalEnv();
  const config = {
    url: String(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(/\/$/u, ''),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
  };
  if (!config.url || !config.key) throw new Error('Local Supabase URL and service-role key are required in .env.local');
  const hostname = new URL(config.url).hostname;
  if (!localHostnames.has(hostname)) throw new Error(`Refused non-local Supabase host: ${hostname}`);

  const profileClaims = mainProfileClaims();
  const incomingKeys = new Set(profileClaims.map((claim) => claim.claimKey));
  const personIds = Array.from(new Set(profileClaims.map((claim) => claim.personId)));
  if (personIds.length !== 113) throw new Error(`Expected 113 profile targets, found ${personIds.length}`);
  const [people, currentClaims] = await Promise.all([
    fetchPeople(config, personIds),
    fetchRows(config, 'person_claims', 'id,claim_key,person_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,is_public,candidate_id', personIds),
  ]);
  if (people.length !== personIds.length) throw new Error(`Expected ${personIds.length} local people, found ${people.length}`);

  const claimsByPerson = new Map();
  for (const claim of profileClaims) {
    if (!claimsByPerson.has(claim.personId)) claimsByPerson.set(claim.personId, new Map());
    claimsByPerson.get(claim.personId).set(claim.claimType, claim);
  }
  const replacedPublicClaims = currentClaims.filter((claim) =>
    ['education', 'experience'].includes(claim.claim_type)
    && !incomingKeys.has(claim.claim_key)
    && (claim.is_public || claim.visibility === 'public'));
  const canonicalChanges = [];
  const snapshots = [];
  for (const person of people) {
    const incoming = claimsByPerson.get(person.id);
    const nextEducation = incoming.get('education')?.claimValue;
    const nextExperience = incoming.get('experience')?.claimValue;
    const changedFields = {};
    if (nextEducation !== undefined && normalizeText(person.education) !== normalizeText(nextEducation)) {
      if (person.education?.trim() && !currentClaims.some((claim) => claim.person_id === person.id && claim.claim_key === incoming.get('education')?.claimKey)) snapshots.push(snapshotRow(person, 'education', person.education, incoming.get('education')?.claimKey ?? null));
      changedFields.education = nextEducation;
    }
    if (nextExperience !== undefined && normalizeText(person.experience) !== normalizeText(nextExperience)) {
      if (person.experience?.trim() && !currentClaims.some((claim) => claim.person_id === person.id && claim.claim_key === incoming.get('experience')?.claimKey)) snapshots.push(snapshotRow(person, 'experience', person.experience, incoming.get('experience')?.claimKey ?? null));
      changedFields.experience = nextExperience;
    }
    if (Object.keys(changedFields).length > 0) canonicalChanges.push({ personId: person.id, personName: person.name, fields: changedFields });
  }

  const officialSeed = JSON.parse(fs.readFileSync(officialProfileSeedPath, 'utf8'));
  const officialBasicClaims = officialSeed.personClaims.filter((claim) =>
    personIds.includes(claim.personId) && ['birth_date', 'gender'].includes(claim.claimType));
  const officialBasicKeys = new Set(officialBasicClaims.map((claim) => claim.claimKey));
  const basicByPersonType = new Map(officialBasicClaims.map((claim) => [`${claim.personId}:${claim.claimType}`, claim]));
  const duplicateBasicClaims = [];
  const conflictingBasicClaims = [];
  for (const claim of currentClaims.filter((item) => ['birth_date', 'gender'].includes(item.claim_type) && !officialBasicKeys.has(item.claim_key))) {
    const official = basicByPersonType.get(`${claim.person_id}:${claim.claim_type}`);
    if (!official) continue;
    if (basicValuesCompatible(claim.claim_type, claim.claim_value, official.claimValue)) {
      if (claim.is_public || claim.visibility === 'public') duplicateBasicClaims.push({ claim, official });
    } else if (claim.is_public || claim.visibility === 'public') {
      conflictingBasicClaims.push({
        personId: claim.person_id,
        claimType: claim.claim_type,
        existingValue: claim.claim_value,
        officialValue: official.claimValue,
        existingSource: claim.source_name,
      });
    }
  }
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const partyComparisons = profileClaims
    .filter((claim) => claim.claimJson?.party)
    .filter((claim, index, claims) => claims.findIndex((item) => item.personId === claim.personId) === index)
    .map((claim) => ({
      personId: claim.personId,
      personName: claim.personName,
      electionParty: claim.claimJson.party,
      currentParty: peopleById.get(claim.personId)?.party ?? null,
      same: normalizeParty(claim.claimJson.party) === normalizeParty(peopleById.get(claim.personId)?.party),
    }));

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: args.write ? 'local-write' : 'dry-run',
    localSupabaseHost: hostname,
    summary: {
      targetPeople: personIds.length,
      officialProfileClaims: profileClaims.length,
      canonicalPeopleChanged: canonicalChanges.length,
      priorCanonicalSnapshots: snapshots.length,
      priorPublicProfileClaimsArchived: replacedPublicClaims.length,
      officialBasicClaimsConsidered: officialBasicClaims.length,
      exactBasicDuplicatesArchived: duplicateBasicClaims.length,
      basicConflictsLeftForReview: conflictingBasicClaims.length,
      electionPartyComparisons: partyComparisons.length,
      electionPartyDifferencesNotOverwritten: partyComparisons.filter((item) => !item.same).length,
    },
    conflictingBasicClaims,
    partyDifferences: partyComparisons.filter((item) => !item.same),
    canonicalChanges: canonicalChanges.map(({ personId, personName, fields }) => ({ personId, personName, changedFields: Object.keys(fields) })),
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (!args.write) return;

  await upsertClaims(config, profileClaims.map(incomingRow));
  await upsertClaims(config, officialBasicClaims.map(incomingRow));
  await upsertClaims(config, snapshots);
  for (const claim of replacedPublicClaims) {
    const replacement = claimsByPerson.get(claim.person_id)?.get(claim.claim_type)?.claimKey ?? null;
    await patchClaim(config, claim, replacement, 'Superseded by the official 2024 CEC election bulletin profile.');
  }
  for (const { claim, official } of duplicateBasicClaims) {
    await patchClaim(config, claim, official.claimKey, 'Exact duplicate of the official 2024 CEC candidate field.');
  }
  for (const change of canonicalChanges) await patchPerson(config, change.personId, change.fields);
  console.log('Local CEC 2024 profile replacement completed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
