import { writeFile } from 'node:fs/promises';

const sourceBaseUrl = 'https://api.nlsc.gov.tw/other';
const outputUrl = new URL('../src/data/generated/taiwanDistrictDirectory.ts', import.meta.url);

function readItems(xml, itemTag, fields) {
  const items = [];
  const itemPattern = new RegExp(`<${itemTag}>([\\s\\S]*?)</${itemTag}>`, 'g');
  for (const itemMatch of xml.matchAll(itemPattern)) {
    const item = {};
    for (const field of fields) {
      const value = itemMatch[1].match(new RegExp(`<${field}>([\\s\\S]*?)</${field}>`))?.[1]?.trim();
      if (!value) throw new Error(`Missing ${field} in ${itemTag}`);
      item[field] = value;
    }
    items.push(item);
  }
  return items;
}

async function fetchXml(path) {
  const response = await fetch(`${sourceBaseUrl}/${path}`);
  if (!response.ok) throw new Error(`NLSC request failed: ${path} (${response.status})`);
  return response.text();
}

const counties = readItems(
  await fetchXml('ListCounty'),
  'countyItem',
  ['countycode', 'countyname', 'countycode01'],
);

const directory = {};
for (const county of counties) {
  const towns = readItems(
    await fetchXml(`ListTown1/${county.countycode}`),
    'townItem',
    ['towncode', 'towncode01', 'townname'],
  );
  directory[county.countycode01] = towns.map((town) => ({
    code: town.towncode,
    legacyCode: town.towncode01,
    name: town.townname,
  }));
}

const districtCount = Object.values(directory).reduce((sum, districts) => sum + districts.length, 0);
if (counties.length !== 22 || districtCount < 350) {
  throw new Error(`Unexpected NLSC directory size: ${counties.length} counties, ${districtCount} districts`);
}

const output = `// Generated from the National Land Surveying and Mapping Center household-registration district API.
// Source: https://api.nlsc.gov.tw/other/ListCounty and /ListTown1/{countyCode}

export type TaiwanDistrict = {
  code: string;
  legacyCode: string;
  name: string;
};

export const taiwanDistrictsByCountyCode: Readonly<Record<string, readonly TaiwanDistrict[]>> = ${JSON.stringify(directory, null, 2)};
`;

await writeFile(outputUrl, output, 'utf8');
console.log(`Wrote ${districtCount} districts across ${counties.length} counties.`);
