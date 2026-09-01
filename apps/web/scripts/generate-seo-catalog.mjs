import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateProductionEnvironment } from './environmentGuards.mjs';

const pageSize = 1000;
const sharePageSize = 100;
const sitemapPageLimit = 45_000;
const sitesFileSizeLimit = 25 * 1024 * 1024;
const seoCatalogTargetFileSize = 2 * 1024 * 1024;
const indexableRegionTypes = new Set(['country', 'municipality', 'county', 'city']);
const maxFetchAttempts = 3;
const retryDelayMs = 500;

const sources = [
  {
    key: 'people',
    relation: 'people_directory',
    columns: 'person_id,name,party,position,current_office_label,updated_at',
    orderColumn: 'person_id',
  },
  {
    key: 'parties',
    relation: 'parties',
    columns: 'party_id,name,short_name,slug,updated_at',
    orderColumn: 'party_id',
  },
  {
    key: 'regions',
    relation: 'regions',
    columns: 'region_id,name,slug,region_type',
    orderColumn: 'region_id',
    filters: { region_type: 'in.(country,municipality,county,city)' },
  },
  {
    key: 'elections',
    relation: 'elections',
    columns: 'election_id,name,year,election_type,voting_date,status',
    orderColumn: 'election_id',
  },
  {
    key: 'races',
    relation: 'races',
    columns: 'race_id,title,election_name,region_name,voting_date,status',
    orderColumn: 'race_id',
  },
];

const shareSources = [
  { key: 'peopleShares', relation: 'people' },
  { key: 'raceShares', relation: 'races' },
];

const catalogGroupKeys = [...sources.map((source) => source.key), 'events'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function encodePathSegment(value) {
  return encodeURIComponent(cleanText(value));
}

function normalizeLastModified(value) {
  const text = cleanText(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function compactRecord(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''));
}

function makePage(group, path, title, description, structuredData, lastModified) {
  if (!path || !title || !description) return null;
  return compactRecord({
    group,
    path,
    title,
    description,
    lastModified: normalizeLastModified(lastModified),
    structuredData: compactRecord({ '@context': 'https://schema.org', ...structuredData }),
  });
}

function personPage(row) {
  const id = encodePathSegment(row.person_id);
  const name = cleanText(row.name);
  if (!id || !name) return null;
  const party = cleanText(row.party);
  const jobTitle = cleanText(row.current_office_label) || cleanText(row.position);
  const context = [party, jobTitle].filter(Boolean).join('、');
  return makePage(
    'people',
    `/people/${id}`,
    name,
    `查看${name}${context ? `（${context}）` : ''}的公職、黨籍、參選、政見與公開資料來源。`,
    compactRecord({
      '@type': 'Person',
      name,
      jobTitle: jobTitle || undefined,
      affiliation: party ? { '@type': 'Organization', name: party } : undefined,
    }),
    row.updated_at,
  );
}

function partyPage(row) {
  const slug = encodePathSegment(row.slug);
  const name = cleanText(row.name);
  if (!slug || !name) return null;
  return makePage(
    'parties',
    `/parties/${slug}`,
    name,
    `查看${name}的現任人員、候選人、政治獻金與公開資料統計。`,
    { '@type': 'Organization', name },
    row.updated_at,
  );
}

function regionPage(row) {
  if (!indexableRegionTypes.has(cleanText(row.region_type))) return null;
  const slug = encodePathSegment(row.slug);
  const name = cleanText(row.name);
  if (!slug || !name) return null;
  return makePage(
    'regions',
    `/regions/${slug}`,
    name,
    `查看${name}的公職人員、選舉、候選人與地方議題資料。`,
    { '@type': 'AdministrativeArea', name },
  );
}

function getElectionYear(row) {
  const votingYear = Number.parseInt(cleanText(row.voting_date).slice(0, 4), 10);
  if (Number.isFinite(votingYear)) return votingYear;
  const year = Number(row.year);
  return Number.isFinite(year) ? year : null;
}

function getElectionFamily(row) {
  const type = cleanText(row.election_type);
  if (['presidential', 'president', 'legislative', 'legislator'].includes(type)) return 'national';
  if (['local', 'local_chief', 'councilor', 'township_representative', 'village_chief'].includes(type)) return 'local';
  if (type === 'referendum') return 'referendum';
  if (type === 'recall') return 'recall';
  if (type === 'by_election') return 'by_election';
  return 'other';
}

function getLegacyLocalKind(row) {
  if (row.election_type === 'councilor') return 'councilor';
  if (row.election_type === 'township_representative') return 'township-representative';
  if (row.election_type === 'village_chief') return 'village-chief';
  return ['local', 'local_chief'].includes(row.election_type) ? null : cleanText(row.election_type);
}

function getElectionEventTitle(year, family, rows) {
  const yearLabel = year ?? '未定年份';
  const types = new Set(rows.map((row) => cleanText(row.election_type)));
  if (family === 'national') {
    const hasPresident = types.has('presidential') || types.has('president');
    const hasLegislator = types.has('legislative') || types.has('legislator');
    if (hasPresident && hasLegislator) return `${yearLabel} 總統副總統及立法委員選舉`;
    if (hasPresident) return `${yearLabel} 總統副總統選舉`;
    if (hasLegislator) return `${yearLabel} 立法委員選舉`;
  }
  if (family === 'local') {
    if (year !== null && year < 2014 && rows.length === 1) return cleanText(rows[0].name);
    return `${yearLabel} 地方公職人員選舉 / 九合一大選`;
  }
  if (family === 'referendum') return `${yearLabel} 公民投票`;
  if (family === 'recall') return `${yearLabel} 罷免投票`;
  if (family === 'by_election') return `${yearLabel} 補選`;
  return rows.length === 1 ? cleanText(rows[0].name) : `${yearLabel} 選舉事件`;
}

function electionEventPages(rows) {
  const groups = new Map();
  for (const row of rows) {
    const year = getElectionYear(row);
    const votingDate = cleanText(row.voting_date) || null;
    const family = getElectionFamily(row);
    const discriminator = family === 'local' && year !== null && year < 2014
      ? getLegacyLocalKind(row)
      : null;
    const key = `${year ?? 'unknown'}-${votingDate ?? 'undated'}-${family}${discriminator ? `-${discriminator}` : ''}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const year = getElectionYear(group[0]);
    const family = getElectionFamily(group[0]);
    const title = getElectionEventTitle(year, family, group);
    return makePage(
      'events',
      `/elections/events/${encodePathSegment(key)}`,
      title,
      `查看${title}的選區、候選人、政黨表現與公開資料。`,
      compactRecord({ '@type': 'CollectionPage', name: title }),
    );
  }).filter(Boolean);
}

function electionPage(row) {
  const id = encodePathSegment(row.election_id);
  const name = cleanText(row.name);
  if (!id || !name) return null;
  return makePage(
    'elections',
    `/elections/${id}`,
    name,
    `查看${name}的候選人、選區、得票結果與公開資料來源。`,
    compactRecord({ '@type': 'CollectionPage', name }),
  );
}

function racePage(row) {
  const id = encodePathSegment(row.race_id);
  const title = cleanText(row.title);
  if (!id || !title) return null;
  const electionName = cleanText(row.election_name);
  const regionName = cleanText(row.region_name);
  const context = [electionName, regionName].filter(Boolean).join('・');
  return makePage(
    'races',
    `/elections/races/${id}`,
    title,
    `查看${context ? `${context}的` : ''}候選人、政黨、得票結果與政見比較。`,
    compactRecord({ '@type': 'WebPage', name: title }),
  );
}

const pageMappers = {
  people: personPage,
  parties: partyPage,
  regions: regionPage,
  elections: electionPage,
  races: racePage,
};

function normalizeSharePolicies(value) {
  if (!Array.isArray(value)) return undefined;
  const policies = value
    .filter((item) => item && typeof item.key === 'string' && typeof item.text === 'string')
    .map((item) => ({ key: item.key.trim(), text: item.text.trim() }))
    .filter((item) => item.key && item.key.length <= 260 && item.text)
    .slice(0, 1000);
  return policies.length ? policies : undefined;
}

function normalizeShareCandidates(value) {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set();
  const candidates = [];
  for (const item of value) {
    const personId = cleanText(item?.person_id);
    const name = cleanText(item?.name);
    if (!personId || !name || seen.has(personId)) continue;
    seen.add(personId);
    candidates.push({ personId, name });
    if (candidates.length === 100) break;
  }
  return candidates.length ? candidates : undefined;
}

export function createSeoCatalog(datasets, generatedAt = new Date().toISOString()) {
  const pageByPath = new Map();

  for (const source of sources) {
    const rows = Array.isArray(datasets[source.key]) ? datasets[source.key] : [];
    for (const row of rows) {
      const page = pageMappers[source.key](row);
      if (page && !pageByPath.has(page.path)) pageByPath.set(page.path, page);
    }
  }
  for (const page of electionEventPages(Array.isArray(datasets.elections) ? datasets.elections : [])) {
    if (!pageByPath.has(page.path)) pageByPath.set(page.path, page);
  }

  for (const row of Array.isArray(datasets.peopleShares) ? datasets.peopleShares : []) {
    const page = pageByPath.get(`/people/${encodePathSegment(row.person_id)}`);
    const sharePolicies = normalizeSharePolicies(row.policies);
    if (page && sharePolicies) page.sharePolicies = sharePolicies;
  }
  for (const row of Array.isArray(datasets.raceShares) ? datasets.raceShares : []) {
    const page = pageByPath.get(`/elections/races/${encodePathSegment(row.race_id)}`);
    const shareCandidates = normalizeShareCandidates(row.candidates);
    if (page && shareCandidates) page.shareCandidates = shareCandidates;
  }

  const pages = Array.from(pageByPath.values()).sort((left, right) => left.path.localeCompare(right.path, 'zh-TW'));
  for (const group of catalogGroupKeys) {
    const count = pages.filter((page) => page.group === group).length;
    if (count > sitemapPageLimit) {
      throw new Error(`${group} SEO pages exceed the ${sitemapPageLimit}-page sitemap safety limit.`);
    }
  }

  return { version: 1, generatedAt, pages };
}

function catalogShardIndex(path, shardCount) {
  let hash = 2166136261;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % shardCount;
}

export function writeSeoCatalogFiles(catalog, outputPath) {
  const catalogDirectory = resolve(dirname(outputPath), 'seo-catalog');
  mkdirSync(catalogDirectory, { recursive: true });

  const groups = {};
  for (const group of catalogGroupKeys) {
    const pages = catalog.pages.filter((page) => page.group === group);
    const estimatedBytes = Buffer.byteLength(JSON.stringify(pages));
    const shardCount = Math.max(1, Math.ceil(estimatedBytes / seoCatalogTargetFileSize));
    const shards = Array.from({ length: shardCount }, () => []);
    for (const page of pages) shards[catalogShardIndex(page.path, shardCount)].push(page);

    const paths = [];
    for (let index = 0; index < shards.length; index += 1) {
      const fileName = `${group}-${index}.json`;
      const contents = `${JSON.stringify({
        version: 1,
        generatedAt: catalog.generatedAt,
        pages: shards[index],
      })}\n`;
      if (Buffer.byteLength(contents) > sitesFileSizeLimit) {
        throw new Error(`${group} SEO catalog shard exceeds the Sites 25 MiB file limit.`);
      }
      writeFileSync(resolve(catalogDirectory, fileName), contents, 'utf8');
      paths.push(`/seo-catalog/${fileName}`);
    }
    groups[group] = { paths, count: pages.length };
  }

  const manifest = { version: 3, generatedAt: catalog.generatedAt, groups };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest)}\n`, 'utf8');
  return manifest;
}

export async function fetchPublishedRows({
  supabaseUrl,
  anonKey,
  relation,
  rpcName = 'seo_catalog_page',
  requestedPageSize = pageSize,
  fetchImpl = fetch,
  waitImpl = (delay) => new Promise((resolvePromise) => setTimeout(resolvePromise, delay)),
}) {
  const rows = [];
  const requestPageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
    ? requestedPageSize
    : pageSize;

  for (let offset = 0; ; offset += requestPageSize) {
    const url = new URL(`/rest/v1/rpc/${rpcName}`, supabaseUrl);
    let response;
    for (let attempt = 1; attempt <= maxFetchAttempts; attempt += 1) {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
          'content-profile': 'published',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          p_dataset: relation,
          p_offset: offset,
          p_page_size: requestPageSize,
        }),
      });
      if (response.ok || response.status < 500 || attempt === maxFetchAttempts) break;
      await waitImpl(retryDelayMs * attempt);
    }
    if (!response.ok) {
      throw new Error(`Published ${relation} SEO RPC failed (${response.status}).`);
    }

    const result = await response.json();
    const page = Array.isArray(result) ? result[0]?.items : null;
    if (!Array.isArray(page)) {
      throw new Error(`Published ${relation} SEO RPC returned invalid data.`);
    }
    rows.push(...page);
    if (page.length < requestPageSize) return rows;
  }
}
async function main() {
  validateProductionEnvironment(process.env);
  if (process.env.VITE_PUBLIC_DATA_PROVIDER !== 'published') {
    throw new Error('SEO catalog generation requires VITE_PUBLIC_DATA_PROVIDER=published.');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY.trim();
  const outputPath = resolve(process.argv[2] || 'dist/client/seo-catalog.json');
  const [results, shareResults] = await Promise.all([
    Promise.all(sources.map((source) => fetchPublishedRows({
      supabaseUrl,
      anonKey,
      relation: source.relation,
    }))),
    Promise.all(shareSources.map((source) => fetchPublishedRows({
      supabaseUrl,
      anonKey,
      relation: source.relation,
      rpcName: 'seo_share_catalog_page',
      requestedPageSize: sharePageSize,
    }))),
  ]);
  const datasets = {
    ...Object.fromEntries(sources.map((source, index) => [source.key, results[index]])),
    ...Object.fromEntries(shareSources.map((source, index) => [source.key, shareResults[index]])),
  };
  const catalog = createSeoCatalog(datasets);

  writeSeoCatalogFiles(catalog, outputPath);
  console.log(`SEO catalog generated with ${catalog.pages.length} public pages.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  await main();
}
