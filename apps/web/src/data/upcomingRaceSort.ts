export type UpcomingRaceSortItem = {
  title: string;
  date: string;
  status: string;
  raceType: string;
};

function isUnfinishedRace(race: UpcomingRaceSortItem) {
  return !['completed', 'cancelled'].includes(race.status);
}

function electionDistrictNumber(race: UpcomingRaceSortItem) {
  const match = race.title.match(/第\s*(\d+)\s*選舉區/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function raceDateSortValue(race: UpcomingRaceSortItem) {
  const timestamp = Date.parse(race.date);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function raceTypePriority(race: UpcomingRaceSortItem) {
  const title = race.title;

  if (race.raceType === 'president' || race.raceType === 'vice_president' || title.includes('總統')) return 10;
  if (
    race.raceType === 'municipality_mayor' ||
    race.raceType === 'county_mayor' ||
    race.raceType === 'local_chief' ||
    race.raceType === 'township_mayor' ||
    title.includes('市長') ||
    title.includes('縣長') ||
    title.includes('鄉長') ||
    title.includes('鎮長')
  ) return 20;
  if (
    race.raceType === 'legislator' ||
    race.raceType === 'legislative_district' ||
    race.raceType === 'party_list_legislator' ||
    title.includes('立法委員') ||
    title.includes('立委')
  ) return 30;
  if (
    race.raceType === 'city_councilor' ||
    race.raceType === 'county_councilor' ||
    race.raceType === 'councilor_district' ||
    title.includes('議員')
  ) return 40;
  if (race.raceType === 'township_representative' || race.raceType === 'township_representative_district' || title.includes('代表')) return 50;
  if (race.raceType === 'village_chief' || title.includes('里長') || title.includes('村長')) return 60;
  if (race.raceType === 'referendum' || title.includes('公投')) return 70;
  if (race.raceType === 'recall' || title.includes('罷免')) return 80;
  if (race.raceType === 'by_election' || title.includes('補選')) return 90;

  return 100;
}

export function compareUpcomingRacesForDisplay(left: UpcomingRaceSortItem, right: UpcomingRaceSortItem) {
  const statusDiff = Number(isUnfinishedRace(right)) - Number(isUnfinishedRace(left));
  if (statusDiff !== 0) return statusDiff;

  const dateDiff = raceDateSortValue(left) - raceDateSortValue(right);
  if (dateDiff !== 0) return dateDiff;

  const priorityDiff = raceTypePriority(left) - raceTypePriority(right);
  if (priorityDiff !== 0) return priorityDiff;

  const leftDistrictNumber = electionDistrictNumber(left);
  const rightDistrictNumber = electionDistrictNumber(right);
  if (leftDistrictNumber !== rightDistrictNumber) return leftDistrictNumber - rightDistrictNumber;

  return left.title.localeCompare(right.title, 'zh-Hant-TW');
}
