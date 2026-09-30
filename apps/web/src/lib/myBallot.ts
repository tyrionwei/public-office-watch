import { ballotMappings2026 } from '../data/ballotMappings2026.ts';
import { villageBallotMappings2026 } from '../data/villageBallotMappings2026.ts';
import { localChiefBallotMappings2026 } from '../data/localChiefBallotMappings2026.ts';
import { representativeBallotMappings2026 } from '../data/representativeBallotMappings2026.ts';
import { taiwanDistrictsByCountyCode } from '../data/generated/taiwanDistrictDirectory.ts';
import { taiwanRegions } from '../data/taiwanRegions.ts';
import type { BallotCategory, BallotItem, BallotMapping, BallotOffice, BallotSetting, MyBallotResult } from '../types/ballot.ts';
import type { VotingRegionPreference } from '../votingRegion.tsx';

export const localBallotEventKey = '2026-2026-11-28-local';
const categories = ['general', 'lowland', 'highland'] as const;
export const localBallotMappings = [
  ...ballotMappings2026, ...villageBallotMappings2026,
  ...localChiefBallotMappings2026, ...representativeBallotMappings2026,
];
const mappingIndex = new Map<string, BallotMapping[]>();
for (const mapping of localBallotMappings) {
  const key = `${mapping.eventKey}/${mapping.countyCode}/${mapping.office}`;
  const group = mappingIndex.get(key) ?? [];
  group.push(mapping);
  mappingIndex.set(key, group);
}
// These are administrative district identities, not electoral boundaries.
const indigenousDistrictNames: Readonly<Record<string, readonly string[]>> = {
  '65000': ['烏來區'], '68000': ['復興區'], '66000': ['和平區'],
  '64000': ['茂林區', '桃源區', '那瑪夏區'],
};

export function normalizeBallotCategory(value: unknown): BallotCategory {
  return value === 'general' || value === 'lowland' || value === 'highland' ? value : 'unspecified';
}

/** Local election allocation only. Candidate publication and qualification play no part here. */
export function queryMyBallot(
  eventKey: string,
  preference: VotingRegionPreference,
  category: BallotCategory = preference.ballotCategory ?? 'unspecified',
  mappings: readonly BallotMapping[] = localBallotMappings,
): MyBallotResult {
  if (eventKey !== localBallotEventKey) return { eventKey, supported: false, items: [] };
  const county = taiwanRegions.find(({ code, id, slug }) => [code, id, slug].includes(preference.county.id));
  const district = county && (taiwanDistrictsByCountyCode[county.code] ?? []).find(
    ({ code }) => [code, `district-${code}`].includes(preference.district?.id ?? ''),
  );
  const villageCode = preference.village?.id.replace(/^village-/, '');
  const validVillage = villageCode && /^\d{11}$/.test(villageCode) && district && villageCode.startsWith(district.code)
    ? villageCode : undefined;
  const neighborhood = Number.isInteger(preference.neighborhood) && preference.neighborhood! > 0 && preference.neighborhood! <= 999
    ? preference.neighborhood : undefined;
  const voterCategory = normalizeBallotCategory(category);
  const offices: BallotOffice[] = ['mayor', 'councilor'];
  const municipalMountainDistricts = county ? indigenousDistrictNames[county.code] : undefined;
  if (county?.name.endsWith('縣')) offices.push('townshipMayor', 'townshipRepresentative');
  else if (municipalMountainDistricts && (!district || municipalMountainDistricts.includes(district.name))) {
    offices.push('indigenousDistrictMayor', 'indigenousDistrictRepresentative');
  }
  offices.push('villageChief');

  const items = offices.map((office): BallotItem => {
    const item: BallotItem = { office, status: 'missing-data', missing: [], sources: [] };
    const needs = (...missing: BallotSetting[]): BallotItem => ({ ...item, status: 'needs-setting', missing });
    if (!county) return needs('county');
    if (preference.district && !district && office !== 'mayor') return needs('district');
    // Before choosing a municipal district, these two possible ballots are conditional.
    if (office.startsWith('indigenousDistrict') && !district) return needs('district');
    let candidates = mappings === localBallotMappings
      ? (mappingIndex.get(`${eventKey}/${county.code}/${office}`) ?? [])
      : mappings.filter((mapping) => mapping.eventKey === eventKey
        && mapping.countyCode === county.code && mapping.office === office);
    // Filter known geography first, so a missing mapping never asks for unrelated settings.
    candidates = candidates.filter((mapping) =>
      (!district || !mapping.districtCodes || mapping.districtCodes.includes(district.code))
      && (!validVillage || !mapping.villageCodes || mapping.villageCodes.includes(validVillage))
      && (neighborhood === undefined || !mapping.neighborhoods || mapping.neighborhoods.includes(neighborhood)));
    if (!candidates.length) return item;
    if (preference.village && !validVillage && candidates.some((mapping) => mapping.villageCodes)) return needs(district ? 'village' : 'district');
    if (voterCategory === 'unspecified') {
      if (candidates.some((mapping) => !categories.every((value) => mapping.categories.includes(value)))) return needs('category');
    } else {
      candidates = candidates.filter((mapping) => mapping.categories.includes(voterCategory));
      if (!candidates.length) return item;
    }
    if (!district && candidates.some((mapping) => mapping.districtCodes)) return needs('district');
    if (!validVillage && candidates.some((mapping) => mapping.villageCodes)) return needs('village');
    if (neighborhood === undefined && candidates.some((mapping) => mapping.neighborhoods)) return needs('neighborhood');
    item.sources = candidates.map((mapping) => mapping.source);
    if (candidates.length !== 1 || candidates[0].status === 'ambiguous') return { ...item, status: 'ambiguous' };
    const mapping = candidates[0];
    return {
      ...item, status: 'confirmed', constituencyName: mapping.constituencyName,
      href: mapping.raceId ? `/elections/races/${encodeURIComponent(mapping.raceId)}` : undefined,
    };
  });
  return {
    eventKey, supported: true, items,
    estimatedLocalBallots: items.length > 0 && items.every((item) => item.status === 'confirmed') ? items.length : undefined,
  };
}
