import assert from 'node:assert/strict';
import test from 'node:test';
import { localBallotEventKey as event, normalizeBallotCategory, queryMyBallot } from '../src/lib/myBallot.ts';
import type { BallotMapping } from '../src/types/ballot.ts';
import type { VotingRegionPreference } from '../src/votingRegion.tsx';

const area: VotingRegionPreference = {
  county: { id: 'taipei-city', name: '臺北市' },
  district: { id: 'district-63000010', name: '松山區' },
  village: { id: 'village-63000010002', name: '莊敬里' },
  source: 'manual', confirmedAt: '2026-09-28T00:00:00Z',
};
const source = { url: 'https://example.test/official-fixture', publishedOn: '2026-08-20', rawScope: '測試用範圍' };
const fixtures: BallotMapping[] = [
  { id: 'mayor', eventKey: event, office: 'mayor', countyCode: '63000', categories: ['general', 'lowland', 'highland'], constituencyName: '臺北市', raceId: 'mayor-race', source },
  { id: 'council', eventKey: event, office: 'councilor', countyCode: '63000', districtCodes: ['63000010'], categories: ['general'], constituencyName: '第3選舉區', raceId: 'council-race', source },
  { id: 'lowland', eventKey: event, office: 'councilor', countyCode: '63000', categories: ['lowland'], constituencyName: '第7選舉區', source },
  { id: 'highland', eventKey: event, office: 'councilor', countyCode: '63000', categories: ['highland'], constituencyName: '第8選舉區', source },
  { id: 'village', eventKey: event, office: 'villageChief', countyCode: '63000', districtCodes: ['63000010'], villageCodes: ['63000010002'], categories: ['general', 'lowland', 'highland'], constituencyName: '莊敬里', source },
];
const item = (result: ReturnType<typeof queryMyBallot>, office: string) => result.items.find((row) => row.office === office)!;

test('完整一般與兩類原民設定各對應一張議員票；不用候選人名單', () => {
  for (const [category, name] of [['general', '第3選舉區'], ['lowland', '第7選舉區'], ['highland', '第8選舉區']] as const) {
    const result = queryMyBallot(event, area, category, fixtures);
    assert.equal(result.estimatedLocalBallots, 3);
    assert.equal(item(result, 'councilor').constituencyName, name);
    assert.equal(item(result, 'mayor').href, '/elections/races/mayor-race');
  }
});

test('舊設定未選類別不當一般，市長與里長仍確認', () => {
  const result = queryMyBallot(event, area, undefined, fixtures);
  assert.equal(result.estimatedLocalBallots, undefined);
  assert.deepEqual(item(result, 'councilor').missing, ['category']);
  assert.equal(item(result, 'mayor').status, 'confirmed');
  assert.equal(item(result, 'villageChief').status, 'confirmed');
  assert.equal(normalizeBallotCategory('bogus'), 'unspecified');
});

test('只缺村里時不阻擋市長與議員，不先要求鄰別', () => {
  const result = queryMyBallot(event, { ...area, village: undefined }, 'general', fixtures);
  assert.equal(item(result, 'councilor').status, 'confirmed');
  assert.deepEqual(item(result, 'villageChief').missing, ['village']);
});

test('未收錄的對應不假造選區，也不要求無助於查詢的設定', () => {
  const result = queryMyBallot(event, { ...area, village: undefined }, 'general', fixtures.filter((r) => r.office !== 'villageChief'));
  assert.equal(item(result, 'villageChief').status, 'missing-data');
  assert.deepEqual(item(result, 'villageChief').missing, []);
  assert.equal(result.estimatedLocalBallots, undefined);
});

test('分鄰分配漸進要求鄰別，超出分配不退回整里', () => {
  const split = fixtures.filter((r) => r.office !== 'villageChief').concat([
    { ...fixtures[4], id: 'n1', neighborhoods: [1, 2], constituencyName: '甲區' },
    { ...fixtures[4], id: 'n2', neighborhoods: [3, 4], constituencyName: '乙區' },
  ]);
  assert.deepEqual(item(queryMyBallot(event, area, 'general', split), 'villageChief').missing, ['neighborhood']);
  assert.equal(item(queryMyBallot(event, { ...area, neighborhood: 3 }, 'general', split), 'villageChief').constituencyName, '乙區');
  assert.equal(item(queryMyBallot(event, { ...area, neighborhood: 5 }, 'general', split), 'villageChief').status, 'missing-data');
});

test('分配重疊與明示疑義都禁止計張數與直接選區連結', () => {
  for (const rows of [fixtures.concat({ ...fixtures[1], id: 'duplicate' }), fixtures.map((r) => r.id === 'council' ? { ...r, status: 'ambiguous' as const } : r)]) {
    const result = queryMyBallot(event, area, 'general', rows);
    assert.equal(item(result, 'councilor').status, 'ambiguous');
    assert.equal(item(result, 'councilor').href, undefined);
    assert.equal(result.estimatedLocalBallots, undefined);
  }
});

test('其他選舉事件不混入地方選票，即使同日也不計', () => {
  const result = queryMyBallot(event, area, 'general', fixtures.concat({ ...fixtures[1], id: 'other', eventKey: '2026-2026-11-28-referendum' }));
  assert.equal(result.estimatedLocalBallots, 3);
  assert.equal(queryMyBallot('2026-2026-11-28-referendum', area, 'general', fixtures).supported, false);
});

test('行政區與村里必須屬於儲存縣市，不能以同名或錯誤前綴配對', () => {
  const wrongDistrict = queryMyBallot(event, { ...area, district: { id: 'district-65000010', name: '松山區' } }, 'general', fixtures);
  assert.deepEqual(item(wrongDistrict, 'councilor').missing, ['district']);
  const wrongVillage = queryMyBallot(event, { ...area, village: { id: 'village-65000010002', name: '莊敬里' } }, 'general', fixtures);
  assert.deepEqual(item(wrongVillage, 'villageChief').missing, ['village']);
  assert.equal(wrongVillage.estimatedLocalBallots, undefined);
});

test('縣轄鄉鎮有五種票、一般直轄市三種、山原區五種，不用瀏覽地區覆寫戶籍', () => {
  for (const [county, district, count] of [
    ['nantou-county', 'district-10008010', 5], ['taipei-city', 'district-63000010', 3],
    ['new-taipei-city', 'district-65000290', 5], ['new-taipei-city', 'district-65000010', 3],
  ] as const) {
    const preference = { ...area, county: { id: county, name: '' }, district: { id: district, name: '' }, village: undefined };
    const before = JSON.stringify(preference);
    assert.equal(queryMyBallot(event, preference, 'general', []).items.length, count);
    assert.equal(JSON.stringify(preference), before);
  }
});

// Real announcement rows, in addition to the isolated overlap/missing-data fixtures.
import { localBallotMappings } from '../src/lib/myBallot.ts';
import { taiwanRegions } from '../src/data/taiwanRegions.ts';
import { taiwanDistrictsByCountyCode } from '../src/data/generated/taiwanDistrictDirectory.ts';
import { taiwanVillagesByDistrictCode } from '../src/data/generated/taiwanVillageDirectory.ts';

function registeredArea(countyName: string, districtName: string, villageName?: string): VotingRegionPreference {
  const county = taiwanRegions.find((row) => row.name === countyName)!;
  const district = taiwanDistrictsByCountyCode[county.code].find((row) => row.name === districtName)!;
  const village = villageName && taiwanVillagesByDistrictCode[district.code].find((row) => row.name === villageName);
  return { county: { id: county.slug, name: county.name }, district: { id: `district-${district.code}`, name: district.name },
    ...(village ? { village: { id: `village-${village.code}`, name: village.name } } : {}), source: 'manual', confirmedAt: '2026-09-28T00:00:00Z' };
}

test('全部正式mapping的行政區/村里代碼皆有正確上下層、來源日期與唯一ID', () => {
  assert.equal(new Set(localBallotMappings.map((r) => r.id)).size, localBallotMappings.length);
  for (const row of localBallotMappings) {
    assert.match(row.source.url, /^https:\/\/web\.cec\.gov\.tw\//);
    assert.match(row.source.publishedOn, /^2026-08-\d{2}$/);
    assert.ok(row.source.rawScope.length, row.id);
    assert.ok(row.categories.length, row.id);
    for (const code of row.districtCodes ?? []) assert.ok(taiwanDistrictsByCountyCode[row.countyCode].some((d) => d.code === code), row.id + ':' + code);
    for (const code of row.villageCodes ?? []) assert.ok((row.districtCodes ?? []).some((d) => taiwanVillagesByDistrictCode[d]?.some((v) => v.code === code)), row.id + ':' + code);
  }
});

test('臺北三類皆預估3票，南投一般5票，烏來三類5票', () => {
  for (const category of ['general','lowland','highland'] as const) {
    assert.equal(queryMyBallot(event, registeredArea('臺北市','松山區','莊敬里'), category).estimatedLocalBallots, 3);
    assert.equal(queryMyBallot(event, registeredArea('新北市','烏來區','忠治里'), category).estimatedLocalBallots, 5);
  }
  const nantou = queryMyBallot(event, registeredArea('南投縣','南投市','龍泉里'), 'general');
  assert.equal(nantou.estimatedLocalBallots, 5);
  assert.match(item(nantou,'townshipRepresentative').constituencyName!, /第1選舉區/);
  assert.ok(nantou.items.every((row) => row.href));
});

test('竹北分區先要求村里，填入後確定到不同議員選區', () => {
  const missing = queryMyBallot(event, registeredArea('新竹縣','竹北市'), 'general');
  assert.deepEqual(item(missing,'councilor').missing, ['village']);
  const a = queryMyBallot(event, registeredArea('新竹縣','竹北市','新社里'), 'general');
  const b = queryMyBallot(event, registeredArea('新竹縣','竹北市','竹北里'), 'general');
  assert.equal(item(a,'councilor').status, 'confirmed');
  assert.equal(item(b,'councilor').status, 'confirmed');
  assert.notEqual(item(a,'councilor').constituencyName, item(b,'councilor').constituencyName);
});

test('臺中山原依公告分流，澎湖沒有專屬席時對應區域議員', () => {
  const north = queryMyBallot(event, registeredArea('臺中市','和平區'), 'highland');
  const south = queryMyBallot(event, registeredArea('臺中市','霧峰區'), 'highland');
  assert.match(item(north,'councilor').constituencyName!, /第16選舉區/);
  assert.match(item(south,'councilor').constituencyName!, /第17選舉區/);
  const penghu = registeredArea('澎湖縣','馬公市');
  assert.equal(item(queryMyBallot(event, penghu, 'highland'),'councilor').status, 'confirmed');
  assert.equal(item(queryMyBallot(event, penghu, 'highland'),'councilor').href,
    item(queryMyBallot(event, penghu, 'general'),'councilor').href);
});

test('選區已確認但race頁缺少時，不能誤標為分配疑義', () => {
  const result = queryMyBallot(event, area, 'lowland', fixtures);
  const council = item(result,'councilor');
  assert.equal(council.status, 'confirmed');
  assert.equal(council.href, undefined);
});

test('臺南新設兩類原民議員都連到既有2026選區頁', () => {
  for (const category of ['lowland', 'highland'] as const) {
    const council = item(queryMyBallot(event, registeredArea('臺南市','新營區'), category), 'councilor');
    assert.equal(council.status, 'confirmed');
    assert.match(council.href!, /^\/elections\/races\/[\da-f-]{36}$/);
  }
});

test('全國每個村里的一般議員mapping恰好一區', () => {
  for (const county of taiwanRegions) for (const district of taiwanDistrictsByCountyCode[county.code]) {
    const cases = taiwanVillagesByDistrictCode[district.code].map((v) => v.name);
    for (const village of cases) {
      const result = queryMyBallot(event, registeredArea(county.name, district.name, village), 'general');
      assert.equal(item(result,'councilor').status, 'confirmed', county.name + district.name + (village ?? ''));
    }
  }
});

test('全國7781村里三種類別都能對應村里長與議員，適用的3或5張票皆完整', () => {
  let villages = 0;
  for (const county of taiwanRegions) for (const district of taiwanDistrictsByCountyCode[county.code]) {
    for (const village of taiwanVillagesByDistrictCode[district.code]) {
      villages += 1;
      const preference: VotingRegionPreference = {
        county: { id: county.code, name: county.name }, district: { id: district.code, name: district.name },
        village: { id: village.code, name: village.name }, source: 'manual', confirmedAt: '2026-09-28T00:00:00Z',
      };
      for (const category of ['general', 'lowland', 'highland'] as const) {
        const result = queryMyBallot(event, preference, category);
        const context = county.name + district.name + village.name + '/' + category;
        assert.equal(result.estimatedLocalBallots, result.items.length, context + ':' + JSON.stringify(result.items.filter((r) => r.status !== 'confirmed')));
        assert.ok([3, 5].includes(result.estimatedLocalBallots!), context);
        assert.ok(result.items.filter((r) => r.office !== 'villageChief').every((r) => r.href), context + ': missing race link');
        assert.match(item(result, 'villageChief').constituencyName!, new RegExp(village.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    }
  }
  assert.equal(villages, 7781);
});

test('原民代表專席依鄉鎮及村里分流，普通代表不多算一票', () => {
  const nanzhuang = registeredArea('苗栗縣', '南庄鄉', '東村');
  const general = queryMyBallot(event, nanzhuang, 'general');
  const lowland = queryMyBallot(event, nanzhuang, 'lowland');
  const highland = queryMyBallot(event, nanzhuang, 'highland');
  assert.equal(general.estimatedLocalBallots, 5);
  assert.equal(lowland.estimatedLocalBallots, 5);
  assert.equal(highland.estimatedLocalBallots, 5);
  assert.match(item(lowland, 'townshipRepresentative').constituencyName!, /第4選舉區/);
  assert.equal(item(general, 'townshipRepresentative').href, item(highland, 'townshipRepresentative').href);
  assert.notEqual(item(general, 'townshipRepresentative').href, item(lowland, 'townshipRepresentative').href);
  assert.deepEqual(item(queryMyBallot(event, nanzhuang), 'townshipRepresentative').missing, ['category']);
});

test('屏東公告跨頁的村里仍維持正確代表分區', () => {
  for (const [town, village, number] of [
    ['萬丹鄉', '上村村', 4], ['萬丹鄉', '廣安村', 4],
    ['屏東市', '安鎮里', 3], ['屏東市', '廣興里', 4],
  ] as const) {
    const result = queryMyBallot(event, registeredArea('屏東縣', town, village), 'general');
    assert.equal(item(result, 'townshipRepresentative').constituencyName, `屏東縣${town}第${number}選舉區`);
    assert.equal(result.estimatedLocalBallots, 5);
  }
  const manzhou = queryMyBallot(event, registeredArea('屏東縣', '滿州鄉', '滿州村'), 'lowland');
  assert.equal(item(manzhou, 'townshipRepresentative').constituencyName, '屏東縣滿州鄉第4選舉區');
  assert.equal(manzhou.estimatedLocalBallots, 5);
});


test('三筆村里連結已補齊且不誤接官田舊合併頁', () => {
  assert.equal(localBallotMappings.filter((row) => !row.raceId).length, 0);
  for (const [code, id] of [
    ['67000100017', '50d51085-f950-4ea6-982b-9166a51f791f'],
    ['67000100018', 'fe21df5e-f078-4658-b850-d43900202afe'],
    ['10009200021', '6908ef24-813f-42ce-924c-c24488d6f28f'],
  ]) {
    const row = localBallotMappings.find((row) => row.office === 'villageChief' && row.villageCodes?.includes(code));
    assert.equal(row?.raceId, id);
  }
});
