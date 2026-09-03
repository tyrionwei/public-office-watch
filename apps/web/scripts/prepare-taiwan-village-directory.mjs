import { writeFile } from 'node:fs/promises';

const sourceBaseUrl = 'https://api.nlsc.gov.tw/other';
const outputUrl = new URL('../src/data/generated/taiwanVillageDirectory.ts', import.meta.url);

function readItems(xml, itemTag, fields, optionalFields = []) {
  const items = [];
  const itemPattern = new RegExp(`<${itemTag}>([\\s\\S]*?)</${itemTag}>`, 'g');
  for (const itemMatch of xml.matchAll(itemPattern)) {
    const item = {};
    for (const field of fields) {
      const value = itemMatch[1].match(new RegExp(`<${field}>([\\s\\S]*?)</${field}>`))?.[1]?.trim();
      if (!value && !optionalFields.includes(field)) throw new Error(`Missing ${field} in ${itemTag}`);
      item[field] = value ?? '';
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
  ['countycode', 'countycode01'],
);

const directory = {};
let ignoredUnnamedVillageCount = 0;
for (const county of counties) {
  const towns = readItems(
    await fetchXml(`ListTown1/${county.countycode}`),
    'townItem',
    ['towncode', 'towncode01'],
  );
  for (const town of towns) {
    const villagePath = `ListVillage/${county.countycode}/${town.towncode01}`;
    let villages;
    try {
      villages = readItems(
        await fetchXml(villagePath),
        'village',
        ['villageId', 'villageName'],
        ['villageName'],
      );
    } catch (error) {
      throw new Error(`${villagePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    ignoredUnnamedVillageCount += villages.filter((village) => !village.villageName).length;
    directory[town.towncode] = villages
      .filter((village) => village.villageName)
      .map((village) => ({
        code: village.villageId,
        name: village.villageName,
      }));
  }
}

const districtCount = Object.keys(directory).length;
const villageCount = Object.values(directory).reduce((sum, villages) => sum + villages.length, 0);
if (counties.length !== 22 || districtCount !== 368 || villageCount < 7_000 || villageCount > 8_500) {
  throw new Error(`Unexpected NLSC directory size: ${counties.length} counties, ${districtCount} districts, ${villageCount} villages`);
}

const output = `// Generated from the National Land Surveying and Mapping Center household-registration village API.
// Source: https://api.nlsc.gov.tw/other/ListVillage/{countyCode}/{townCode}

export type TaiwanVillage = {
  code: string;
  name: string;
};

export const taiwanVillagesByDistrictCode: Readonly<Record<string, readonly TaiwanVillage[]>> = ${JSON.stringify(directory, null, 2)};
`;

await writeFile(outputUrl, output, 'utf8');
console.log(`Wrote ${villageCount} villages across ${districtCount} districts.`);
console.log(`Ignored ${ignoredUnnamedVillageCount} unnamed special-area records.`);
