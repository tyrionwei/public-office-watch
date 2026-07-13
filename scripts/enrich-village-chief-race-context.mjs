import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSeedPath = path.join(repoRoot, 'data-sources', 'votetw-election-history.village-chief.seed.json');

const countiesAndCities = [
  '臺北市',
  '台北市',
  '新北市',
  '桃園市',
  '臺中市',
  '台中市',
  '臺南市',
  '台南市',
  '高雄市',
  '基隆市',
  '新竹市',
  '嘉義市',
  '宜蘭縣',
  '新竹縣',
  '苗栗縣',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義縣',
  '屏東縣',
  '臺東縣',
  '台東縣',
  '花蓮縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
].sort((left, right) => right.length - left.length);

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
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '') : '';
        return [key, value];
      }),
  );
}

function parseArgs(argv) {
  const options = {
    seedPath: defaultSeedPath,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--seed') {
      options.seedPath = path.resolve(argv[index + 1] ?? '');
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

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function requireSupabaseConfig() {
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment or .env.local');
  }
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(tableName, select, params = {}) {
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    }

    rows.push(...body);
    if (body.length < pageSize) {
      return rows;
    }
  }
}

async function upsertRows(tableName, rows, conflictKey) {
  if (rows.length === 0) {
    return [];
  }

  const url = restUrl(tableName);
  url.searchParams.set('on_conflict', conflictKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to upsert ${tableName}: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function patchRowById(tableName, row) {
  const { id, ...payload } = row;
  const url = restUrl(tableName);
  url.searchParams.set('id', `eq.${id}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to patch ${tableName} ${id}: ${body || response.statusText}`);
  }

  return row;
}

async function patchRowsById(tableName, rows) {
  const updatedRows = [];
  for (const batch of chunk(rows, 20)) {
    updatedRows.push(...await Promise.all(batch.map((row) => patchRowById(tableName, row))));
  }
  return updatedRows;
}

function chunk(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function stableHash(value, length = 14) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, length);
}

function normalizeVillageName(title) {
  return String(title ?? '').replace(/（[^）]+）$/u, '').trim();
}

function parsePageTitle(pageTitle) {
  const match = String(pageTitle ?? '').match(/^(\d{4})年村里長選舉(.+?)投票結果$/u);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const location = match[2];
  const countyOrCity = countiesAndCities.find((item) => location.startsWith(item));
  if (!countyOrCity) {
    return null;
  }

  const townshipOrDistrict = location.slice(countyOrCity.length);
  if (!townshipOrDistrict) {
    return null;
  }

  return { year, countyOrCity, townshipOrDistrict };
}

function officeNameForVillage(villageName) {
  if (villageName.endsWith('村')) {
    return '村長';
  }
  if (villageName.endsWith('里')) {
    return '里長';
  }
  return '村里長';
}

function buildSeedContext(seed) {
  const firstCandidateByRace = new Map();
  for (const candidate of seed.candidates ?? []) {
    if (!firstCandidateByRace.has(candidate.raceExternalId)) {
      firstCandidateByRace.set(candidate.raceExternalId, candidate);
    }
  }

  const contextByRaceExternalId = new Map();
  const parseFailures = [];
  for (const race of seed.races ?? []) {
    const candidate = firstCandidateByRace.get(race.externalId);
    const pageTitle = candidate?.sourcePayload?.voteTwElectionPageTitle;
    const parsedPage = parsePageTitle(pageTitle);
    const villageName = normalizeVillageName(race.title);

    if (!parsedPage || !villageName) {
      parseFailures.push({ externalId: race.externalId, title: race.title, pageTitle });
      continue;
    }

    const fullRegionName = `${parsedPage.countyOrCity}${parsedPage.townshipOrDistrict}${villageName}`;
    const officeName = officeNameForVillage(villageName);
    contextByRaceExternalId.set(race.externalId, {
      sourceRaceTitle: race.title,
      pageTitle,
      year: parsedPage.year,
      countyOrCity: parsedPage.countyOrCity,
      townshipOrDistrict: parsedPage.townshipOrDistrict,
      villageName,
      fullRegionName,
      fullRaceTitle: `${parsedPage.year}年${fullRegionName}${officeName}選舉`,
      regionExternalId: `votetw-region-full-${stableHash(fullRegionName)}`,
      regionSlug: `votetw-${stableHash(fullRegionName)}`,
    });
  }

  return { contextByRaceExternalId, parseFailures };
}

function needsRaceUpdate(race, context) {
  return race.title !== context.fullRaceTitle || race.region_id !== context.regionId;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  requireSupabaseConfig();

  const seed = JSON.parse(fs.readFileSync(options.seedPath, 'utf8'));
  const { contextByRaceExternalId, parseFailures } = buildSeedContext(seed);
  const villageRaces = await fetchRows(
    'races',
    'id,external_id,title,region_id,race_type,is_public',
    {
      race_type: 'eq.village_chief',
      is_public: 'eq.true',
    },
  );
  const existingFullRegions = await fetchRows(
    'regions',
    'id,external_id,name,slug,region_type,is_public',
    {
      external_id: 'like.votetw-region-full-%',
    },
  );
  const fullRegionByExternalId = new Map(existingFullRegions.map((region) => [region.external_id, region]));

  const missingSeedContext = [];
  const uniqueRegionRowsByExternalId = new Map();
  for (const race of villageRaces) {
    const context = contextByRaceExternalId.get(race.external_id);
    if (!context) {
      missingSeedContext.push(race);
      continue;
    }

    if (!uniqueRegionRowsByExternalId.has(context.regionExternalId)) {
      uniqueRegionRowsByExternalId.set(context.regionExternalId, {
        external_id: context.regionExternalId,
        name: context.fullRegionName,
        slug: context.regionSlug,
        region_type: 'village',
        is_public: true,
      });
    }
  }

  const regionRows = [...uniqueRegionRowsByExternalId.values()];
  const newRegionRows = regionRows.filter((row) => !fullRegionByExternalId.has(row.external_id));
  const changedRegionRows = regionRows.filter((row) => {
    const existing = fullRegionByExternalId.get(row.external_id);
    return existing && (existing.name !== row.name || existing.slug !== row.slug || existing.region_type !== row.region_type || existing.is_public !== true);
  });

  let upsertedRegionRows = [];
  if (options.write) {
    for (const rows of chunk([...newRegionRows, ...changedRegionRows], 500)) {
      upsertedRegionRows.push(...await upsertRows('regions', rows, 'external_id'));
    }
  }

  const finalRegionByExternalId = new Map(fullRegionByExternalId);
  for (const region of upsertedRegionRows) {
    finalRegionByExternalId.set(region.external_id, region);
  }

  const regionIdsMissingForRace = [];
  const raceUpdates = [];
  for (const race of villageRaces) {
    const context = contextByRaceExternalId.get(race.external_id);
    if (!context) {
      continue;
    }

    const region = finalRegionByExternalId.get(context.regionExternalId);
    if (!region?.id) {
      regionIdsMissingForRace.push({ race, context });
      if (!options.write && (race.title !== context.fullRaceTitle || !race.region_id)) {
        raceUpdates.push({
          id: race.id,
          title: context.fullRaceTitle,
          region_id: null,
          updated_at: new Date().toISOString(),
        });
      }
      continue;
    }

    context.regionId = region.id;
    if (needsRaceUpdate(race, context)) {
      raceUpdates.push({
        id: race.id,
        title: context.fullRaceTitle,
        region_id: context.regionId,
        updated_at: new Date().toISOString(),
      });
    }
  }

  let updatedRaceRows = [];
  if (options.write) {
    updatedRaceRows = await patchRowsById('races', raceUpdates);
  }

  const sampleRaceUpdates = raceUpdates.slice(0, 10).map((update) => {
    const before = villageRaces.find((race) => race.id === update.id);
    return {
      id: update.id,
      externalId: before?.external_id,
      beforeTitle: before?.title,
      afterTitle: update.title,
    };
  });

  console.log(JSON.stringify({
    status: 'ok',
    dryRun: !options.write,
    seedRaceContexts: contextByRaceExternalId.size,
    seedParseFailures: parseFailures.length,
    publicVillageChiefRaces: villageRaces.length,
    racesMissingSeedContext: missingSeedContext.length,
    fullVillageRegionsNeeded: regionRows.length,
    fullVillageRegionsExisting: existingFullRegions.length,
    fullVillageRegionsToInsert: newRegionRows.length,
    fullVillageRegionsToUpdate: changedRegionRows.length,
    racesMissingFullRegionId: regionIdsMissingForRace.length,
    raceRowsToUpdate: raceUpdates.length,
    insertedOrUpdatedRegionRows: upsertedRegionRows.length,
    updatedRaceRows: updatedRaceRows.length,
    sampleRaceUpdates,
    sampleParseFailures: parseFailures.slice(0, 5),
    sampleMissingSeedContext: missingSeedContext.slice(0, 5).map((race) => ({
      id: race.id,
      externalId: race.external_id,
      title: race.title,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
