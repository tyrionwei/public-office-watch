import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSeedPath = path.join(repoRoot, 'data-sources', 'cec-2022-councilor-bulletin-profile-claims.seed.json');
const defaultReportPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'profile-local-apply.json');
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
  const options = { write: false, seedPath: defaultSeedPath, reportPath: defaultReportPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--seed') options.seedPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--report') options.reportPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!fs.existsSync(options.seedPath)) {
    throw new Error(`Seed not found: ${options.seedPath}`);
  }
  return options;
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
  for (const batch of chunks(personIds, 10)) {
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
  return normalizeText(value)
    .replace('民主進步黨', '民進黨')
    .replace('中國國民黨', '國民黨')
    .replace('台灣民眾黨', '民眾黨')
    .replace('台灣團結聯盟', '台聯黨')
    .replace('無黨籍', '無');
}

function basicValuesCompatible(claimType, left, right, sourceName = '') {
  const a = String(left ?? '').trim();
  const b = String(right ?? '').trim();
  if (normalizeText(a) === normalizeText(b)) return true;
  if (claimType === 'gender') {
    const normalizeGender = (value) => ({ male: 'male', '男': 'male', '男性': 'male', female: 'female', '女': 'female', '女性': 'female' })[normalizeText(value)] ?? normalizeText(value);
    return normalizeGender(a) === normalizeGender(b);
  }
  if (claimType !== 'birth_date' || a.slice(0, 4) !== b.slice(0, 4)) return false;
  if (a.length === 4 || b.length === 4 || a.includes('-00') || b.includes('-00')) return true;
  return sourceName === 'Wikidata 人物補充資料' && (a.endsWith('-01-01') || b.endsWith('-01-01'));
}

function isPublicClaim(claim) {
  return claim.is_public || claim.visibility === 'public';
}

function isNewerOfficialProfileClaim(claim) {
  return ['education', 'experience'].includes(claim.claim_type)
    && claim.claim_json?.profileSource === 'cec_election_bulletin'
    && Number(claim.claim_json?.electionYear) > 2022
    && isPublicClaim(claim);
}

function canonicalPersonId(personId, canonicalByPersonId) {
  return canonicalByPersonId.get(personId) ?? personId;
}

function personTypeKey(personId, claimType, canonicalByPersonId) {
  return `${canonicalPersonId(personId, canonicalByPersonId)}:${claimType}`;
}

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
    scoring_version: 'cec-2022-official-councilor-bulletin-profile-v1',
    scoring_reasons: [{ version: 'cec-2022-official-councilor-bulletin-profile-v1', reason: 'Exact person and election context matched to an official CEC bulletin and passed local layout QA.' }],
    auto_reviewed_at: new Date().toISOString(),
    candidate_id: claim.claimJson?.candidateId ?? null,
  };
}

function snapshotRow(person, claimType, oldValue, replacementClaimKey) {
  const digest = crypto.createHash('sha256').update(`${person.id}:${claimType}:${oldValue}`).digest('hex').slice(0, 16);
  return {
    claim_key: `audit:pre-cec-2022-councilor-canonical:${digest}`,
    person_id: person.id,
    source_person_id: null,
    claim_type: claimType,
    claim_value: oldValue,
    claim_json: {
      value: oldValue,
      auditSnapshot: true,
      snapshotReason: 'Preserved before replacing the local canonical field with the official 2022 CEC councilor bulletin profile.',
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
    scoring_version: 'cec-2022-councilor-profile-replacement-audit-v1',
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

  const seed = JSON.parse(fs.readFileSync(args.seedPath, 'utf8'));
  const incomingClaims = seed.personClaims;
  const personIds = Array.from(new Set(incomingClaims.map((claim) => claim.personId)));
  const expectedPersonCount = seed.summary.selectedPersonCount ?? seed.summary.safeExtractedCount;
  if (personIds.length !== expectedPersonCount) {
    throw new Error(`Seed target mismatch: expected ${expectedPersonCount}, found ${personIds.length}`);
  }
  const canonicalRows = await fetchRows(config, 'person_canonical_map', 'person_id,canonical_person_id', personIds);
  const canonicalByPersonId = new Map(canonicalRows.map((row) => [row.person_id, row.canonical_person_id]));
  const canonicalPersonIds = Array.from(new Set(personIds.map((personId) => canonicalPersonId(personId, canonicalByPersonId))));
  const claimPersonIds = Array.from(new Set([...personIds, ...canonicalPersonIds]));
  const [people, currentClaims] = await Promise.all([
    fetchPeople(config, canonicalPersonIds),
    fetchRows(config, 'person_claims', 'id,claim_key,person_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,is_public,candidate_id', claimPersonIds),
  ]);
  if (people.length !== canonicalPersonIds.length) throw new Error(`Expected ${canonicalPersonIds.length} canonical local people, found ${people.length}`);

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const currentByPerson = new Map();
  for (const claim of currentClaims) {
    const canonicalId = canonicalPersonId(claim.person_id, canonicalByPersonId);
    if (!currentByPerson.has(canonicalId)) currentByPerson.set(canonicalId, []);
    currentByPerson.get(canonicalId).push(claim);
  }
  const incomingByPersonType = new Map(incomingClaims.map((claim) => [personTypeKey(claim.personId, claim.claimType, canonicalByPersonId), claim]));
  const profileClaims = incomingClaims.filter((claim) => ['education', 'experience'].includes(claim.claimType));
  const basicClaims = incomingClaims.filter((claim) => ['birth_date', 'gender'].includes(claim.claimType));

  const newerProtected = [];
  const newerByPersonType = new Map();
  const acceptedProfileClaims = [];
  for (const claim of profileClaims) {
    const canonicalId = canonicalPersonId(claim.personId, canonicalByPersonId);
    const newer = (currentByPerson.get(canonicalId) ?? [])
      .find((current) => current.claim_type === claim.claimType && isNewerOfficialProfileClaim(current));
    if (newer) {
      newerByPersonType.set(`${canonicalId}:${claim.claimType}`, newer);
      newerProtected.push({
        personId: claim.personId,
        personName: claim.personName,
        claimType: claim.claimType,
        newerClaimKey: newer.claim_key,
        newerElectionYear: newer.claim_json?.electionYear,
      });
    } else acceptedProfileClaims.push(claim);
  }

  const acceptedBasicClaims = [];
  const duplicateBasicClaims = [];
  const conflictingBasicClaims = [];
  for (const claim of basicClaims) {
    const canonicalId = canonicalPersonId(claim.personId, canonicalByPersonId);
    const current = (currentByPerson.get(canonicalId) ?? [])
      .filter((item) => item.claim_type === claim.claimType && item.claim_key !== claim.claimKey && isPublicClaim(item));
    const incompatible = current.filter((item) => !basicValuesCompatible(claim.claimType, item.claim_value, claim.claimValue, item.source_name));
    if (incompatible.length) {
      conflictingBasicClaims.push({
        personId: claim.personId,
        personName: claim.personName,
        claimType: claim.claimType,
        officialValue: claim.claimValue,
        existing: incompatible.map((item) => ({ value: item.claim_value, source: item.source_name, claimKey: item.claim_key })),
      });
      continue;
    }
    acceptedBasicClaims.push(claim);
    for (const duplicate of current) duplicateBasicClaims.push({ claim: duplicate, official: claim });
  }

  const acceptedProfileKeys = new Set(acceptedProfileClaims.map((claim) => claim.claimKey));
  const protectedIncomingKeys = new Set(profileClaims.filter((claim) => !acceptedProfileKeys.has(claim.claimKey)).map((claim) => claim.claimKey));
  const staleProtectedProfileClaims = currentClaims.filter((claim) => protectedIncomingKeys.has(claim.claim_key) && isPublicClaim(claim));
  const replacedPublicClaims = currentClaims.filter((claim) => {
    if (!['education', 'experience'].includes(claim.claim_type) || !isPublicClaim(claim) || acceptedProfileKeys.has(claim.claim_key)) return false;
    if (isNewerOfficialProfileClaim(claim)) return false;
    const key = personTypeKey(claim.person_id, claim.claim_type, canonicalByPersonId);
    return incomingByPersonType.has(key)
      && acceptedProfileClaims.some((incoming) => personTypeKey(incoming.personId, incoming.claimType, canonicalByPersonId) === key);
  });

  const acceptedProfileByPersonType = new Map(acceptedProfileClaims.map((claim) => [personTypeKey(claim.personId, claim.claimType, canonicalByPersonId), claim]));
  const canonicalChanges = [];
  const snapshots = [];
  const newerCanonicalRestorations = [];
  for (const person of people) {
    const fields = {};
    for (const claimType of ['education', 'experience']) {
      const key = `${person.id}:${claimType}`;
      const newer = newerByPersonType.get(key);
      const incoming = acceptedProfileByPersonType.get(key);
      const desiredValue = newer?.claim_value ?? incoming?.claimValue;
      const desiredClaimKey = newer?.claim_key ?? incoming?.claimKey;
      if (desiredValue == null) continue;
      const oldValue = person[claimType];
      if (normalizeText(oldValue) === normalizeText(desiredValue)) continue;
      if (newer) newerCanonicalRestorations.push({ personId: person.id, personName: person.name, claimType, newerClaimKey: newer.claim_key });
      else if (oldValue?.trim()) snapshots.push(snapshotRow(person, claimType, oldValue, desiredClaimKey));
      fields[claimType] = desiredValue;
    }
    if (Object.keys(fields).length) canonicalChanges.push({ personId: person.id, personName: person.name, fields });
  }

  const partyComparisons = incomingClaims
    .filter((claim) => claim.claimJson?.electionParty)
    .filter((claim, index, claims) => claims.findIndex((item) => canonicalPersonId(item.personId, canonicalByPersonId) === canonicalPersonId(claim.personId, canonicalByPersonId)) === index)
    .map((claim) => ({
      personId: canonicalPersonId(claim.personId, canonicalByPersonId),
      personName: claim.personName,
      electionParty: claim.claimJson.electionParty,
      currentParty: peopleById.get(canonicalPersonId(claim.personId, canonicalByPersonId))?.party ?? null,
      same: normalizeParty(claim.claimJson.electionParty) === normalizeParty(peopleById.get(claim.personId)?.party),
    }));

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: args.write ? 'local-write' : 'dry-run',
    localSupabaseHost: hostname,
    summary: {
      targetPeople: personIds.length,
      seedClaims: incomingClaims.length,
      acceptedProfileClaims: acceptedProfileClaims.length,
      newerProfileClaimsProtected: newerProtected.length,
      newerCanonicalFieldsRestored: newerCanonicalRestorations.length,
      stale2022ProfileClaimsArchivedForNewerOfficial: staleProtectedProfileClaims.length,
      canonicalPeopleChanged: canonicalChanges.length,
      priorCanonicalSnapshots: snapshots.length,
      priorPublicProfileClaimsArchived: replacedPublicClaims.length,
      acceptedBasicClaims: acceptedBasicClaims.length,
      exactBasicDuplicatesArchived: duplicateBasicClaims.length,
      basicConflictsLeftForReview: conflictingBasicClaims.length,
      electionPartyComparisons: partyComparisons.length,
      electionPartyDifferencesNotOverwritten: partyComparisons.filter((item) => !item.same).length,
    },
    newerProtected,
    newerCanonicalRestorations,
    conflictingBasicClaims,
    partyDifferences: partyComparisons.filter((item) => !item.same),
    canonicalChanges: canonicalChanges.map(({ personId, personName, fields }) => ({ personId, personName, changedFields: Object.keys(fields) })),
  };
  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (!args.write) return;

  await upsertClaims(config, [...acceptedProfileClaims, ...acceptedBasicClaims].map(incomingRow));
  await upsertClaims(config, snapshots);
  for (const claim of staleProtectedProfileClaims) {
    const replacement = newerByPersonType.get(personTypeKey(claim.person_id, claim.claim_type, canonicalByPersonId))?.claim_key ?? null;
    await patchClaim(config, claim, replacement, 'Archived because a newer official CEC bulletin profile exists.');
  }
  for (const claim of replacedPublicClaims) {
    const replacement = acceptedProfileByPersonType.get(personTypeKey(claim.person_id, claim.claim_type, canonicalByPersonId))?.claimKey ?? null;
    await patchClaim(config, claim, replacement, 'Superseded by the official 2022 CEC councilor election bulletin profile.');
  }
  for (const { claim, official } of duplicateBasicClaims) {
    await patchClaim(config, claim, official.claimKey, 'Exact duplicate of the official 2022 CEC candidate field.');
  }
  for (const change of canonicalChanges) await patchPerson(config, change.personId, change.fields);
  console.log('Local CEC 2022 councilor profile replacement completed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { basicValuesCompatible, canonicalPersonId, isNewerOfficialProfileClaim, personTypeKey };
