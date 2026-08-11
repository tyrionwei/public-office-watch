import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertWriteWindow,
  planOfficialCandidateImport,
  validateSnapshot,
} from './import-official-candidate-snapshot.mjs';
import {
  applyReviewedOfficialCandidates,
  stageOfficialCandidateReview,
  validateReviewFile,
} from './official-candidate-review.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
          separator >= 0 ? line.slice(0, separator).trim() : line,
          separator >= 0 ? line.slice(separator + 1).trim().replace(/^["']|["']$/g, '') : '',
        ];
      }),
  );
}

function parseArgs(argv) {
  const options = { inputPath: null, mode: 'dry-run', reviewPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = argv[++index] ?? null;
    else if (arg === '--stage') options.mode = 'stage';
    else if (arg === '--apply-reviewed') {
      options.mode = 'apply-reviewed';
      options.reviewPath = argv[++index] ?? null;
    } else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!options.inputPath) throw new Error('--input is required');
  if (options.mode === 'apply-reviewed' && !options.reviewPath) {
    throw new Error('--apply-reviewed requires a review file');
  }
  return options;
}

function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').replaceAll('臺', '台').replace(/\s+/g, '');
}

function buildReviewPlan(snapshot, state, basePlan) {
  const racesByExternalId = new Map(state.races.map((row) => [row.external_id, row]));
  const peopleByExternalId = new Map(state.people.map((row) => [row.external_id, row]));
  const candidatesByExternalId = new Map(state.candidates.map((row) => [row.external_id, row]));
  const blockedIds = new Set(basePlan.blocking.map((item) => item.candidateExternalId));
  const matched = snapshot.records
    .filter((record) => !blockedIds.has(record.candidateExternalId))
    .map((record) => {
      const race = racesByExternalId.get(record.raceExternalId);
      return {
        record,
        race,
        person: peopleByExternalId.get(record.personExternalId) ?? null,
        candidate: candidatesByExternalId.get(record.candidateExternalId) ?? null,
        identityCandidates: state.people.filter((person) => normalizeName(person.name) === normalizeName(record.personName)),
        raceCandidates: state.candidates.filter((candidate) => candidate.race_id === race.id),
      };
    });
  return { ...basePlan, matched };
}

function legacyRegistrationStatus(candidacyStatus) {
  if (candidacyStatus === 'registered' || candidacyStatus === 'qualified') return candidacyStatus;
  return candidacyStatus === 'withdrawn_or_disqualified' ? 'disqualified' : 'unknown';
}

function candidateWriteRow(snapshot, planned, personByExternalId, now) {
  const existing = planned.candidate ?? null;
  const { record } = planned;
  return {
    external_id: existing?.external_id ?? record.candidateExternalId,
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
    is_public: existing?.is_public === true,
    updated_at: now,
  };
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(config, tableName);
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

function quotePostgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function fetchByValues(config, tableName, select, column, values) {
  const rows = [];
  const unique = Array.from(new Set(values.filter(Boolean)));
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100);
    rows.push(...await fetchRows(config, tableName, select, {
      [column]: `in.(${chunk.map(quotePostgrestValue).join(',')})`,
    }));
  }
  return rows;
}

function reviewTemplate(plan) {
  return plan.matched.map((item) => {
    const suggestedPersonId = item.candidate?.person_id
      ?? item.person?.id
      ?? (item.identityCandidates.length === 1 ? item.identityCandidates[0].id : null);
    return {
      candidateExternalId: item.record.candidateExternalId,
      personName: item.record.personName,
      suggestedDecision: suggestedPersonId ? 'use_existing' : item.identityCandidates.length === 0 ? 'create_new' : 'manual_review',
      suggestedPersonId,
      exactNameCandidates: item.identityCandidates.map((person) => ({ id: person.id, externalId: person.external_id })),
      reviewedAt: null,
    };
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.inputPath);
  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const snapshot = validateSnapshot(raw);
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  const races = await fetchByValues(config, 'races', 'id,external_id,title', 'external_id', snapshot.records.map((row) => row.raceExternalId));
  const [officialPeople, exactNamePeople, officialCandidates, raceCandidates] = await Promise.all([
    fetchByValues(config, 'people', 'id,external_id,name', 'external_id', snapshot.records.map((row) => row.personExternalId)),
    fetchByValues(config, 'people', 'id,external_id,name', 'name', snapshot.records.map((row) => row.personName)),
    fetchByValues(config, 'candidates', 'id,external_id,person_id,race_id,party,candidate_no,registration_status,candidacy_status,election_result,is_incumbent,source_name,source_url,is_public', 'external_id', snapshot.records.map((row) => row.candidateExternalId)),
    fetchByValues(config, 'candidates', 'id,external_id,person_id,race_id,party,candidate_no,registration_status,candidacy_status,election_result,is_incumbent,source_name,source_url,is_public', 'race_id', races.map((row) => row.id)),
  ]);
  const candidates = Array.from(new Map([...officialCandidates, ...raceCandidates].map((row) => [row.id, row])).values());
  const candidatePeople = await fetchByValues(config, 'people', 'id,external_id,name', 'id', candidates.map((row) => row.person_id));
  const people = Array.from(new Map([...officialPeople, ...exactNamePeople, ...candidatePeople].map((row) => [row.id, row])).values());
  const basePlan = planOfficialCandidateImport(snapshot, { races, people, candidates });
  const plan = buildReviewPlan(snapshot, { races, people, candidates }, basePlan);
  const summary = {
    status: plan.blocking.length > 0 ? 'blocked' : 'ok',
    mode: options.mode,
    inputPath,
    recordCount: snapshot.records.length,
    reviewableCount: plan.matched.length,
    blockingCount: plan.blocking.length,
    blocking: plan.blocking,
    reviewTemplate: reviewTemplate(plan),
  };
  if (plan.blocking.length > 0) {
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }
  if (options.mode === 'dry-run') {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  let writeResult;
  if (options.mode === 'stage') {
    writeResult = await stageOfficialCandidateReview(config, snapshot, plan, raw);
  } else {
    assertWriteWindow(snapshot);
    const reviewPath = path.resolve(options.reviewPath);
    if (!fs.existsSync(reviewPath)) throw new Error(`Review file not found: ${reviewPath}`);
    const review = validateReviewFile(JSON.parse(fs.readFileSync(reviewPath, 'utf8')), snapshot, plan);
    await stageOfficialCandidateReview(config, snapshot, plan, raw);
    writeResult = await applyReviewedOfficialCandidates(config, snapshot, review, candidateWriteRow);
  }
  console.log(JSON.stringify({ ...summary, writeResult }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { buildReviewPlan, candidateWriteRow, parseArgs, reviewTemplate };
