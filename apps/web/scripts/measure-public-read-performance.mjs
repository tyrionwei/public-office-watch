import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '../..');
const args = process.argv.slice(2);
const explainRequested = args.includes('--explain') || args.includes('--analyze');
const analyzeRequested = args.includes('--analyze');
const outputIndex = args.indexOf('--output');
const defaultOutput = path.join(repoRoot, 'tmp', 'performance', `public-read-baseline-${new Date().toISOString().replaceAll(':', '-')}.json`);
const outputPath = outputIndex === -1 ? defaultOutput : path.resolve(process.cwd(), args[outputIndex + 1] ?? '');

function parseEnv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    env[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function getConfig() {
  const envPath = path.join(webRoot, '.env.local');
  const localEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
  const url = process.env.VITE_SUPABASE_URL?.trim() || localEnv.VITE_SUPABASE_URL?.trim() || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || localEnv.VITE_SUPABASE_ANON_KEY?.trim() || '';
  if (!url || !anonKey) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before measuring public reads.');
  const normalizedKey = anonKey.toLowerCase();
  if (normalizedKey.includes('service_role') || normalizedKey.includes('service-role')) {
    throw new Error('Performance measurements must use the frontend anon key, not a service-role key.');
  }
  return { url, anonKey };
}

function dataOrThrow(response, label) {
  if (response.error) throw new Error(`${label}: ${response.error.code ?? 'unknown'} ${response.error.message}`);
  return response.data;
}

function planSummary(data) {
  const root = Array.isArray(data) ? data[0] : data;
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    for (const child of node.Plans ?? []) visit(child);
  }
  visit(root?.Plan);
  return {
    planningMs: root?.['Planning Time'] ?? null,
    executionMs: root?.['Execution Time'] ?? null,
    rootNodeType: root?.Plan?.['Node Type'] ?? null,
    actualRows: root?.Plan?.['Actual Rows'] ?? null,
    sequentialScans: nodes.filter((node) => node['Node Type'] === 'Seq Scan').map((node) => node['Relation Name'] ?? null),
    indexScans: nodes
      .filter((node) => ['Index Scan', 'Index Only Scan', 'Bitmap Index Scan'].includes(node['Node Type']))
      .map((node) => node['Index Name'] ?? node['Relation Name'] ?? null),
    sharedReadBlocks: nodes.reduce((total, node) => total + (node['Shared Read Blocks'] ?? 0), 0),
    sharedHitBlocks: nodes.reduce((total, node) => total + (node['Shared Hit Blocks'] ?? 0), 0),
  };
}

async function loadAnchors(client) {
  const [candidateResponse, regionResponse, eventResponse, peopleResponse] = await Promise.all([
    client.from('public_candidates').select('person_id,election_id,race_id').not('person_id', 'is', null).limit(1),
    client
      .from('public_regions')
      .select('region_id,name,region_type,display_order')
      .in('region_type', ['municipality', 'county', 'city'])
      .order('display_order', { ascending: true, nullsFirst: false })
      .limit(1),
    client.from('public_election_race_list').select('event_key').limit(1),
    client
      .from('public_people_directory')
      .select('person_id')
      .eq('list_is_grassroots', false)
      .eq('list_is_party_only', false)
      .order('list_status_order')
      .order('list_role_order')
      .order('name')
      .range(0, 199),
  ]);
  const candidate = dataOrThrow(candidateResponse, 'candidate anchor')?.[0];
  const region = dataOrThrow(regionResponse, 'region anchor')?.[0];
  const event = dataOrThrow(eventResponse, 'election event anchor')?.[0] ?? null;
  const people = dataOrThrow(peopleResponse, 'people page anchor') ?? [];
  if (!candidate?.person_id || !candidate.election_id || !candidate.race_id) {
    throw new Error('Could not find a public candidate anchor with person, election, and race IDs.');
  }
  if (!region?.region_id || !region.name) throw new Error('Could not find a county/city public region anchor.');
  return {
    personId: candidate.person_id,
    electionId: candidate.election_id,
    raceId: candidate.race_id,
    regionId: region.region_id,
    regionName: region.name,
    eventKey: event?.event_key ?? null,
    peopleIds: people.map((person) => person.person_id).filter(Boolean),
    searchQuery: '台北',
  };
}

function makeQueries(anchor) {
  const q = (page, label, build, paginate = true) => ({ page, label, build, paginate });
  const homeTypes = ['country', 'municipality', 'county', 'city'];
  const regionLabels = Array.from(new Set([
    anchor.regionName,
    anchor.regionName.replace(/臺/g, '台'),
    anchor.regionName.replace(/台/g, '臺'),
  ]));
  const pattern = `%${anchor.searchQuery}%`;
  const queries = [
    q('home', 'ticker', (client) => client.from('public_home_election_ticker').select('*').range(0, 999)),
    q('home', 'region summaries', (client) => client.from('public_region_election_summary').select('*').in('region_type', homeTypes).range(0, 999)),
    q('home', 'regions', (client) => client.from('public_regions').select('*').in('region_type', homeTypes).range(0, 999)),
    q('home', 'upcoming races', (client) => client.from('public_races').select('*').neq('status', 'completed').range(0, 999)),
    q('home', 'parties', (client) => client.from('public_parties').select('*').range(0, 999)),
    q('home', 'party finance summaries', (client) => client.from('public_party_finance_summaries').select('*').range(0, 999)),
    q('home', 'party company contribution summaries', (client) => client.from('public_party_company_contribution_summaries').select('*').range(0, 999)),
    q('region', 'local office people', (client) => client
      .from('public_people_list_cached')
      .select('*')
      .or(regionLabels.map((label) => `district.ilike.${label}%`).join(','))
      .range(0, 999)),
    q('election-index', 'elections', (client) => client.from('public_elections').select('*').range(0, 999)),
    q('election-index', 'race summaries', (client) => client.from('public_election_race_summaries').select('*').range(0, 999)),
    q('election-detail', 'election', (client) => client.from('public_elections').select('*').eq('election_id', anchor.electionId).range(0, 999)),
    q('election-detail', 'races', (client) => client.from('public_races').select('*').eq('election_id', anchor.electionId).range(0, 999)),
    q('election-detail', 'candidates', (client) => client.from('public_candidates').select('*').eq('election_id', anchor.electionId).range(0, 999)),
    q('person-list', 'directory block with exact count', (client) => client
      .from('public_people_directory')
      .select('*', { count: 'exact' })
      .eq('list_is_grassroots', false)
      .eq('list_is_party_only', false)
      .order('list_status_order')
      .order('list_role_order')
      .order('name')
      .range(0, 199), false),
    q('person-list', 'candidate lookup for directory block', (client) => client
      .from('public_candidates')
      .select('*')
      .in('person_id', anchor.peopleIds)
      .range(0, 999)),
    q('person-detail', 'person', (client) => client.from('public_people_list_cached').select('*').eq('person_id', anchor.personId).range(0, 999)),
    q('person-detail', 'candidacies', (client) => client.from('public_candidates').select('*').eq('person_id', anchor.personId).range(0, 999)),
    q('person-detail', 'claims', (client) => client.from('public_person_claims').select('*').eq('person_id', anchor.personId).range(0, 999)),
    q('person-detail', 'party affiliations', (client) => client.from('public_person_party_affiliations').select('*').eq('person_id', anchor.personId).range(0, 999)),
    q('search', 'people search', (client) => client
      .from('public_people_list_cached')
      .select('*')
      .or([
        `name.ilike.${pattern}`,
        `alias.ilike.${pattern}`,
        `party.ilike.${pattern}`,
        `position.ilike.${pattern}`,
        `district.ilike.${pattern}`,
      ].join(','))
      .limit(12), false),
    q('search', 'election search', (client) => client.from('public_elections').select('*').ilike('name', pattern).limit(12), false),
    q('search', 'company search', (client) => client
      .from('public_companies')
      .select('*')
      .or([
        `name.ilike.${pattern}`,
        `unified_business_no.ilike.${pattern}`,
        `representative_name.ilike.${pattern}`,
        `address_region.ilike.${pattern}`,
      ].join(','))
      .limit(12), false),
  ];
  if (anchor.eventKey) {
    queries.push(q('election-event', 'race page block with exact count', (client) => client
      .from('public_election_race_list')
      .select('*', { count: 'exact' })
      .eq('event_key', anchor.eventKey)
      .order('sort_category_order')
      .order('sort_region_order')
      .order('sort_district_order', { nullsFirst: true })
      .order('region_name', { nullsFirst: true })
      .order('title')
      .order('race_id')
      .range(0, 199), false));
  }
  return queries;
}

async function executeQuery(client, page, query) {
  const started = performance.now();
  let offset = 0;
  let rows = 0;
  let responseBytes = 0;
  let exactCount = null;
  let status = null;
  let requests = 0;

  while (true) {
    const request = query.paginate
      ? query.build(client).range(offset, offset + 999)
      : query.build(client);
    const response = await request;
    const data = dataOrThrow(response, `${page}/${query.label}`);
    const pageRows = Array.isArray(data) ? data.length : data == null ? 0 : 1;
    rows += pageRows;
    responseBytes += Buffer.byteLength(JSON.stringify(data ?? null), 'utf8');
    exactCount = response.count ?? exactCount;
    status = response.status;
    requests += 1;

    if (!query.paginate || pageRows < 1000) break;
    offset += 1000;
  }

  return {
    label: query.label,
    clientMs: performance.now() - started,
    rows,
    responseBytes,
    exactCount,
    status,
    requests,
  };
}

async function measurePage(client, page, queries) {
  const started = performance.now();
  const results = await Promise.all(queries.map((query) => executeQuery(client, page, query)));
  return {
    page,
    concurrentClientMs: performance.now() - started,
    totalResponseBytes: results.reduce((total, result) => total + result.responseBytes, 0),
    queries: results,
  };
}

async function explainQuery(client, query) {
  const response = await query.build(client).explain({
    analyze: analyzeRequested,
    buffers: true,
    settings: true,
    format: 'json',
  });
  if (response.error) {
    return {
      page: query.page,
      label: query.label,
      error: { code: response.error.code ?? null, message: response.error.message },
    };
  }
  return { page: query.page, label: query.label, summary: planSummary(response.data), plan: response.data };
}

async function main() {
  const { url, anonKey } = getConfig();
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const anchor = await loadAnchors(client);
  const queries = makeQueries(anchor);
  const pages = Array.from(new Set(queries.map((query) => query.page)));
  const measurements = [];
  for (const page of pages) {
    const measurement = await measurePage(client, page, queries.filter((query) => query.page === page));
    measurements.push(measurement);
    console.log(`${page}: ${measurement.concurrentClientMs.toFixed(1)}ms, ${measurement.totalResponseBytes} bytes`);
  }
  const plans = [];
  if (explainRequested) {
    for (const query of queries) {
      const plan = await explainQuery(client, query);
      plans.push(plan);
      console.log(plan.error
        ? `${query.page}/${query.label}: plan unavailable ${plan.error.code ?? 'unknown'}`
        : `${query.page}/${query.label}: execution=${plan.summary.executionMs ?? 'n/a'}ms`);
    }
  }
  const output = {
    measuredAt: new Date().toISOString(),
    targetHost: new URL(url).hostname,
    databaseRole: 'anon',
    explainRequested,
    analyzeRequested,
    anchors: { ...anchor, peopleIds: `[${anchor.peopleIds.length} public person IDs omitted]` },
    measurements,
    plans,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(`Public read performance measurement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});
