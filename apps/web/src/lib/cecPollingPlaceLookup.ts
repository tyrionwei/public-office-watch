import { taiwanDistrictsByCountyCode } from '../data/generated/taiwanDistrictDirectory.ts';
import { taiwanRegions } from '../data/taiwanRegions.ts';
import type { VotingRegionPreference } from '../votingRegion.tsx';

export function buildCecPollingPlaceLookupUrl(baseUrl: string, preference: VotingRegionPreference) {
  try {
    const url = new URL(baseUrl);
    const county = taiwanRegions.find((candidate) => candidate.name === preference.county.name);
    if (!county) return baseUrl;

    url.searchParams.set('mode', 'tbox');
    // CEC clears its own default when a partial query is present, then redirects because voter is empty.
    url.searchParams.set('voter', '01');
    url.searchParams.set('prvCityCode', county.code);

    const district = preference.district
      ? (taiwanDistrictsByCountyCode[county.code] ?? []).find((candidate) =>
        candidate.name === preference.district?.name || `district-${candidate.code}` === preference.district?.id)
      : undefined;
    if (district) {
      url.searchParams.set('deptCode', district.code.slice(-3));
      const villageCode = preference.village?.id.match(/^village-(\d{11})$/)?.[1];
      if (villageCode?.startsWith(district.code)) {
        url.searchParams.set('liCode', villageCode.slice(-3));
      }
    }

    return url.toString();
  } catch {
    return baseUrl;
  }
}
