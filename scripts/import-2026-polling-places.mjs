import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { taiwanDistrictsByCountyCode } from '../apps/web/src/data/generated/taiwanDistrictDirectory.ts';
import { taiwanVillagesByDistrictCode } from '../apps/web/src/data/generated/taiwanVillageDirectory.ts';
import { parseNeighborhoods, validatePollingAssignments } from './polling-place-normalization.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repoRoot, 'tmp', 'polling-places-2026');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const compact = (value) => String(value ?? '').normalize('NFKC')
  .replace(/\\n/g, '')
  .replace(/[\s\[\]]+/g, '')
  .replace(/\(開\)/g, '開');

function findHeaderIndex(header, pattern) {
  return header.findIndex((value) => pattern.test(value));
}

export function parseOdsPollingPlaces(sheets, source, {
  districtsByCountyCode = taiwanDistrictsByCountyCode,
  villagesByDistrictCode = taiwanVillagesByDistrictCode,
} = {}) {
  const places = [];
  const countyName = compact(source.name);
  const districtAliases = source.district_aliases ?? {};
  const villageAliases = source.village_aliases ?? {};
  let parsedSheetCount = 0;

  for (const sheet of sheets) {
    const headerRowIndex = sheet.rows.findIndex((row) => row.some((cell) => compact(cell).includes('投開票所編號')));
    if (headerRowIndex < 0) continue;
    const header = sheet.rows[headerRowIndex].map(compact);
    const columns = {
      station: findHeaderIndex(header, /投開票所編號/),
      name: findHeaderIndex(header, /投開票所名稱/),
      address: findHeaderIndex(header, /投開票所地址/),
      village: findHeaderIndex(header, /(?:一般選舉人)?所屬(?:村里|里別)/),
      neighborhood: findHeaderIndex(header, /(?:一般選舉人)?所屬鄰別/),
    };
    const missingColumns = Object.entries(columns).filter(([, index]) => index < 0).map(([name]) => name);
    if (missingColumns.length) {
      throw new Error(`Official ODS is missing required columns (${missingColumns.join(', ')}) for ${source.name}`);
    }
    parsedSheetCount += 1;

    for (let index = headerRowIndex + 1; index < sheet.rows.length; index += 1) {
      const row = sheet.rows[index];
      const stationLabel = compact(row[columns.station]);
      if (!/第\d+投開票所$/.test(stationLabel)) continue;
      const match = new RegExp(`^(?:${countyName})?(.+?(?:區|市|鎮|鄉|線))第(\\d+)投開票所$`).exec(stationLabel);
      if (!match) throw new Error(`Unexpected station label for ${source.name} at row ${index + 1}: ${stationLabel}`);

      const rawDistrictName = match[1];
      const districtName = districtAliases[rawDistrictName] ?? rawDistrictName;
      const district = (districtsByCountyCode[source.county_code] ?? [])
        .find((item) => compact(item.name) === compact(districtName));
      if (!district) throw new Error(`Unknown district for ${source.name} at row ${index + 1}: ${rawDistrictName}`);

      const rawVillageName = String(row[columns.village] ?? '').trim();
      if (!rawVillageName) continue;
      const aliasKey = districtName + ':' + rawVillageName;
      const villageName = villageAliases[aliasKey] ?? rawVillageName;
      const villageMatches = (villagesByDistrictCode[district.code] ?? [])
        .filter((item) => compact(item.name) === compact(villageName));
      const stationName = String(row[columns.name] ?? '').replace(/\s+/g, ' ').trim();
      const address = String(row[columns.address] ?? '').replace(/\s+/g, ' ').trim();
      if (villageMatches.length !== 1 || !stationName || !address) {
        throw new Error(`Unresolved station for ${source.name} at row ${index + 1}: ${stationLabel} / ${rawVillageName}`);
      }

      const sourceRawNeighborhoods = String(row[columns.neighborhood] ?? '').trim();
      const rawNeighborhoods = sourceRawNeighborhoods.startsWith('需覆核:')
        ? '官方鄰別條件需人工覆核'
        : sourceRawNeighborhoods;
      const parsedNeighborhoods = (source.ambiguous_station_numbers ?? []).includes(match[2])
        ? { coverage_kind: "ambiguous", neighborhoods: [] }
        : parseNeighborhoods(sourceRawNeighborhoods);
      const village = villageMatches[0];
      places.push({
        id: createHash('sha256').update(source.source_hash + ':' + match[2] + ':' + village.code).digest('hex').slice(0, 32),
        source_id: source.source_hash.slice(0, 32),
        district_code: district.code,
        village_code: village.code,
        village_name: rawVillageName,
        station_no: match[2],
        station_name: stationName,
        address,
        raw_neighborhoods: rawNeighborhoods,
        source_raw_neighborhoods: sourceRawNeighborhoods,
        ...parsedNeighborhoods,
        source_row: index + 1,
      });
    }
  }

  if (parsedSheetCount === 0 || places.length === 0) {
    throw new Error("No polling-place rows found for " + source.name);
  }

  const mergedPlaces = [];
  const assignments = new Map();
  for (const place of places) {
    const key = place.station_no + ":" + place.village_code;
    const existing = assignments.get(key);
    if (!existing) {
      assignments.set(key, place);
      mergedPlaces.push(place);
      continue;
    }
    if (existing.station_name !== place.station_name || existing.address !== place.address) {
      throw new Error("Conflicting repeated station assignment: " + key);
    }
    existing.raw_neighborhoods = Array.from(new Set(
      [existing.raw_neighborhoods, place.raw_neighborhoods].filter(Boolean),
    )).join("；");
    if (existing.coverage_kind === "neighborhoods" && place.coverage_kind === "neighborhoods") {
      existing.neighborhoods = Array.from(new Set([...existing.neighborhoods, ...place.neighborhoods]))
        .sort((left, right) => left - right);
    } else if (existing.coverage_kind !== place.coverage_kind) {
      existing.coverage_kind = "ambiguous";
      existing.neighborhoods = [];
    }
  }
  if (source.adapter === "cec-pdf-layout-2026") {
    const conflicting = new Set();
    const byVillage = Map.groupBy(mergedPlaces, (place) => place.village_code);
    for (const assignmentsForVillage of byVillage.values()) {
      if (assignmentsForVillage.length > 1 && assignmentsForVillage.some(
        (place) => ["whole_village", "unpartitioned"].includes(place.coverage_kind),
      )) {
        assignmentsForVillage.forEach((place) => conflicting.add(place));
      }
      const owners = new Map();
      for (const place of assignmentsForVillage) {
        for (const number of place.neighborhoods) {
          const owner = owners.get(number);
          if (owner) {
            conflicting.add(owner);
            conflicting.add(place);
          } else {
            owners.set(number, place);
          }
        }
      }
    }
    for (const place of conflicting) {
      place.coverage_kind = "ambiguous";
      place.neighborhoods = [];
    }
  }
  validatePollingAssignments(mergedPlaces);
  return mergedPlaces;
}

export function validatePdfSourceExpectations(source) {
  if (source.adapter !== 'cec-pdf-layout-2026') return;
  if (!Number.isInteger(source.expected_station_count) || source.expected_station_count <= 0) {
    throw new Error('Missing expected PDF station count for ' + source.name);
  }
  if (typeof source.expected_last_station_no !== 'string' || !/^\d{4}$/.test(source.expected_last_station_no)) {
    throw new Error('Missing expected PDF last station number for ' + source.name);
  }
  if (Number(source.expected_last_station_no) !== source.expected_station_count) {
    throw new Error('PDF station count and last station number disagree for ' + source.name);
  }
}

export function validatePollingPlaceExpectations(places, source) {
  for (const expected of source.regression_expectations ?? []) {
    const matches = places.filter((place) => place.station_no === expected.station_no);
    if (matches.length !== 1) {
      throw new Error(`Expected one polling-place row for ${source.name} station ${expected.station_no}`);
    }
    const place = matches[0];
    for (const [field, value] of Object.entries(expected)) {
      if (JSON.stringify(place[field]) !== JSON.stringify(value)) {
        throw new Error(
          `Polling-place regression for ${source.name} station ${expected.station_no} field ${field}`,
        );
      }
    }
  }
}

const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const sqlDate = (value) => value ? quote(value) + '::date' : 'NULL';

export function buildPollingPlaceSyncSql(registry, snapshots, { apply = false } = {}) {
  const statements = ['BEGIN;'];
  for (const { source, places, fetchedAt } of snapshots) {
    const sourceId = source.source_hash.slice(0, 32);
    const tableName = 'polling_input_' + source.county_code;
    const neighborhoodCount = places.reduce((sum, place) => sum + place.neighborhoods.length, 0);
    statements.push(`
DO $check$ BEGIN
 IF EXISTS (
   SELECT 1 FROM public.polling_place_sources
   WHERE event_key=${quote(registry.event_key)} AND county_code=${quote(source.county_code)}
     AND is_current AND published_on > ${sqlDate(source.published_on)}
 ) THEN RAISE EXCEPTION 'Refusing to replace a newer official source for ${source.county_code}'; END IF;
END; $check$;
UPDATE public.polling_place_sources SET is_current=FALSE
 WHERE event_key=${quote(registry.event_key)} AND county_code=${quote(source.county_code)}
   AND is_current AND id<>${quote(sourceId)}::uuid;
INSERT INTO public.polling_place_sources(
 id,event_key,voting_date,county_code,source_name,source_url,published_on,fetched_at,source_hash,format,is_public,is_current
) VALUES (
 ${quote(sourceId)},${quote(registry.event_key)},${quote(registry.voting_date)},${quote(source.county_code)},
 ${quote(source.source_name)},${quote(source.source_url)},${sqlDate(source.published_on)},${quote(fetchedAt)},
 ${quote(source.source_hash)},${quote(source.format)},TRUE,TRUE
)
ON CONFLICT (id) DO UPDATE SET
 event_key=EXCLUDED.event_key,voting_date=EXCLUDED.voting_date,county_code=EXCLUDED.county_code,
 source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,published_on=EXCLUDED.published_on,
 fetched_at=EXCLUDED.fetched_at,source_hash=EXCLUDED.source_hash,format=EXCLUDED.format,
 is_public=TRUE,is_current=TRUE;
CREATE TEMP TABLE ${tableName} ON COMMIT DROP AS
 SELECT * FROM jsonb_to_recordset(${quote(JSON.stringify(places))}::jsonb) AS x(
   id uuid,source_id uuid,district_code text,village_code text,village_name text,station_no text,
   station_name text,address text,coverage_kind text,raw_neighborhoods text,source_row integer,neighborhoods jsonb
 );
DELETE FROM public.polling_places WHERE source_id=${quote(sourceId)}::uuid;
INSERT INTO public.polling_places(
 id,source_id,district_code,village_code,village_name,station_no,station_name,address,coverage_kind,raw_neighborhoods,source_row
)
 SELECT id,source_id,district_code,village_code,village_name,station_no,station_name,address,coverage_kind,raw_neighborhoods,source_row
 FROM ${tableName};
INSERT INTO public.polling_place_neighborhoods(polling_place_id,neighborhood_no)
 SELECT input.id,number.value::smallint
 FROM ${tableName} input CROSS JOIN LATERAL jsonb_array_elements_text(input.neighborhoods) number;
DO $verify$ BEGIN
 IF (SELECT count(*) FROM public.polling_places WHERE source_id=${quote(sourceId)}::uuid) <> ${places.length}
 THEN RAISE EXCEPTION 'Polling-place count mismatch for ${source.county_code}'; END IF;
 IF (
   SELECT count(*) FROM public.polling_place_neighborhoods neighborhood
   JOIN public.polling_places place ON place.id=neighborhood.polling_place_id
   WHERE place.source_id=${quote(sourceId)}::uuid
 ) <> ${neighborhoodCount}
 THEN RAISE EXCEPTION 'Neighborhood count mismatch for ${source.county_code}'; END IF;
END; $verify$;`);
  }
  statements.push(apply ? 'COMMIT;' : 'ROLLBACK;');
  return statements.join('\n');
}

function parseArgs(argv) {
  const options = { applyLocal: false, countyCodes: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply-local') options.applyLocal = true;
    else if (argument === '--county-code') options.countyCodes.push(argv[++index] ?? '');
    else if (argument === '--all-ready') options.countyCodes = [];
    else throw new Error('Unsupported argument: ' + argument);
  }
  return options;
}

async function ensureSourceFile(source) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const filePath = path.join(outputDirectory, source.slug + '.' + source.format);
  if (!fs.existsSync(filePath)) {
    const response = await fetch(source.file_url);
    if (!response.ok) throw new Error(`Official ${source.format.toUpperCase()} download failed for ${source.name}: ${response.status}`);
    fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  }
  const hash = sha256(fs.readFileSync(filePath));
  if (hash !== source.source_hash) throw new Error('Official file changed; review the source manifest before importing ' + source.name);
  return filePath;
}

async function loadSnapshot(source) {
  validatePdfSourceExpectations(source);
  const filePath = await ensureSourceFile(source);
  const rowsPath = path.join(outputDirectory, source.slug + '.rows.json');
  if (source.adapter === "cec-ods-2026") {
    execFileSync("python3", [path.join(repoRoot, "scripts", "extract-polling-places-ods.py"), filePath, rowsPath]);
  } else if (source.adapter === "cec-pdf-layout-2026") {
    execFileSync("python3", [
      path.join(repoRoot, "scripts", "extract-polling-places-pdf.py"),
      filePath, rowsPath,
      "--county-code", source.county_code,
      "--expected-station-count", String(source.expected_station_count),
      "--expected-last-station-no", source.expected_last_station_no,
    ]);
  } else {
    throw new Error("Unsupported polling-place adapter: " + source.adapter);
  }
  const places = parseOdsPollingPlaces(readJson(rowsPath), source);
  validatePollingPlaceExpectations(places, source);
  const summary = {
    county_code: source.county_code,
    name: source.name,
    source_rows: places.length,
    villages: new Set(places.map((place) => place.village_code)).size,
    neighborhood_assignments: places.reduce((sum, place) => sum + place.neighborhoods.length, 0),
    ambiguous: places.filter((place) => place.coverage_kind === 'ambiguous')
      .map((place) => ({ station: place.station_no, village: place.village_name, raw: place.raw_neighborhoods })),
    whole_village: places.filter((place) => place.coverage_kind === 'whole_village').length,
  };
  fs.writeFileSync(path.join(outputDirectory, source.slug + '.normalized.json'), JSON.stringify({ source, places }, null, 2));
  fs.writeFileSync(path.join(outputDirectory, source.slug + '.validation.json'), JSON.stringify(summary, null, 2));
  return { source, places, fetchedAt: fs.statSync(filePath).mtime.toISOString(), summary };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const registry = readJson(path.join(repoRoot, 'data-sources', '2026-polling-places.json'));
  const eligible = registry.counties.filter((source) => source.status === "ready" && ["cec-ods-2026", "cec-pdf-layout-2026"].includes(source.adapter));
  const selected = options.countyCodes.length
    ? eligible.filter((source) => options.countyCodes.includes(source.county_code))
    : eligible;
  if (!selected.length || (options.countyCodes.length && selected.length !== new Set(options.countyCodes).size)) {
    throw new Error('No ready polling-place source found for one or more requested county codes');
  }
  const snapshots = [];
  for (const source of selected) snapshots.push(await loadSnapshot(source));
  const aggregate = {
    county_count: snapshots.length,
    source_rows: snapshots.reduce((sum, item) => sum + item.places.length, 0),
    villages: snapshots.reduce((sum, item) => sum + item.summary.villages, 0),
    neighborhood_assignments: snapshots.reduce((sum, item) => sum + item.summary.neighborhood_assignments, 0),
    ambiguous: snapshots.reduce((sum, item) => sum + item.summary.ambiguous.length, 0),
    counties: snapshots.map((item) => item.summary),
  };
  fs.writeFileSync(path.join(outputDirectory, 'validation.json'), JSON.stringify(aggregate, null, 2));
  console.log(JSON.stringify(aggregate, null, 2));

  if (!fs.readFileSync(path.join(repoRoot, 'supabase', 'config.toml'), 'utf8').includes('project_id = "public-office-watch"')) {
    throw new Error('Unexpected local project');
  }
  const sql = buildPollingPlaceSyncSql(registry, snapshots, { apply: options.applyLocal });
  console.log(execFileSync('docker', ['exec', '-i', 'supabase_db_public-office-watch',
    'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { input: sql, encoding: 'utf8' }));
  return aggregate;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
