import type { HomePageData, UpcomingRace } from './publicDataProvider.ts';

function isNationalRace(race: UpcomingRace) {
  const regionKey = `${race.regionId ?? ''} ${race.region ?? ''}`.toLowerCase();
  return race.raceType === 'president'
    || race.raceType === 'vice_president'
    || race.raceType === 'legislator'
    || race.raceType === 'legislative_district'
    || race.raceType === 'party_list_legislator'
    || race.raceType === 'indigenous'
    || race.raceType === 'referendum'
    || /taiwan|nationwide|全國|臺灣|台灣/.test(regionKey);
}

export function selectHomeRelatedRaces(
  homeData: Pick<HomePageData, 'stageRegions' | 'upcomingRaces'>,
  selectedRegionId: string | null,
) {
  const upcomingRaces = homeData.upcomingRaces.filter((race) => race.status !== 'completed');
  if (!selectedRegionId) return upcomingRaces.filter(isNationalRace);

  const region = homeData.stageRegions.find((item) => (
    item.id === selectedRegionId || item.publicRegionId === selectedRegionId
  ));
  const regionKeys = new Set([
    selectedRegionId,
    region?.id,
    region?.publicRegionId,
  ].filter((key): key is string => Boolean(key)));

  return upcomingRaces.filter((race) => regionKeys.has(race.regionId) || isNationalRace(race));
}
