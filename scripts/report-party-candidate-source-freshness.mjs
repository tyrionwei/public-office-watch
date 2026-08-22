import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { validateSnapshot } from './import-party-candidate-snapshot.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  const options = { liveInputs: [], browserInputs: [], outputPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.liveInputs.push(path.resolve(argv[++index] ?? ''));
    else if (arg === '--browser-input') options.browserInputs.push(path.resolve(argv[++index] ?? ''));
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (options.liveInputs.length + options.browserInputs.length === 0) {
    throw new Error('At least one --input or --browser-input is required');
  }
  return options;
}

function nullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function textList(value) {
  return Array.isArray(value) ? value.map(nullableText).filter(Boolean) : [];
}

function normalizedDistrict(value) {
  return nullableText(value)?.replaceAll('｜', '|') ?? null;
}

function canonicalLatest(snapshot, record) {
  return {
    sourceCandidateKey: nullableText(record.sourceCandidateKey),
    sourceName: nullableText(snapshot.source?.name),
    sourceUrl: nullableText(record.profileUrl) ?? nullableText(snapshot.source?.url),
    personName: nullableText(record.personName),
    party: nullableText(snapshot.party),
    candidacyStatus: nullableText(record.candidacyStatus),
    raceType: nullableText(record.raceType),
    regionName: nullableText(record.regionName),
    districtName: normalizedDistrict(record.districtName),
    nominationAnnouncedAt: nullableText(record.nominationAnnouncedAt),
    profileUrl: nullableText(record.profileUrl),
    photoUrl: nullableText(record.photoUrl),
    education: textList(record.education),
    experience: textList(record.experience),
    platform: textList(record.platform),
    socialLinks: textList(record.socialLinks),
  };
}

function canonicalStaged(row) {
  const payload = row.source_payload ?? {};
  const race = payload.targetRace ?? {};
  return {
    sourceCandidateKey: nullableText(payload.sourceCandidateKey ?? row.source_id),
    sourceName: nullableText(row.source_name),
    sourceUrl: nullableText(row.source_url),
    personName: nullableText(row.raw_name),
    party: nullableText(row.party),
    candidacyStatus: nullableText(payload.candidacyStatus),
    raceType: nullableText(race.raceType),
    regionName: nullableText(race.regionName),
    districtName: normalizedDistrict(race.districtName),
    nominationAnnouncedAt: nullableText(payload.nominationAnnouncedAt),
    profileUrl: nullableText(payload.profileUrl),
    photoUrl: nullableText(payload.photoUrl),
    education: textList(payload.education),
    experience: textList(payload.experience),
    platform: textList(payload.platform),
    socialLinks: textList(payload.socialLinks),
  };
}

function differingFields(latest, staged) {
  return Object.keys(latest).filter((field) => (
    field !== 'sourceCandidateKey'
    && JSON.stringify(latest[field]) !== JSON.stringify(staged[field])
  ));
}

function indexedByKey(rows, label) {
  const index = new Map();
  for (const row of rows) {
    const key = row.sourceCandidateKey;
    if (!key) throw new Error(`${label} contains a record without sourceCandidateKey`);
    if (index.has(key)) throw new Error(`${label} contains duplicate sourceCandidateKey: ${key}`);
    index.set(key, row);
  }
  return index;
}

function countByParty(items, partyFor) {
  const counts = {};
  for (const item of items) {
    const party = partyFor(item) ?? '未標示';
    counts[party] = (counts[party] ?? 0) + 1;
  }
  return counts;
}

function buildSourceFreshnessReport(snapshotInputs, stagedRows, generatedAt = new Date().toISOString()) {
  const latestRecords = [];
  const sources = snapshotInputs.map(({ snapshot, freshnessMode, inputPath }) => {
    validateSnapshot(snapshot);
    for (const record of snapshot.records) latestRecords.push(canonicalLatest(snapshot, record));
    return {
      party: snapshot.party,
      sourceName: snapshot.source.name,
      sourceUrl: snapshot.source.url,
      retrievedAt: snapshot.source.retrievedAt,
      freshnessMode,
      inputPath,
      recordCount: snapshot.records.length,
    };
  });

  const latestByKey = indexedByKey(latestRecords, 'Latest snapshots');
  const staged = stagedRows.map(canonicalStaged);
  const stagedByKey = indexedByKey(staged, 'Local Supabase source_people');
  const unchanged = [];
  const changed = [];
  const missingInStaged = [];

  for (const [key, latest] of latestByKey) {
    const existing = stagedByKey.get(key);
    if (!existing) {
      missingInStaged.push(latest);
      continue;
    }
    const fields = differingFields(latest, existing);
    if (fields.length === 0) unchanged.push(latest);
    else {
      changed.push({
        sourceCandidateKey: key,
        personName: latest.personName,
        party: latest.party,
        changedFields: fields,
        latest: Object.fromEntries(fields.map((field) => [field, latest[field]])),
        staged: Object.fromEntries(fields.map((field) => [field, existing[field]])),
      });
    }
  }

  const stagedOnly = staged.filter((row) => !latestByKey.has(row.sourceCandidateKey));
  const parties = new Set([
    ...latestRecords.map((record) => record.party),
    ...staged.map((record) => record.party),
  ]);
  const byParty = Object.fromEntries([...parties].filter(Boolean).sort().map((party) => [party, {
    latest: latestRecords.filter((record) => record.party === party).length,
    staged: staged.filter((record) => record.party === party).length,
    unchanged: unchanged.filter((record) => record.party === party).length,
    changed: changed.filter((record) => record.party === party).length,
    missingInStaged: missingInStaged.filter((record) => record.party === party).length,
    stagedOnly: stagedOnly.filter((record) => record.party === party).length,
  }]));

  return {
    generatedAt,
    scope: 'Local Supabase official_site candidates for the 2026 election',
    sources,
    summary: {
      latestRecordCount: latestRecords.length,
      stagedRecordCount: staged.length,
      matchedCount: unchanged.length + changed.length,
      unchangedCount: unchanged.length,
      changedCount: changed.length,
      missingInStagedCount: missingInStaged.length,
      stagedOnlyCount: stagedOnly.length,
      liveFetchRecordCount: sources.filter((source) => source.freshnessMode === 'live_fetch')
        .reduce((total, source) => total + source.recordCount, 0),
      browserSnapshotRecordCount: sources.filter((source) => source.freshnessMode === 'browser_snapshot')
        .reduce((total, source) => total + source.recordCount, 0),
    },
    byParty,
    changed,
    missingInStaged,
    stagedOnly,
    diagnostics: {
      changedFields: countByParty(changed.flatMap((item) => item.changedFields), (field) => field),
    },
  };
}

function restUrl(config) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/source_people`);
}

async function fetchStagedRows(config) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config);
    url.searchParams.set('select', 'source_id,source_name,source_url,raw_name,party,source_payload');
    url.searchParams.set('source_type', 'eq.official_site');
    url.searchParams.set('election_year', 'eq.2026');
    url.searchParams.set('order', 'source_id.asc');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch source_people: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < 1000) return rows;
  }
}

function loadInputs(options) {
  return [
    ...options.liveInputs.map((inputPath) => ({ inputPath, freshnessMode: 'live_fetch' })),
    ...options.browserInputs.map((inputPath) => ({ inputPath, freshnessMode: 'browser_snapshot' })),
  ].map((input) => ({
    ...input,
    inputPath: path.relative(repoRoot, input.inputPath),
    snapshot: JSON.parse(fs.readFileSync(input.inputPath, 'utf8')),
  }));
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
    throw new Error('Party candidate freshness report only reads Local Supabase.');
  }

  const report = buildSourceFreshnessReport(loadInputs(options), await fetchStagedRows(config));
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    output: options.outputPath ? path.relative(repoRoot, options.outputPath) : null,
    ...report.summary,
    byParty: report.byParty,
    changed: report.changed.map(({ sourceCandidateKey, personName, party, changedFields }) => ({
      sourceCandidateKey,
      personName,
      party,
      changedFields,
    })),
    missingInStaged: report.missingInStaged.map(({ sourceCandidateKey, personName, party }) => ({
      sourceCandidateKey,
      personName,
      party,
    })),
    stagedOnly: report.stagedOnly.map(({ sourceCandidateKey, personName, party }) => ({
      sourceCandidateKey,
      personName,
      party,
    })),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  buildSourceFreshnessReport,
  canonicalLatest,
  canonicalStaged,
};
