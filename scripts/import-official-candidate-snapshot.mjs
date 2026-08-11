import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedStatuses = new Set(['registered', 'qualified', 'withdrawn_or_disqualified']);
const externalIdPattern = /^[A-Za-z0-9._:-]+$/;

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0
          ? line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
          : '';
        return [key, value];
      }),
  );
}

function parseArgs(argv) {
  const options = { inputPath: null, write: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      throw new Error('--write was removed because it could publish unreviewed candidates; use the staged review workflow');
    }
    if (arg === '--input') {
      options.inputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!options.inputPath) throw new Error('--input is required');
  return options;
}

function requireText(value, field, errors) {
  const normalized = String(value ?? '').trim();
  if (!normalized) errors.push(`${field} is required`);
  return normalized;
}

function requireExternalId(value, field, errors) {
  const normalized = requireText(value, field, errors);
  if (normalized && !externalIdPattern.test(normalized)) {
    errors.push(`${field} contains unsupported characters`);
  }
  return normalized;
}

function requireDate(value, field, errors) {
  const normalized = requireText(value, field, errors);
  if (normalized && Number.isNaN(Date.parse(normalized))) errors.push(`${field} must be a valid date`);
  return normalized;
}

function validateOfficialSource(source, errors) {
  const name = requireText(source?.name, 'source.name', errors);
  const url = requireText(source?.url, 'source.url', errors);
  const publishedAt = requireDate(source?.publishedAt, 'source.publishedAt', errors);
  const retrievedAt = requireDate(source?.retrievedAt, 'source.retrievedAt', errors);

  if (url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname !== 'cec.gov.tw' && !hostname.endsWith('.cec.gov.tw')) {
        errors.push('source.url must be hosted on cec.gov.tw');
      }
    } catch {
      errors.push('source.url must be a valid URL');
    }
  }

  return { name, url, publishedAt, retrievedAt };
}

function validateSnapshot(snapshot) {
  const errors = [];
  if (snapshot?.schemaVersion !== 1) errors.push('schemaVersion must be 1');

  const electionYear = Number(snapshot?.electionYear);
  if (!Number.isInteger(electionYear) || electionYear < 1900 || electionYear > 2200) {
    errors.push('electionYear must be a four-digit year');
  }

  const candidacyStatus = requireText(snapshot?.candidacyStatus, 'candidacyStatus', errors);
  if (candidacyStatus && !allowedStatuses.has(candidacyStatus)) {
    errors.push(`candidacyStatus must be one of: ${Array.from(allowedStatuses).join(', ')}`);
  }

  const source = validateOfficialSource(snapshot?.source, errors);
  const rawRecords = Array.isArray(snapshot?.records) ? snapshot.records : [];
  if (rawRecords.length === 0) errors.push('records must contain at least one candidate');

  const seenCandidateIds = new Set();
  const records = rawRecords.map((record, index) => {
    const prefix = `records[${index}]`;
    const candidateExternalId = requireExternalId(record?.candidateExternalId, `${prefix}.candidateExternalId`, errors);
    const personExternalId = requireExternalId(record?.personExternalId, `${prefix}.personExternalId`, errors);
    const raceExternalId = requireExternalId(record?.raceExternalId, `${prefix}.raceExternalId`, errors);
    const personName = requireText(record?.personName, `${prefix}.personName`, errors);
    const party = record?.party == null ? null : String(record.party).trim() || null;
    const candidateNoProvided = Object.hasOwn(record ?? {}, 'candidateNo');
    const candidateNo = candidateNoProvided && record.candidateNo != null
      ? String(record.candidateNo).trim() || null
      : null;

    if (candidateExternalId && seenCandidateIds.has(candidateExternalId)) {
      errors.push(`${prefix}.candidateExternalId is duplicated`);
    }
    seenCandidateIds.add(candidateExternalId);

    return {
      candidateExternalId,
      personExternalId,
      raceExternalId,
      personName,
      party,
      candidateNo,
      candidateNoProvided,
      isIncumbent: record?.isIncumbent == null ? null : Boolean(record.isIncumbent),
    };
  });

  if (errors.length > 0) throw new Error(`Invalid official candidate snapshot:\n- ${errors.join('\n- ')}`);
  return { schemaVersion: 1, electionYear, candidacyStatus, source, records };
}

function legacyRegistrationStatus(candidacyStatus) {
  if (candidacyStatus === 'registered' || candidacyStatus === 'qualified') return candidacyStatus;
  if (candidacyStatus === 'withdrawn_or_disqualified') return 'disqualified';
  return 'unknown';
}

function assertWriteWindow(snapshot, now = new Date()) {
  if (snapshot.electionYear !== 2026) return;

  const registrationOpensAt = new Date('2026-08-31T00:00:00+08:00');
  if (now < registrationOpensAt) {
    throw new Error('2026 official candidate writes are disabled before registration opens on 2026-08-31');
  }

  const ballotDrawAt = new Date('2026-10-23T00:00:00+08:00');
  if (now < ballotDrawAt && snapshot.records.some((record) => record.candidateNoProvided)) {
    throw new Error('2026 ballot-number writes are disabled before the official draw on 2026-10-23');
  }
}

function planOfficialCandidateImport(snapshot, state) {
  const racesByExternalId = new Map(state.races.map((row) => [row.external_id, row]));
  const peopleByExternalId = new Map(state.people.map((row) => [row.external_id, row]));
  const candidatesByExternalId = new Map(state.candidates.map((row) => [row.external_id, row]));
  const createPeople = [];
  const createCandidates = [];
  const updateCandidates = [];
  const unchanged = [];
  const blocking = [];
  const plannedPersonIds = new Set();

  for (const record of snapshot.records) {
    const race = racesByExternalId.get(record.raceExternalId);
    const person = peopleByExternalId.get(record.personExternalId);
    const candidate = candidatesByExternalId.get(record.candidateExternalId);

    if (!race) {
      blocking.push({ candidateExternalId: record.candidateExternalId, reason: 'race_not_found', raceExternalId: record.raceExternalId });
      continue;
    }

    if (candidate) {
      if (!person) {
        blocking.push({ candidateExternalId: record.candidateExternalId, reason: 'candidate_person_external_id_not_found', personExternalId: record.personExternalId });
        continue;
      }
      if (candidate.person_id !== person.id || candidate.race_id !== race.id) {
        blocking.push({ candidateExternalId: record.candidateExternalId, reason: 'candidate_identity_conflict' });
        continue;
      }

      const next = {
        ...candidate,
        party: record.party ?? candidate.party ?? null,
        candidate_no: record.candidateNoProvided ? record.candidateNo : candidate.candidate_no,
        registration_status: legacyRegistrationStatus(snapshot.candidacyStatus),
        candidacy_status: snapshot.candidacyStatus,
        source_name: snapshot.source.name,
        source_url: snapshot.source.url,
        is_public: true,
      };
      const changed = ['party', 'candidate_no', 'registration_status', 'candidacy_status', 'source_name', 'source_url', 'is_public']
        .some((key) => next[key] !== candidate[key]);
      (changed ? updateCandidates : unchanged).push({ record, candidate, next });
      continue;
    }

    if (!person && !plannedPersonIds.has(record.personExternalId)) {
      createPeople.push({
        external_id: record.personExternalId,
        name: record.personName,
        party: record.party,
        election_year: snapshot.electionYear,
        district: race.title ?? null,
        source_url: snapshot.source.url,
        is_public: true,
      });
      plannedPersonIds.add(record.personExternalId);
    }

    createCandidates.push({ record, race, existingPerson: person ?? null });
  }

  return { createPeople, createCandidates, updateCandidates, unchanged, blocking };
}

function readSnapshot(inputPath) {
  const resolvedPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedPath)) throw new Error(`Input file not found: ${resolvedPath}`);
  return { resolvedPath, raw: JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) };
}

function restUrl(supabaseUrl, pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(config.supabaseUrl, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);

    const response = await fetch(url, {
      headers: { apikey: config.serviceRoleKey, authorization: `Bearer ${config.serviceRoleKey}` },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < pageSize) return rows;
  }
}

async function fetchByExternalIds(config, tableName, select, externalIds) {
  const rows = [];
  const ids = Array.from(new Set(externalIds));
  for (let index = 0; index < ids.length; index += 200) {
    rows.push(...await fetchRows(config, tableName, select, {
      external_id: `in.(${ids.slice(index, index + 200).join(',')})`,
    }));
  }
  return rows;
}

async function insertRows(config, tableName, rows) {
  if (rows.length === 0) return [];
  const response = await fetch(restUrl(config.supabaseUrl, tableName), {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Failed to insert ${tableName}: ${body?.message ?? response.statusText}`);
  return body;
}

async function upsertRows(config, tableName, rows, conflictKey) {
  if (rows.length === 0) return [];
  const url = restUrl(config.supabaseUrl, tableName);
  url.searchParams.set('on_conflict', conflictKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Failed to upsert ${tableName}: ${body?.message ?? response.statusText}`);
  return body;
}

function candidateWriteRow(snapshot, planned, personByExternalId, now) {
  const existing = planned.candidate ?? null;
  const record = planned.record;
  return {
    external_id: record.candidateExternalId,
    person_id: personByExternalId.get(record.personExternalId)?.id ?? existing?.person_id,
    race_id: planned.race?.id ?? existing?.race_id,
    party: record.party ?? existing?.party ?? null,
    candidate_no: record.candidateNoProvided ? record.candidateNo : existing?.candidate_no ?? null,
    registration_status: legacyRegistrationStatus(snapshot.candidacyStatus),
    candidacy_status: snapshot.candidacyStatus,
    election_result: existing?.election_result ?? 'pending',
    is_incumbent: record.isIncumbent ?? existing?.is_incumbent ?? null,
    source_name: snapshot.source.name,
    source_url: snapshot.source.url,
    is_public: true,
    updated_at: now,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { resolvedPath, raw } = readSnapshot(options.inputPath);
  const snapshot = validateSnapshot(raw);
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  const [races, people, candidates] = await Promise.all([
    fetchByExternalIds(config, 'races', 'id,external_id,title', snapshot.records.map((row) => row.raceExternalId)),
    fetchByExternalIds(config, 'people', 'id,external_id,name', snapshot.records.map((row) => row.personExternalId)),
    fetchByExternalIds(config, 'candidates', 'id,external_id,person_id,race_id,party,candidate_no,registration_status,candidacy_status,election_result,is_incumbent,source_name,source_url,is_public', snapshot.records.map((row) => row.candidateExternalId)),
  ]);
  const plan = planOfficialCandidateImport(snapshot, { races, people, candidates });
  const summary = {
    inputPath: resolvedPath,
    dryRun: !options.write,
    recordCount: snapshot.records.length,
    createPersonCount: plan.createPeople.length,
    createCandidateCount: plan.createCandidates.length,
    updateCandidateCount: plan.updateCandidates.length,
    unchangedCount: plan.unchanged.length,
    blockingCount: plan.blocking.length,
  };

  if (plan.blocking.length > 0) {
    console.log(JSON.stringify({ status: 'blocked', ...summary, blocking: plan.blocking }, null, 2));
    process.exitCode = 1;
    return;
  }
  if (!options.write) {
    console.log(JSON.stringify({ status: 'ok', ...summary, sample: {
      createPeople: plan.createPeople.slice(0, 10),
      createCandidates: plan.createCandidates.slice(0, 10).map((item) => item.record),
      updateCandidates: plan.updateCandidates.slice(0, 10).map((item) => item.record),
    } }, null, 2));
    return;
  }

  assertWriteWindow(snapshot);

  const now = new Date().toISOString();
  const insertedPeople = await insertRows(config, 'people', plan.createPeople.map((row) => ({ ...row, updated_at: now })));
  const personByExternalId = new Map([...people, ...insertedPeople].map((row) => [row.external_id, row]));
  const candidateRows = [
    ...plan.createCandidates.map((item) => candidateWriteRow(snapshot, item, personByExternalId, now)),
    ...plan.updateCandidates.map((item) => candidateWriteRow(snapshot, { ...item, race: races.find((race) => race.id === item.candidate.race_id) }, personByExternalId, now)),
  ];
  const writtenCandidates = await upsertRows(config, 'candidates', candidateRows, 'external_id');
  await insertRows(config, 'raw_source_records', [{
    source_type: 'official_candidate_snapshot',
    source_name: snapshot.source.name,
    source_url: snapshot.source.url,
    fetched_at: snapshot.source.retrievedAt,
    raw_json: raw,
    crawler_name: 'import-official-candidate-snapshot',
    notes: `Official candidate status import for ${snapshot.electionYear}: ${snapshot.candidacyStatus}`,
  }]);

  console.log(JSON.stringify({ status: 'ok', ...summary, insertedPersonCount: insertedPeople.length, writtenCandidateCount: writtenCandidates.length }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { assertWriteWindow, planOfficialCandidateImport, validateSnapshot };
