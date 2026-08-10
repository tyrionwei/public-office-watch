import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classifyLegalResearchRow } from './preview-tnl-dark-guide-legal-claims.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'local-data', 'tnl-dark-guide-legal-coverage.json');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function countsBy(values) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)));
}

export function buildTnlLegalCoverageReport({
  sourceResearchReport,
  existingClaims = [],
  personCanonicalMap = [],
  people = [],
}) {
  const canonicalIds = new Map(personCanonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const canonicalPersonId = (personId) => canonicalIds.get(personId) ?? personId;
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const legalRows = (sourceResearchReport.claims ?? []).filter((row) => row.category === '涉案紀錄');
  const classifiedRecords = legalRows.map((row) => ({
    ...classifyLegalResearchRow(row),
    canonicalPersonId: canonicalPersonId(row.canonicalPersonId),
  }));
  const criminalRecords = classifiedRecords.filter((row) => row.recordType === 'criminal');
  const legalPersonIds = unique(classifiedRecords.map((row) => row.canonicalPersonId));
  const criminalPersonIds = unique(criminalRecords.map((row) => row.canonicalPersonId));
  const publicCriminalPersonIds = new Set(existingClaims.filter((claim) => (
    claim.claim_type === 'legal_case'
    && claim.review_status === 'verified'
    && claim.visibility === 'public'
    && claim.is_public === true
    && claim.claim_json?.recordType === 'criminal'
  )).map((claim) => canonicalPersonId(claim.person_id)));
  const coveredPersonIds = criminalPersonIds.filter((personId) => publicCriminalPersonIds.has(personId));
  const gapPersonIds = criminalPersonIds.filter((personId) => !publicCriminalPersonIds.has(personId));

  const coverageGaps = gapPersonIds.map((personId) => {
    const records = criminalRecords.filter((row) => row.canonicalPersonId === personId);
    return {
      personId,
      personName: peopleById.get(personId)?.name ?? records[0]?.personName ?? null,
      recordCount: records.length,
      researchStatuses: countsBy(records.map((row) => row.researchStatus)),
      caseStages: countsBy(records.map((row) => row.caseStage)),
    };
  }).sort((left, right) => (
    right.recordCount - left.recordCount
    || String(left.personName).localeCompare(String(right.personName), 'zh-TW')
  ));

  return {
    summary: {
      legalResearchRecords: classifiedRecords.length,
      legalResearchPeople: legalPersonIds.length,
      criminalResearchRecords: criminalRecords.length,
      criminalResearchPeople: criminalPersonIds.length,
      coveredCriminalResearchPeople: coveredPersonIds.length,
      uncoveredCriminalResearchPeople: gapPersonIds.length,
      publishedVerifiedCriminalPeopleOverall: publicCriminalPersonIds.size,
      coveragePercent: criminalPersonIds.length === 0
        ? 0
        : Number((coveredPersonIds.length / criminalPersonIds.length * 100).toFixed(1)),
    },
    coverageGaps,
  };
}

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^["']|["']$/g, '')];
    }));
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(config.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: { apikey: config.serviceRoleKey, authorization: 'Bearer ' + config.serviceRoleKey },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error('Failed to fetch ' + tableName + ': ' + (body?.message ?? response.statusText));
    rows.push(...body);
    if (body.length < 1000) return rows;
  }
}

async function fetchRowsByIds(config, tableName, select, column, ids) {
  const rows = [];
  const values = unique(ids);
  for (let index = 0; index < values.length; index += 80) {
    const chunk = values.slice(index, index + 80);
    rows.push(...await fetchRows(config, tableName, select, {
      [column]: 'in.(' + chunk.join(',') + ')',
    }));
  }
  return rows;
}

async function main() {
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('This report only reads local Supabase');
  }

  const sourceResearchReport = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'data-sources', 'tnl-dark-guide', 'source-research-report.json'),
    'utf8',
  ));
  const legalRows = sourceResearchReport.claims.filter((row) => row.category === '涉案紀錄');
  const existingClaims = await fetchRows(
    config,
    'person_claims',
    'person_id,claim_type,review_status,visibility,is_public,claim_json',
    { claim_type: 'eq.legal_case' },
  );
  const referencedPersonIds = [
    ...legalRows.map((row) => row.canonicalPersonId),
    ...existingClaims.map((claim) => claim.person_id),
  ];
  const personCanonicalMap = await fetchRowsByIds(
    config, 'person_canonical_map', 'person_id,canonical_person_id', 'person_id', referencedPersonIds,
  );
  const people = await fetchRowsByIds(
    config,
    'people',
    'id,name',
    'id',
    [...referencedPersonIds, ...personCanonicalMap.map((row) => row.canonical_person_id)],
  );
  const report = buildTnlLegalCoverageReport({
    sourceResearchReport,
    existingClaims,
    personCanonicalMap,
    people,
  });
  fs.mkdirSync(path.dirname(defaultOutputPath), { recursive: true });
  fs.writeFileSync(defaultOutputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ output: path.relative(repoRoot, defaultOutputPath), ...report.summary }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
