import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'profile-ocr-review.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'cec-representative-platforms', '2022-councilor', 'profile-ocr-staging.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const officialBulletinHostnames = new Set(['eebulletin.cec.gov.tw', 'bulletin.cec.gov.tw']);
const claimTypes = ['education', 'experience', 'birth_date', 'gender'];

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
  const options = { inputPath: defaultInputPath, outputPath: defaultOutputPath, applyLocal: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--apply-local') options.applyLocal = true;
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function assertLocalSupabase(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  if (!localHostnames.has(hostname)) throw new Error(`CEC OCR review writes are local-only; received Supabase host ${hostname}`);
}

function validateReport(report) {
  if (!Array.isArray(report?.entries) || report.entries.length !== report?.summary?.targetCount) {
    throw new Error('Expected a complete CEC 2022 councilor profile OCR report');
  }
  const ids = new Set();
  for (const entry of report.entries) {
    if (!entry.candidateId || ids.has(entry.candidateId)) throw new Error(`Invalid or duplicate candidate ID for ${entry.personName ?? 'unknown'}`);
    ids.add(entry.candidateId);
    if (entry.ocr?.status !== 'ocr_ready_private_review') continue;
    const sourceUrl = new URL(entry.sourceDocument?.url ?? '');
    if (sourceUrl.protocol !== 'https:' || !officialBulletinHostnames.has(sourceUrl.hostname)
      || !/^[a-f0-9]{64}$/u.test(entry.sourceDocument?.sha256 ?? '')) {
      throw new Error(`Invalid official source evidence for ${entry.personName}`);
    }
    if (!entry.ocr.education && !entry.ocr.experience) throw new Error(`OCR-ready entry has no profile content for ${entry.personName}`);
  }
  return report.entries.filter((entry) => entry.ocr?.status === 'ocr_ready_private_review');
}

function buildPendingClaims(entry, canonicalPersonId = entry.personId, candidateLinkNameVerified = false) {
  const values = {
    education: entry.ocr.education,
    experience: entry.ocr.experience,
    birth_date: entry.ocr.birthDate,
    gender: entry.ocr.gender,
  };
  const rawValues = {
    education: entry.ocr.educationRaw ?? entry.ocr.education,
    experience: entry.ocr.experienceRaw ?? entry.ocr.experience,
    birth_date: entry.ocr.birthDateRaw,
    gender: entry.ocr.genderRaw,
  };
  const cropNames = { education: 'education', experience: 'experience', birth_date: 'birth', gender: 'gender' };
  return claimTypes.filter((claimType) => values[claimType]).map((claimType) => ({
    claim_key: `cec-2022-councilor-profile-ocr:${entry.candidateId}:${claimType}`,
    person_id: canonicalPersonId,
    source_person_id: null,
    candidate_id: entry.candidateId,
    claim_type: claimType,
    claim_value: values[claimType],
    claim_json: {
      value: values[claimType],
      rawOcr: rawValues[claimType] ?? null,
      profileSource: 'cec_election_bulletin_ocr',
      electionYear: 2022,
      candidateId: entry.candidateId,
      raceTitle: entry.raceTitle,
      sourceDocument: {
        file: entry.sourceDocument.file,
        url: entry.sourceDocument.url,
        sha256: entry.sourceDocument.sha256,
        page: entry.ocr.page,
        cropFile: entry.ocr.cropFiles?.[cropNames[claimType]] ?? null,
        extractionMethod: entry.ocr.geometrySource,
      },
      identityMapping: {
        sourceReportPersonId: entry.personId,
        canonicalPersonId,
        candidateLinkNameVerified,
      },
      publicationGate: {
        status: 'pending_visual_ocr_review',
        reason: 'Official CEC bulletin, district, candidate number, and table cell are matched; OCR text still requires visual review.',
      },
    },
    confidence_level: 'C',
    review_status: 'pending',
    visibility: 'private',
    source_name: '中央選舉委員會：2022年縣市議員選舉公報 OCR',
    source_url: entry.sourceDocument.url,
    observed_at: '2022-11-26T00:00:00+08:00',
    is_public: false,
    review_score: 55,
    scoring_version: 'cec-2022-councilor-profile-ocr-review-v1',
    scoring_reasons: [
      'Central Election Commission election bulletin',
      'Election district and candidate number matched to the existing candidacy',
      'OCR-derived field requires private visual review before publication',
    ],
  }));
}

function restHeaders(serviceRoleKey, prefer) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'accept-profile': 'public',
    'content-profile': 'public',
    ...(prefer ? { prefer } : {}),
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${label}: ${body?.message ?? response.statusText}`);
  return body;
}

function batches(values, size = 100) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function fetchCandidates(config, candidateIds) {
  const rows = [];
  for (const batch of batches(candidateIds)) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/candidates`);
    url.searchParams.set('select', 'id,person_id');
    url.searchParams.set('id', `in.(${batch.join(',')})`);
    rows.push(...await responseJson(await fetch(url, {
      headers: restHeaders(config.serviceRoleKey),
      signal: AbortSignal.timeout(30000),
    }), 'Failed to fetch local candidates'));
  }
  return rows;
}

async function fetchPeople(config, personIds) {
  const rows = [];
  for (const batch of batches(personIds)) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/people`);
    url.searchParams.set('select', 'id,name');
    url.searchParams.set('id', `in.(${batch.join(',')})`);
    rows.push(...await responseJson(await fetch(url, {
      headers: restHeaders(config.serviceRoleKey),
      signal: AbortSignal.timeout(30000),
    }), 'Failed to fetch local canonical people'));
  }
  return rows;
}

function normalizePersonName(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\s・．.‧·]/gu, '').toLowerCase();
}

async function fetchClaims(config, candidateIds) {
  const rows = [];
  for (const batch of batches(candidateIds)) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/person_claims`);
    url.searchParams.set('select', 'id,claim_key,claim_json,candidate_id,review_status,visibility,is_public');
    url.searchParams.set('candidate_id', `in.(${batch.join(',')})`);
    rows.push(...await responseJson(await fetch(url, {
      headers: restHeaders(config.serviceRoleKey),
      signal: AbortSignal.timeout(30000),
    }), 'Failed to fetch local profile claims'));
  }
  return rows.filter((row) => row.claim_key?.startsWith('cec-2022-councilor-profile-ocr:'));
}

async function upsertClaims(config, rows) {
  for (const batch of batches(rows, 50)) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/person_claims`);
    url.searchParams.set('on_conflict', 'claim_key');
    await responseJson(await fetch(url, {
      method: 'POST',
      headers: restHeaders(config.serviceRoleKey, 'resolution=merge-duplicates,return=minimal'),
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(30000),
    }), 'Failed to stage local CEC OCR claims');
  }
}

async function archiveClaims(config, rows) {
  for (const claim of rows) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/person_claims`);
    url.searchParams.set('id', `eq.${claim.id}`);
    await responseJson(await fetch(url, {
      method: 'PATCH',
      headers: restHeaders(config.serviceRoleKey, 'return=minimal'),
      body: JSON.stringify({
        review_status: 'archived',
        visibility: 'private',
        is_public: false,
        claim_json: {
          ...(claim.claim_json ?? {}),
          publicationGate: {
            status: 'archived_after_layout_safety_revalidation',
            reason: 'The OCR claim no longer passes exact candidate-row layout validation.',
          },
        },
      }),
      signal: AbortSignal.timeout(30000),
    }), `Failed to archive stale local OCR claim ${claim.claim_key}`);
  }
}

function selectClaimSyncActions(allClaims, existingClaims) {
  const expectedKeys = new Set(allClaims.map((claim) => claim.claim_key));
  const existingByKey = new Map(existingClaims.map((claim) => [claim.claim_key, claim]));
  return {
    claims: allClaims.filter((claim) => !existingByKey.has(claim.claim_key)
      || existingByKey.get(claim.claim_key).review_status === 'archived'),
    staleClaims: existingClaims.filter((claim) => !expectedKeys.has(claim.claim_key)
      && claim.review_status === 'pending' && claim.visibility === 'private' && claim.is_public === false),
    expectedKeys,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = { ...readLocalEnv(), ...process.env };
  const config = {
    supabaseUrl: String(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/u, ''),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
  };
  assertLocalSupabase(config.supabaseUrl);
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for local review staging');
  const report = JSON.parse(fs.readFileSync(options.inputPath, 'utf8'));
  const entries = validateReport(report);
  const candidateIds = entries.map((entry) => entry.candidateId);
  const allCandidateIds = report.entries.map((entry) => entry.candidateId);
  const [candidates, existingBefore] = await Promise.all([
    fetchCandidates(config, candidateIds),
    fetchClaims(config, allCandidateIds),
  ]);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  if (candidateById.size !== candidateIds.length) throw new Error(`Expected ${candidateIds.length} local candidates, found ${candidateById.size}`);
  const people = await fetchPeople(config, [...new Set(candidates.map((candidate) => candidate.person_id))]);
  const personById = new Map(people.map((person) => [person.id, person]));
  for (const entry of entries) {
    const person = personById.get(candidateById.get(entry.candidateId)?.person_id);
    if (!person || normalizePersonName(person.name) !== normalizePersonName(entry.personName)) {
      throw new Error(`Canonical candidate-person name mismatch for ${entry.personName}: ${person?.name ?? 'missing'}`);
    }
  }
  const allClaims = entries.flatMap((entry) => {
    const candidate = candidateById.get(entry.candidateId);
    if (!candidate.person_id) throw new Error(`Candidate has no canonical person: ${entry.personName}`);
    return buildPendingClaims(entry, candidate.person_id, true);
  });
  const { claims, staleClaims, expectedKeys } = selectClaimSyncActions(allClaims, existingBefore);
  const staging = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(repoRoot, options.inputPath),
    summary: {
      targetPeople: entries.length,
      targetClaims: allClaims.length,
      existingClaimCount: existingBefore.length,
      pendingInsertCount: claims.length,
      staleClaimArchiveCount: staleClaims.length,
      publicInsertCount: claims.filter((claim) => claim.is_public).length,
      canonicalPersonRemapCount: entries.filter((entry) => candidateById.get(entry.candidateId)?.person_id !== entry.personId).length,
      canonicalNameVerifiedCount: entries.length,
    },
    claims,
    staleClaims: staleClaims.map((claim) => ({ id: claim.id, claimKey: claim.claim_key, candidateId: claim.candidate_id })),
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(staging, null, 2)}\n`);
  if (!options.applyLocal) {
    console.log(JSON.stringify({ ...staging.summary, applied: false }, null, 2));
    return;
  }
  await upsertClaims(config, claims);
  await archiveClaims(config, staleClaims);
  const existingAfter = await fetchClaims(config, allCandidateIds);
  const matchedAfter = existingAfter.filter((claim) => expectedKeys.has(claim.claim_key));
  const insertedAfter = matchedAfter.filter((claim) => claims.some((row) => row.claim_key === claim.claim_key));
  const staleKeys = new Set(staleClaims.map((claim) => claim.claim_key));
  const archivedAfter = existingAfter.filter((claim) => staleKeys.has(claim.claim_key) && claim.review_status === 'archived');
  if (matchedAfter.length !== allClaims.length || archivedAfter.length !== staleClaims.length || insertedAfter.some((claim) =>
    claim.review_status !== 'pending' || claim.visibility !== 'private' || claim.is_public !== false)) {
    throw new Error(`Local OCR staging verification failed: expected=${allClaims.length}, found=${matchedAfter.length}`);
  }
  console.log(JSON.stringify({
    ...staging.summary,
    applied: true,
    localMatchedClaimCount: matchedAfter.length,
    localInsertedPendingPrivateCount: insertedAfter.length,
    localArchivedStaleClaimCount: archivedAfter.length,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { assertLocalSupabase, buildPendingClaims, normalizePersonName, parseArgs, selectClaimSyncActions, validateReport };
