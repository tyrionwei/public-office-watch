import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchWithTrustedTwcaChain } from './trusted-official-fetch.mjs';

const RAW_ROOT = 'local-data/raw';
const FETCHED_AT = new Date().toISOString();

const CEC_2024_BASE = 'https://2024.cec.gov.tw/data/json';
const CEC_2022_BASE = 'https://2022.cec.gov.tw/data/json';

const AREAS = [
  ['63000', 'taipei'],
  ['65000', 'new-taipei'],
  ['68000', 'taoyuan'],
  ['66000', 'taichung'],
  ['67000', 'tainan'],
  ['64000', 'kaohsiung'],
  ['10004', 'hsinchu-county'],
  ['10005', 'miaoli-county'],
  ['10007', 'changhua-county'],
  ['10008', 'nantou-county'],
  ['10009', 'yunlin-county'],
  ['10010', 'chiayi-county'],
  ['10013', 'pingtung-county'],
  ['10002', 'yilan-county'],
  ['10015', 'hualien-county'],
  ['10014', 'taitung-county'],
  ['10016', 'penghu-county'],
  ['10017', 'keelung'],
  ['10018', 'hsinchu'],
  ['10020', 'chiayi'],
  ['09020', 'kinmen-county'],
  ['09007', 'lienchiang-county'],
];

const CEC_2022_TYPES = [
  ['C1', 'mayor'],
  ['T', 'councilor'],
  ['D1', 'township-mayor'],
  ['R', 'township-representative'],
  ['D2', 'indigenous-district-mayor'],
  ['R3', 'indigenous-district-representative'],
  ['V1', 'village-chief'],
];

const CEC_2022_NATIONAL_FILES = [
  {
    dir: ['national', 'election', '2022'],
    filename: 'cec-all-candidates-2022.json',
    url: CEC_2022_BASE + '/cand/00000.json',
    title: '2022 all local-election candidates search index',
  },
  {
    dir: ['national', 'election', '2022'],
    filename: 'cec-candidate-remarks-2022.json',
    url: CEC_2022_BASE + '/cand/remark.json',
    title: '2022 candidate and election remarks',
  },
  {
    dir: ['national', 'election', '2022'],
    filename: 'cec-voter-types-2022.json',
    url: CEC_2022_BASE + '/tbox/voter.json',
    title: '2022 voter type definitions',
  },
  {
    dir: ['national', 'referendum', '2022'],
    filename: 'cec-2022-homepage.json',
    url: 'https://2022.cec.gov.tw/',
    title: '2022 constitutional amendment referendum official homepage snapshot',
    envelope: true,
  },
];

const CEC_2024_FILES = [
  {
    dir: ['national', 'president', '2024'],
    filename: 'cec-candidates-p1-president.json',
    url: `${CEC_2024_BASE}/cand/P1/00000.json`,
    title: '2024 president and vice president candidates',
  },
  {
    dir: ['national', 'legislator', '2024'],
    filename: 'cec-candidates-l2-lowland-indigenous.json',
    url: `${CEC_2024_BASE}/cand/L2/00000.json`,
    title: '2024 lowland indigenous legislator candidates',
  },
  {
    dir: ['national', 'legislator', '2024'],
    filename: 'cec-candidates-l3-highland-indigenous.json',
    url: `${CEC_2024_BASE}/cand/L3/00000.json`,
    title: '2024 highland indigenous legislator candidates',
  },
  {
    dir: ['national', 'legislator', '2024'],
    filename: 'cec-candidates-l4-party-list.json',
    url: `${CEC_2024_BASE}/cand/L4/00000.json`,
    title: '2024 party-list legislator candidates',
  },
  {
    dir: ['national', 'legislator', '2024'],
    filename: 'cec-district-prv-city-dept.json',
    url: `${CEC_2024_BASE}/dist/prvCityDept.json`,
    title: '2024 legislative district definitions',
  },
  ...AREAS.map(([code, slug]) => ({
    dir: ['national', 'legislator', '2024'],
    filename: `cec-candidates-l1-district-${code}.json`,
    url: `${CEC_2024_BASE}/cand/L1/${code}.json`,
    title: `2024 district legislator candidates for ${slug}`,
  })),
];

const CEC_2026_FILES = [
  {
    dir: ['local', 'all', 'election', '2026'],
    filename: 'cec-homepage.json',
    url: 'https://www.cec.gov.tw/',
    title: 'CEC homepage snapshot before 2026 election static data is published',
    envelope: true,
  },
  {
    dir: ['local', 'all', 'election', '2026'],
    filename: 'cec-2026-static-root.json',
    url: 'https://2026.cec.gov.tw/',
    title: '2026 CEC election site root probe',
    envelope: true,
    optional: true,
  },
];

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function rowCount(data) {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed.length;
    if (Array.isArray(parsed.records)) return parsed.records.length;
    if (Array.isArray(parsed.data)) return parsed.data.length;
    if (Array.isArray(parsed.cands)) return parsed.cands.length;
    if (parsed.cand && Array.isArray(parsed.cand)) return parsed.cand.length;
    if (parsed.prvs && Array.isArray(parsed.prvs)) return parsed.prvs.length;
  } catch {
    return undefined;
  }
  return undefined;
}

async function fetchBuffer(url) {
  const response = await fetchWithTrustedTwcaChain(url);
  const body = Buffer.from(await response.arrayBuffer());
  return { response, body };
}

async function saveSource(source) {
  const dir = path.join(RAW_ROOT, ...source.dir);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, source.filename);

  const { response, body } = await fetchBuffer(source.url);
  if (!response.ok && source.optional) {
    return {
      title: source.title,
      sourceUrl: source.url,
      fetchedAt: FETCHED_AT,
      status: response.status,
      ok: false,
      skipped: true,
      format: 'not-found',
      files: [],
    };
  }

  if (!response.ok) {
    throw new Error(response.status + ' ' + response.statusText);
  }

  let savedBody = body;
  let format = 'raw';
  if (source.envelope) {
    savedBody = Buffer.from(JSON.stringify({
      url: source.url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      fetchedAt: FETCHED_AT,
      body: body.toString('utf8'),
    }, null, 2));
    format = 'raw-response-envelope-json';
  } else if (source.filename.endsWith('.json')) {
    format = 'json';
  }

  await writeFile(filePath, savedBody);

  return {
    title: source.title,
    sourceUrl: source.url,
    fetchedAt: FETCHED_AT,
    status: response.status,
    ok: response.ok,
    format,
    files: [{
      path: source.filename,
      bytes: savedBody.byteLength,
      sha256: sha256(savedBody),
      rowCount: source.envelope ? undefined : rowCount(savedBody.toString('utf8')),
    }],
  };
}

async function readManifest(dir) {
  try {
    const parsed = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
    return {
      generatedAt: parsed.generatedAt ?? FETCHED_AT,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    return { generatedAt: FETCHED_AT, sources: [] };
  }
}

async function appendManifest(source, entry) {
  const dir = path.join(RAW_ROOT, ...source.dir);
  const manifest = await readManifest(dir);
  const kept = manifest.sources.filter((item) => item.sourceUrl !== entry.sourceUrl);
  kept.push(entry);
  kept.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
  await writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify({
    generatedAt: FETCHED_AT,
    sources: kept,
  }, null, 2)}\n`);
}

async function discoverCec2022LocalSources() {
  const sources = [
    {
      dir: ['local', 'all', 'election', '2022'],
      filename: 'cec-district-prv-city-dept.json',
      url: `${CEC_2022_BASE}/dist/prvCityDept.json`,
      title: '2022 local election district definitions',
    },
  ];

  for (const [type, office] of CEC_2022_TYPES) {
    for (const [code, slug] of AREAS) {
      sources.push({
        dir: ['local', slug, office, '2022'],
        filename: `cec-candidates-${type.toLowerCase()}-${office}-${code}.json`,
        url: `${CEC_2022_BASE}/cand/${type}/${code}.json`,
        title: `2022 ${office} candidates for ${slug}`,
        optional: true,
      });
    }
  }

  const districtData = JSON.parse((await fetchBuffer(CEC_2022_BASE + '/dist/prvCityDept.json')).body.toString('utf8'));
  for (const [code, slug] of AREAS) {
    const area = (districtData.prvs ?? []).find((item) => item.prvCityCode === code);
    if (!area) continue;
    sources.push({
      dir: ['local', slug, 'election', '2022'],
      filename: 'cec-district-dept-li-' + code + '.json',
      url: CEC_2022_BASE + '/dist/' + code + '_deptLi.json',
      title: '2022 village district definitions for ' + slug,
      optional: true,
    });
    for (const dept of area.depts ?? []) {
      sources.push({
        dir: ['local', slug, 'village-chief', '2022'],
        filename: 'cec-candidates-v1-village-chief-' + code + '-' + dept.deptCode + '.json',
        url: CEC_2022_BASE + '/cand/V1/' + code + '/' + code + dept.deptCode + '.json',
        title: '2022 village-chief candidates for ' + slug + ' ' + dept.deptName,
        optional: true,
      });
    }
  }
  return sources;
}

async function updateIndex(results) {
  const indexPath = path.join(RAW_ROOT, 'manifest-index.json');
  let previous = { generatedAt: FETCHED_AT, summaries: [] };
  try {
    previous = JSON.parse(await readFile(indexPath, 'utf8'));
  } catch {
    // New archive.
  }

  const previousSummaries = Array.isArray(previous.summaries) ? previous.summaries : [];
  const summaries = new Map(previousSummaries.map((item) => [item.path, item]));
  for (const result of results) {
    const archivePath = path.join(...result.source.dir);
    summaries.set(archivePath, {
      path: archivePath,
      sourceCount: result.ok ? 1 : 0,
      lastFetchedAt: FETCHED_AT,
      status: result.ok ? 'ok' : result.skipped ? 'skipped' : 'failed',
      note: result.error,
    });
  }

  await writeFile(indexPath, `${JSON.stringify({
    generatedAt: FETCHED_AT,
    summaries: Array.from(summaries.values()).sort((a, b) => a.path.localeCompare(b.path)),
  }, null, 2)}\n`);
}

async function main() {
  const sources = [
    ...CEC_2022_NATIONAL_FILES,
    ...CEC_2024_FILES,
    ...(await discoverCec2022LocalSources()),
    ...CEC_2026_FILES,
  ];

  const results = [];
  for (const source of sources) {
    try {
      const entry = await saveSource(source);
      if (entry.ok) await appendManifest(source, entry);
      results.push({ source, ok: entry.ok, skipped: entry.skipped === true, status: entry.status });
      console.log(`${entry.ok ? 'ok' : 'skip'} ${entry.status} ${path.join(...source.dir, source.filename)}`);
    } catch (error) {
      const skipped = source.optional === true;
      results.push({ source, ok: false, skipped, error: error.message });
      console.log(`${skipped ? 'skip' : 'fail'} ${path.join(...source.dir, source.filename)} ${error.message}`);
    }
  }

  await updateIndex(results);

  const ok = results.filter((result) => result.ok).length;
  const skipped = results.filter((result) => result.skipped).length;
  const failed = results.length - ok - skipped;
  console.log(JSON.stringify({ total: results.length, ok, skipped, failed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
