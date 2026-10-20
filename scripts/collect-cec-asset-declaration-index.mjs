import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const base = 'https://pdps-dec.cec.gov.tw/release/formal/';
const categories = [
  { file: 'Page5.html', office: 'municipality_mayor' },
  { file: 'Page6.html', office: 'county_city_chief' },
  { file: 'Page7.html', office: 'municipality_councilor' },
  { file: 'Page8.html', office: 'county_city_councilor' },
];
const decodeText = (text) => text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();

export function declarationLinks(html, pageUrl, kind) {
  const allowed = kind === 'region' ? /^Page[5-8]_\d+\.html$/
    : kind === 'district' ? /^Page[78]_\d+_\d+\.html$/ : /^\.\/files\/\d+\.pdf$/;
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter(([, href]) => allowed.test(href))
    .map(([, href, label]) => ({ name: decodeText(label), url: new URL(href, pageUrl).href }));
}

export async function collectIndex({ fetchImpl = fetch, scope = 'chiefs', onSource = async () => {} } = {}) {
  if (!['chiefs', 'all'].includes(scope)) throw new Error('Unsupported collection scope');
  const sources = [];
  const records = [];
  async function read(url) {
    const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Official index HTTP ${response.status}: ${url}`);
    const text = await response.text();
    const source = { url, sha256: createHash('sha256').update(text).digest('hex'), text };
    sources.push(source);
    await onSource(source);
    return text;
  }
  for (const category of categories.filter((c) => scope === 'all' || !c.office.endsWith('councilor'))) {
    const categoryUrl = new URL(category.file, base).href;
    const regions = declarationLinks(await read(categoryUrl), categoryUrl, 'region');
    if (regions.length !== (category.office.startsWith('municipality') ? 6 : 16)) {
      throw new Error(`Unexpected county/city coverage: ${categoryUrl}`);
    }
    for (const region of regions) {
      const html = await read(region.url);
      const districts = category.office.endsWith('councilor')
        ? declarationLinks(html, region.url, 'district') : [{ name: region.name, url: region.url }];
      if (!districts.length) throw new Error(`Empty district index: ${region.url}`);
      for (const district of districts) {
        const candidates = declarationLinks(district.url === region.url ? html : await read(district.url), district.url, 'document');
        if (!candidates.length) throw new Error(`Empty declaration index: ${district.url}`);
        for (const candidate of candidates) records.push({
          electionYear: 2026, office: category.office, region: region.name, district: district.name,
          name: candidate.name, documentUrl: candidate.url, indexUrl: district.url,
          reviewStatus: 'document_index_only', amountsReviewed: false,
        });
      }
    }
  }
  // One candidate can have multiple linked documents. Preserve all of them;
  // resolving an amendment or a duplicate requires document review.
  const byName = new Map();
  for (const record of records) {
    const key = `${record.office}|${record.region}|${record.district}|${record.name}`;
    byName.set(key, [...(byName.get(key) ?? []), record.documentUrl]);
  }
  const multipleDocuments = [...byName].filter(([, urls]) => urls.length > 1)
    .map(([key, urls]) => ({ key, urls, reviewStatus: 'needs_document_review' }));
  return { schemaVersion: 1, retrievedAt: new Date().toISOString(),
    sourceUrl: `${base}HomePage.html`, scope: scope === 'all' ? 'county_city_chiefs_and_councilors' : '22_county_city_chiefs_only', records, multipleDocuments, sources };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (![2, 4].includes(args.length) || args[0] !== '--output' || (args.length === 4 && args[2] !== '--scope')) throw new Error('Usage: --output <local directory> [--scope chiefs|all]');
  const output = path.resolve(args[1]);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output); // Refuse an existing batch before making requests.
  const result = await collectIndex({ scope: args[3] ?? 'chiefs', onSource: async (source) => {
    // Archive each successful source immediately, including if a later source fails.
    await fs.writeFile(path.join(output, path.basename(new URL(source.url).pathname)), source.text, { flag: 'wx' });
  } });
  for (const source of result.sources) delete source.text;
  await fs.writeFile(path.join(output, 'index.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  console.log(`Collected ${result.records.length} declaration links (${result.scope}); no amounts extracted or database writes.`);
}
