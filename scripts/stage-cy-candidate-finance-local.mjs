import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(repoRoot, 'tmp', 'candidate-finance', 'cy-2022-mayor-finance.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'candidate-finance', 'cy-2022-mayor-finance-staging.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const officialHost = 'ardata.cy.gov.tw';
const forbiddenInputKeys = new Set([
  '捐贈者／支出對象',
  '身分證／統一編號',
  '地址',
  '聯絡電話',
  '會計師事務所全名',
  '會計師姓名',
  'incomes',
  'expenditures',
]);

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
    else throw new Error('Unsupported argument: ' + arg);
  }
  if (!fs.existsSync(options.inputPath)) throw new Error('Candidate finance report not found: ' + options.inputPath);
  return options;
}

function assertLocalSupabase(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  if (!localHostnames.has(hostname)) {
    throw new Error('Candidate finance writes are local-only; received Supabase host ' + hostname);
  }
}

function assertOfficialUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== officialHost) {
    throw new Error('Candidate finance source must use the official ' + officialHost + ' HTTPS origin');
  }
  return url.toString();
}

function findForbiddenInputKey(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenInputKey(value[index], [...pathParts, String(index)]);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenInputKeys.has(key)) return [...pathParts, key].join('.');
    const found = findForbiddenInputKey(nested, [...pathParts, key]);
    if (found) return found;
  }
  return null;
}

function validateReport(report) {
  if (report?.schemaVersion !== 1 || !Array.isArray(report?.sources) || !Array.isArray(report?.records)) {
    throw new Error('Expected a schema version 1 candidate finance report');
  }
  if (report.sourceUrl !== 'https://ardata.cy.gov.tw/home') {
    throw new Error('Candidate finance report source URL is not the reviewed Control Yuan platform');
  }
  if (report.scopeCount !== report.sources.length || report.recordCount !== report.records.length) {
    throw new Error('Candidate finance report counts do not match the payload');
  }
  const forbidden = findForbiddenInputKey(report);
  if (forbidden) throw new Error('Candidate finance report contains forbidden detail field: ' + forbidden);

  const sourceByUrl = new Map();
  for (const source of report.sources) {
    const sourceUrl = assertOfficialUrl(source.sourceUrl);
    if (!/^[a-f0-9]{64}$/u.test(source.archiveSha256) || !/^[a-f0-9]{64}$/u.test(source.summarySha256)) {
      throw new Error('Candidate finance source is missing a valid content hash for ' + source.area);
    }
    sourceByUrl.set(sourceUrl, source);
  }

  for (const record of report.records) {
    const sourceUrl = assertOfficialUrl(record.sourceUrl);
    if (!sourceByUrl.has(sourceUrl) || !record.candidateName || !record.electionName || !record.filingSequence) {
      throw new Error('Candidate finance record is missing its official source or identity context');
    }
    if (!record.amounts || Object.values(record.amounts).some((amount) => !Number.isSafeInteger(amount))) {
      throw new Error('Candidate finance record contains an unsafe aggregate amount for ' + record.candidateName);
    }
  }
  return report;
}

function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').replaceAll('台', '臺').replace(/[\s・．.‧·]/gu, '');
}

function normalizeElectionTitle(value) {
  return normalizeName(value).replace(/^\d{3}年/u, '');
}

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function formatTwd(value) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value) + ' 元';
}

function buildClaimValue(record) {
  return '2022 ' + normalizeElectionTitle(record.electionName).replace(/選舉$/u, '') + '（'
    + record.filingSequence + '）：收入 ' + formatTwd(record.amounts.incomeTotal)
    + '；支出 ' + formatTwd(record.amounts.expenditureTotal)
    + '；餘額 ' + formatTwd(record.amounts.balance) + '。';
}

function buildStagingRows(report, localData) {
  const electionById = new Map(localData.elections.map((row) => [row.id, row]));
  const targetTitles = new Set(report.records.map((record) => normalizeElectionTitle(record.electionName)));
  const raceById = new Map(
    localData.races
      .filter((race) => electionById.get(race.election_id)?.year === 2022)
      .filter((race) => targetTitles.has(normalizeElectionTitle(race.title)))
      .map((race) => [race.id, race]),
  );
  const personById = new Map(localData.people.map((row) => [row.id, row]));
  const matchesByKey = new Map();

  for (const candidate of localData.candidates) {
    const race = raceById.get(candidate.race_id);
    const person = personById.get(candidate.person_id);
    if (!race || !person) continue;
    const key = normalizeElectionTitle(race.title) + '\u0000' + normalizeName(person.name);
    const matches = matchesByKey.get(key) ?? [];
    matches.push({ candidate, person, race });
    matchesByKey.set(key, matches);
  }

  const sourceByUrl = new Map(report.sources.map((source) => [source.sourceUrl, source]));
  const rows = [];
  const unmatched = [];
  const ambiguous = [];
  const matchedCandidateIds = new Set();

  for (const record of report.records) {
    const key = normalizeElectionTitle(record.electionName) + '\u0000' + normalizeName(record.candidateName);
    const matches = matchesByKey.get(key) ?? [];
    if (matches.length === 0) {
      unmatched.push({
        candidateName: record.candidateName,
        electionName: record.electionName,
        reason: 'No exact registered candidacy with the same name and election',
      });
      continue;
    }
    if (matches.length !== 1) {
      ambiguous.push({
        candidateName: record.candidateName,
        electionName: record.electionName,
        candidateIds: matches.map((match) => match.candidate.id),
      });
      continue;
    }

    const { candidate, person, race } = matches[0];
    const source = sourceByUrl.get(record.sourceUrl);
    matchedCandidateIds.add(candidate.id);
    rows.push({
      claim_key: 'cy-candidate-finance:2022:' + hashKey(record.electionName + '\u0000' + record.candidateName + '\u0000' + record.filingSequence),
      person_id: person.id,
      candidate_id: candidate.id,
      claim_type: 'finance_summary',
      claim_value: buildClaimValue(record),
      claim_json: {
        sourceId: 'control-yuan-candidate-finance-2022-first-filing',
        reportType: 'candidate_campaign_finance',
        electionYear: 2022,
        electionName: record.electionName,
        filingSequence: record.filingSequence,
        amountsTwd: record.amounts,
        settlementDate: record.settlementDate,
        filingDate: record.filingDate,
        correctionDate: record.correctionDate,
        sourceArchiveSha256: source.archiveSha256,
        sourceSummarySha256: source.summarySha256,
        privacyBoundary: 'candidate_aggregate_only_no_donor_payee_or_transaction_details',
        identityEvidence: {
          matchMethod: 'exact_candidate_name_and_election',
          candidateId: candidate.id,
          raceId: race.id,
          personId: person.id,
        },
      },
      confidence_level: 'A',
      review_status: 'verified',
      visibility: 'public',
      source_name: report.sourceName,
      source_url: assertOfficialUrl(record.sourceUrl),
      observed_at: report.generatedAt,
      is_public: true,
      review_score: 100,
      scoring_version: 'cy-candidate-finance-exact-election-name-v1',
      scoring_reasons: [{
        version: 'cy-candidate-finance-exact-election-name-v1',
        reason: 'Official Control Yuan candidate aggregate matched to one registered candidacy by exact normalized name and election; no transaction-level personal data retained.',
        reviewedAt: report.generatedAt,
      }],
      auto_reviewed_at: report.generatedAt,
    });
  }

  const missingFinance = localData.candidates
    .filter((candidate) => raceById.has(candidate.race_id) && !matchedCandidateIds.has(candidate.id))
    .map((candidate) => ({
      candidateId: candidate.id,
      candidateName: personById.get(candidate.person_id)?.name ?? null,
      electionName: raceById.get(candidate.race_id)?.title ?? null,
      reason: 'Registered candidacy has no matching first-filing aggregate in the official archive',
    }));

  return { rows, unmatched, ambiguous, missingFinance };
}

function restHeaders(serviceRoleKey, prefer = null) {
  return {
    apikey: serviceRoleKey,
    authorization: 'Bearer ' + serviceRoleKey,
    accept: 'application/json',
    'content-type': 'application/json',
    'accept-profile': 'public',
    'content-profile': 'public',
    ...(prefer ? { prefer } : {}),
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : [];
  if (!response.ok) throw new Error(label + ': ' + (body?.message ?? response.statusText));
  return body;
}

function batches(values, size = 100) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function fetchPaged(config, pathname, searchParams, label) {
  const rows = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(pathname, config.supabaseUrl);
    for (const [key, value] of Object.entries(searchParams)) url.searchParams.set(key, value);
    if (!url.searchParams.has('order')) url.searchParams.set('order', 'id.asc');
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));
    const page = await responseJson(await fetch(url, {
      headers: restHeaders(config.serviceRoleKey),
      signal: AbortSignal.timeout(30000),
    }), label);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchLocalData(config, report) {
  const elections = await fetchPaged(config, '/rest/v1/elections', {
    select: 'id,name,year,voting_date',
    year: 'eq.2022',
  }, 'Failed to fetch local 2022 elections');
  const electionIds = elections.map((row) => row.id);
  const races = [];
  for (const batch of batches(electionIds)) {
    races.push(...await fetchPaged(config, '/rest/v1/races', {
      select: 'id,election_id,title',
      election_id: 'in.(' + batch.join(',') + ')',
    }, 'Failed to fetch local 2022 races'));
  }

  const targetTitles = new Set(report.records.map((record) => normalizeElectionTitle(record.electionName)));
  const targetRaceIds = races
    .filter((race) => targetTitles.has(normalizeElectionTitle(race.title)))
    .map((race) => race.id);
  const candidates = [];
  for (const batch of batches(targetRaceIds)) {
    candidates.push(...await fetchPaged(config, '/rest/v1/candidates', {
      select: 'id,person_id,race_id',
      race_id: 'in.(' + batch.join(',') + ')',
    }, 'Failed to fetch local 2022 mayor candidates'));
  }

  const personIds = [...new Set(candidates.map((row) => row.person_id))];
  const people = [];
  for (const batch of batches(personIds)) {
    people.push(...await fetchPaged(config, '/rest/v1/people', {
      select: 'id,name',
      id: 'in.(' + batch.join(',') + ')',
    }, 'Failed to fetch local candidate people'));
  }
  return { elections, races, candidates, people };
}

async function upsertClaims(config, rows) {
  for (const batch of batches(rows, 50)) {
    const url = new URL('/rest/v1/person_claims', config.supabaseUrl);
    url.searchParams.set('on_conflict', 'claim_key');
    await responseJson(await fetch(url, {
      method: 'POST',
      headers: restHeaders(config.serviceRoleKey, 'resolution=merge-duplicates,return=minimal'),
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(30000),
    }), 'Failed to write local candidate finance claims');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = { ...readLocalEnv(), ...process.env };
  const config = {
    supabaseUrl: String(env.SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/u, ''),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
  };
  assertLocalSupabase(config.supabaseUrl);
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for local candidate finance staging');

  const report = validateReport(JSON.parse(fs.readFileSync(options.inputPath, 'utf8')));
  const staging = buildStagingRows(report, await fetchLocalData(config, report));
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(repoRoot, options.inputPath),
    sourceGeneratedAt: report.generatedAt,
    matchedCount: staging.rows.length,
    unmatchedCount: staging.unmatched.length,
    ambiguousCount: staging.ambiguous.length,
    registeredWithoutFinanceCount: staging.missingFinance.length,
    privacyBoundary: report.privacyBoundary,
    rows: staging.rows,
    unmatched: staging.unmatched,
    ambiguous: staging.ambiguous,
    registeredWithoutFinance: staging.missingFinance,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, JSON.stringify(output, null, 2) + '\n');

  if (options.applyLocal) {
    if (staging.ambiguous.length > 0) throw new Error('Refused local apply with ambiguous candidate finance identities');
    await upsertClaims(config, staging.rows);
  }

  console.log(JSON.stringify({
    matchedCount: output.matchedCount,
    unmatchedCount: output.unmatchedCount,
    ambiguousCount: output.ambiguousCount,
    registeredWithoutFinanceCount: output.registeredWithoutFinanceCount,
    applied: options.applyLocal,
    outputPath: options.outputPath,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  assertLocalSupabase,
  buildClaimValue,
  buildStagingRows,
  findForbiddenInputKey,
  fetchPaged,
  normalizeElectionTitle,
  normalizeName,
  parseArgs,
  validateReport,
};
