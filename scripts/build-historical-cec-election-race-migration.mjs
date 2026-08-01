import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPreviewPath = path.join(repoRoot, 'local-data', 'historical-cec-core-preview.json');
const defaultPlanPath = path.join(repoRoot, 'local-data', 'historical-cec-election-race-plan.json');
const defaultSqlPath = path.join(repoRoot, 'local-data', 'historical-cec-election-race-dry-run.sql');
const sourceName = '中央選舉委員會開放資料';
const sourceUrl = 'https://data.gov.tw/dataset/13119';
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const historicalRegions = new Map([
  ['臺北縣', { externalId: 'cec-historical-county-taipei', slug: 'historical-taipei-county' }],
  ['桃園縣', { externalId: 'cec-historical-county-taoyuan', slug: 'historical-taoyuan-county' }],
  ['臺中縣', { externalId: 'cec-historical-county-taichung', slug: 'historical-taichung-county' }],
  ['臺南縣', { externalId: 'cec-historical-county-tainan', slug: 'historical-tainan-county' }],
  ['高雄縣', { externalId: 'cec-historical-county-kaohsiung', slug: 'historical-kaohsiung-county' }],
]);

const historicalSameNameRegions = new Map([
  ['臺中市', {
    beforeYear: 2010,
    externalId: 'cec-historical-city-taichung',
    slug: 'historical-taichung-city',
    regionType: 'city',
  }],
  ['臺南市', {
    beforeYear: 2010,
    externalId: 'cec-historical-city-tainan',
    slug: 'historical-tainan-city',
    regionType: 'city',
  }],
  ['高雄市', {
    beforeYear: 2010,
    externalId: 'cec-historical-municipality-kaohsiung',
    slug: 'historical-kaohsiung-city',
    regionType: 'municipality',
  }],
]);

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
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^["']|["']$/g, '')];
      }),
  );
}

function parseArgs(argv) {
  const options = {
    previewPath: defaultPreviewPath,
    planPath: defaultPlanPath,
    sqlPath: defaultSqlPath,
    migrationPath: null,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--preview') options.previewPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--plan') options.planPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--sql') options.sqlPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--migration') options.migrationPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function hashId(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function eventExternalId(key) {
  return `cec-historical-election-${hashId(key)}`;
}

function raceExternalId(key) {
  return `cec-historical-race-${hashId(key)}`;
}

function preferredRegion(regions, name) {
  const matches = regions.filter((region) => region.name === name);
  return matches.find((region) => String(region.external_id ?? '').startsWith('tw-county-'))
    ?? matches.find((region) => ['municipality', 'county', 'city'].includes(region.region_type))
    ?? null;
}

function historicalRegionDefinition(name, electionYear) {
  const renamedRegion = historicalRegions.get(name);
  if (renamedRegion) return { ...renamedRegion, regionType: 'county' };
  const sameNameRegion = historicalSameNameRegions.get(name);
  const year = Number(electionYear);
  return sameNameRegion && Number.isInteger(year) && year < sameNameRegion.beforeYear
    ? sameNameRegion : null;
}

function sqlValue(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function valuesSql(rows, columns) {
  return rows.map((row) => `    (${columns.map((column) => sqlValue(row[column])).join(', ')})`).join(',\n');
}

function plannedEventReference(plan) {
  if (plan.action === 'create_new') return eventExternalId(plan.key);
  const externalId = plan.existingCandidates[0]?.externalId;
  if (!externalId) throw new Error(`Canonical election lacks external_id: ${plan.key}`);
  return externalId;
}

export function buildHistoricalElectionRacePlan(preview, regions) {
  const eventPlansByKey = new Map(preview.comparisonPlan.eventPlans.map((plan) => [plan.key, plan]));
  const createEvents = preview.comparisonPlan.eventPlans
    .filter((plan) => plan.action === 'create_new')
    .map((plan) => ({
      externalId: eventExternalId(plan.key),
      contextKey: plan.key,
      name: plan.electionName,
      year: plan.electionYear,
      electionType: plan.electionType,
    }));
  const normalizeEvents = preview.comparisonPlan.eventPlans
    .filter((plan) => plan.action === 'reuse_existing' && plan.existingScope === 'same_scope')
    .map((plan) => {
      const existing = plan.existingCandidates[0];
      if (!existing?.externalId) throw new Error(`Canonical election lacks external_id: ${plan.key}`);
      return {
        externalId: existing.externalId,
        contextKey: plan.key,
        currentName: existing.name,
        currentType: existing.electionType,
        name: plan.electionName,
        electionType: plan.electionType,
      };
    })
    .filter((plan) => plan.currentName !== plan.name || plan.currentType !== plan.electionType);

  const createRaceContexts = preview.comparisonPlan.racePlans.filter((plan) => plan.action === 'create_new');
  const requiredRegionContexts = new Map();
  for (const plan of createRaceContexts.filter((item) => item.regionScope === 'local')) {
    const eventPlan = eventPlansByKey.get(plan.eventContextKey);
    if (!eventPlan) throw new Error(`Missing event plan for region: ${plan.key}`);
    const key = `${plan.historicalGeography}|${eventPlan.electionYear}`;
    requiredRegionContexts.set(key, {
      key,
      name: plan.historicalGeography,
      electionYear: eventPlan.electionYear,
    });
  }
  const createRegionsByExternalId = new Map();
  const regionExternalIds = new Map();
  const orderedRegionContexts = [...requiredRegionContexts.values()]
    .sort((left, right) => left.key.localeCompare(right.key, 'zh-Hant-TW'));
  for (const context of orderedRegionContexts) {
    const definition = historicalRegionDefinition(context.name, context.electionYear);
    if (definition) {
      createRegionsByExternalId.set(definition.externalId, {
        externalId: definition.externalId,
        name: context.name,
        slug: definition.slug,
        regionType: definition.regionType,
      });
      regionExternalIds.set(context.key, definition.externalId);
      continue;
    }
    const existing = preferredRegion(regions, context.name);
    if (existing?.external_id) {
      regionExternalIds.set(context.key, existing.external_id);
      continue;
    }
    throw new Error(`No canonical or historical region plan for: ${context.name}`);
  }
  const createRegions = [...createRegionsByExternalId.values()];

  const createRaces = createRaceContexts.map((plan) => {
    const eventPlan = eventPlansByKey.get(plan.eventContextKey);
    if (!eventPlan) throw new Error(`Missing event plan for race: ${plan.key}`);
    const regionContextKey = `${plan.historicalGeography}|${eventPlan.electionYear}`;
    return {
      externalId: raceExternalId(plan.key),
      contextKey: plan.key,
      eventExternalId: plannedEventReference(eventPlan),
      regionExternalId: plan.regionScope === 'local'
        ? regionExternalIds.get(regionContextKey)
        : null,
      title: plan.raceTitle,
      raceType: plan.raceType,
    };
  });
  const normalizeRaces = preview.comparisonPlan.racePlans
    .filter((plan) => plan.action === 'reuse_existing')
    .map((plan) => {
      const existing = plan.existingCandidates[0];
      if (!existing?.externalId) throw new Error(`Canonical race lacks external_id: ${plan.key}`);
      return {
        externalId: existing.externalId,
        contextKey: plan.key,
        currentTitle: existing.title,
        currentType: existing.raceType,
        title: plan.raceTitle,
        raceType: plan.raceType,
      };
    })
    .filter((plan) => plan.currentTitle !== plan.title || plan.currentType !== plan.raceType);

  const plan = {
    source: { name: sourceName, url: sourceUrl },
    policy: {
      databaseWrites: false,
      transaction: 'ROLLBACK',
      newRecordsPublic: false,
      votingDate: null,
      status: 'completed',
    },
    summary: {
      createRegions: createRegions.length,
      createEvents: createEvents.length,
      normalizeEvents: normalizeEvents.length,
      createRaces: createRaces.length,
      normalizeRaces: normalizeRaces.length,
    },
    createRegions,
    createEvents,
    normalizeEvents,
    createRaces,
    normalizeRaces,
  };
  validatePlan(plan, preview);
  return plan;
}

function validatePlan(plan, preview) {
  const expectedEvents = preview.summary.createNewEventCount;
  const expectedRaces = preview.summary.createNewRaceCount;
  if (plan.createEvents.length !== expectedEvents) {
    throw new Error(`Event count mismatch: expected ${expectedEvents}, got ${plan.createEvents.length}`);
  }
  if (plan.createRaces.length !== expectedRaces) {
    throw new Error(`Race count mismatch: expected ${expectedRaces}, got ${plan.createRaces.length}`);
  }
  for (const [label, rows] of [
    ['region', plan.createRegions],
    ['event', plan.createEvents],
    ['race', plan.createRaces],
  ]) {
    if (new Set(rows.map((row) => row.externalId)).size !== rows.length) {
      throw new Error(`Duplicate proposed ${label} external_id`);
    }
  }
  if (new Set(plan.createRaces.map((row) => row.contextKey)).size !== plan.createRaces.length) {
    throw new Error('Duplicate proposed race context key');
  }
  for (const [label, rows] of [
    ['election normalization', plan.normalizeEvents],
    ['race normalization', plan.normalizeRaces],
  ]) {
    if (new Set(rows.map((row) => row.externalId)).size !== rows.length) {
      throw new Error(`Duplicate ${label} target`);
    }
  }
}

function verificationBlock(plan, label) {
  const checks = [
    ['regions', plan.createRegions.map((row) => row.externalId)],
    ['elections', plan.createEvents.map((row) => row.externalId)],
    ['races', plan.createRaces.map((row) => row.externalId)],
  ].filter(([, ids]) => ids.length > 0);
  const statements = checks.map(([table, ids]) => {
    const array = `ARRAY[${ids.map(sqlValue).join(', ')}]::TEXT[]`;
    return `    IF (SELECT COUNT(*) FROM ${table} WHERE external_id = ANY(${array})) <> ${ids.length} THEN
        RAISE EXCEPTION 'Historical CEC ${label} ${table} count mismatch';
    END IF;`;
  });
  if (plan.normalizeEvents.length > 0) {
    const values = valuesSql(plan.normalizeEvents, ['externalId', 'name', 'electionType']);
    statements.push(`    IF (SELECT COUNT(*)
        FROM elections AS election
        JOIN (VALUES
${values}
        ) AS input(external_id, name, election_type)
          ON election.external_id = input.external_id
         AND election.name = input.name
         AND election.election_type = input.election_type) <> ${plan.normalizeEvents.length} THEN
        RAISE EXCEPTION 'Historical CEC ${label} election normalization mismatch';
    END IF;`);
  }
  if (plan.normalizeRaces.length > 0) {
    const values = valuesSql(plan.normalizeRaces, ['externalId', 'title', 'raceType']);
    statements.push(`    IF (SELECT COUNT(*)
        FROM races AS race
        JOIN (VALUES
${values}
        ) AS input(external_id, title, race_type)
          ON race.external_id = input.external_id
         AND race.title = input.title
         AND race.race_type = input.race_type) <> ${plan.normalizeRaces.length} THEN
        RAISE EXCEPTION 'Historical CEC ${label} race normalization mismatch';
    END IF;`);
  }
  return `DO \$verify\$
BEGIN
${statements.join('\n')}
END
\$verify\$;`;
}

export function renderHistoricalElectionRaceSql(plan, { rollback = true } = {}) {
  const sections = [rollback
    ? '-- Generated historical CEC election/race dry-run. This file always rolls back.'
    : '-- Generated historical CEC election/race migration.'];
  if (rollback) sections.push('BEGIN;');
  if (plan.createRegions.length > 0) {
    const columns = ['externalId', 'name', 'slug', 'regionType'];
    sections.push(`WITH input(external_id, name, slug, region_type) AS (
    VALUES
${valuesSql(plan.createRegions, columns)}
)
INSERT INTO regions (external_id, name, slug, region_type, is_public, updated_at)
SELECT external_id, name, slug, region_type, FALSE, NOW()
FROM input
ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    region_type = EXCLUDED.region_type,
    is_public = FALSE,
    updated_at = NOW();`);
  }
  if (plan.createEvents.length > 0) {
    const columns = ['externalId', 'name', 'year', 'electionType'];
    sections.push(`WITH input(external_id, name, year, election_type) AS (
    VALUES
${valuesSql(plan.createEvents, columns)}
)
INSERT INTO elections (
    external_id, name, year, election_type, voting_date, status,
    source_name, source_url, is_public, updated_at
)
SELECT
    external_id, name, year, election_type, NULL, 'completed',
    ${sqlValue(sourceName)}, ${sqlValue(sourceUrl)}, FALSE, NOW()
FROM input
ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    year = EXCLUDED.year,
    election_type = EXCLUDED.election_type,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    updated_at = NOW();`);
  }
  if (plan.normalizeEvents.length > 0) {
    const columns = ['externalId', 'name', 'electionType'];
    sections.push(`UPDATE elections AS election
SET name = input.name,
    election_type = input.election_type,
    updated_at = NOW()
FROM (VALUES
${valuesSql(plan.normalizeEvents, columns)}
) AS input(external_id, name, election_type)
WHERE election.external_id = input.external_id;`);
  }
  if (plan.createRaces.length > 0) {
    const columns = ['externalId', 'eventExternalId', 'regionExternalId', 'raceType', 'title'];
    sections.push(`WITH input(external_id, event_external_id, region_external_id, race_type, title) AS (
    VALUES
${valuesSql(plan.createRaces, columns)}
)
INSERT INTO races (
    external_id, election_id, region_id, race_type, title, voting_date,
    status, source_name, source_url, is_public, updated_at
)
SELECT
    input.external_id,
    election.id,
    region.id,
    input.race_type,
    input.title,
    NULL,
    'completed',
    ${sqlValue(sourceName)},
    ${sqlValue(sourceUrl)},
    FALSE,
    NOW()
FROM input
JOIN elections AS election ON election.external_id = input.event_external_id
LEFT JOIN regions AS region ON region.external_id = input.region_external_id
WHERE input.region_external_id IS NULL OR region.id IS NOT NULL
ON CONFLICT (external_id) DO UPDATE SET
    election_id = EXCLUDED.election_id,
    region_id = EXCLUDED.region_id,
    race_type = EXCLUDED.race_type,
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    updated_at = NOW();`);
  }
  if (plan.normalizeRaces.length > 0) {
    const columns = ['externalId', 'title', 'raceType'];
    sections.push(`UPDATE races AS race
SET title = input.title,
    race_type = input.race_type,
    updated_at = NOW()
FROM (VALUES
${valuesSql(plan.normalizeRaces, columns)}
) AS input(external_id, title, race_type)
WHERE race.external_id = input.external_id;`);
  }
  sections.push(
    verificationBlock(plan, rollback ? 'dry-run' : 'migration'),
    `SELECT
    ${plan.createRegions.length} AS planned_regions,
    ${plan.createEvents.length} AS planned_elections,
    ${plan.normalizeEvents.length} AS normalized_elections,
    ${plan.createRaces.length} AS planned_races,
    ${plan.normalizeRaces.length} AS normalized_races;`,
  );
  if (rollback) sections.push('ROLLBACK;');
  else sections.push('SELECT published.promote(NULL);');
  return `${sections.join('\n\n')}\n`;
}

async function fetchRegions(config) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/regions`);
    url.searchParams.set('select', 'id,external_id,name,slug,region_type');
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
    if (!response.ok) throw new Error(`Failed to fetch regions: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < 1000) return rows;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.previewPath)) {
    throw new Error('Run preview:historical-cec-core -- --write first.');
  }
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for the historical migration dry-run.');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('Historical migration generation only reads the local Supabase instance.');
  }

  const preview = JSON.parse(fs.readFileSync(options.previewPath, 'utf8'));
  const plan = buildHistoricalElectionRacePlan(preview, await fetchRegions(config));
  const sql = renderHistoricalElectionRaceSql(plan);
  if (options.write) {
    fs.mkdirSync(path.dirname(options.planPath), { recursive: true });
    fs.mkdirSync(path.dirname(options.sqlPath), { recursive: true });
    fs.writeFileSync(options.planPath, `${JSON.stringify(plan, null, 2)}\n`);
    fs.writeFileSync(options.sqlPath, sql);
  }
  if (options.migrationPath) {
    fs.mkdirSync(path.dirname(options.migrationPath), { recursive: true });
    fs.writeFileSync(options.migrationPath, renderHistoricalElectionRaceSql(plan, { rollback: false }));
  }
  console.log(JSON.stringify({
    outputPlan: options.write ? path.relative(repoRoot, options.planPath) : null,
    outputSql: options.write ? path.relative(repoRoot, options.sqlPath) : null,
    outputMigration: options.migrationPath ? path.relative(repoRoot, options.migrationPath) : null,
    ...plan.summary,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`historical election/race migration preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
