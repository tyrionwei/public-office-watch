import type { PublicCandidate, PublicElection, PublicRace } from '../types/publicViews';
import { taiwanRegions } from './taiwanRegions';

export const electionTypeLabels: Record<PublicElection['election_type'] | string, string> = {
  presidential: '總統副總統',
  president: '總統副總統',
  legislative: '立法委員',
  legislator: '立法委員',
  local: '地方公職',
  local_chief: '地方首長',
  councilor: '議員',
  township_representative: '鄉鎮市民代表',
  village_chief: '村里長',
  recall: '罷免',
  referendum: '公投',
  by_election: '補選',
  other: '其他選舉',
};

export const electionStatusLabels: Record<PublicElection['status'] | string, string> = {
  draft: '草稿',
  announced: '已公告',
  upcoming: '即將投票',
  active: '進行中',
  completed: '已完成',
  cancelled: '已取消',
  unknown: '未知',
};

export const raceTypeLabels: Record<PublicRace['race_type'] | string, string> = {
  president: '總統',
  vice_president: '副總統',
  legislator: '立法委員',
  legislative_district: '區域立委',
  party_list_legislator: '不分區立委',
  municipality_mayor: '直轄市長',
  county_mayor: '縣市長',
  local_chief: '地方首長',
  city_councilor: '市議員',
  county_councilor: '縣議員',
  councilor_district: '議員選區',
  township_mayor: '鄉鎮市長',
  township_representative: '鄉鎮市民代表',
  township_representative_district: '代表選區',
  village_chief: '村里長',
  indigenous: '原住民選區',
  recall: '罷免',
  referendum: '公投',
  other: '其他',
};

export const raceStatusLabels: Record<PublicRace['status'] | string, string> = {
  draft: '草稿',
  announced: '已公告',
  upcoming: '即將投票',
  registration_open: '登記中',
  candidates_announced: '候選人公告',
  voting: '投票中',
  completed: '已完成',
  cancelled: '已取消',
  unknown: '未知',
};

export const registrationStatusLabels: Record<PublicCandidate['registration_status'] | string, string> = {
  registered: '已登記',
  qualified: '資格確認',
  pending: '待確認',
  elected: '當選',
  not_elected: '未當選',
  disqualified: '資格不符',
  withdrawn: '已撤回',
  unknown: '未知',
};

export type RaceCategoryKey =
  | 'presidential'
  | 'local_chief'
  | 'legislator'
  | 'councilor'
  | 'township_mayor'
  | 'township_representative'
  | 'village_chief'
  | 'referendum'
  | 'recall'
  | 'indigenous'
  | 'other';

export type RaceCategory = {
  key: RaceCategoryKey;
  label: string;
  order: number;
};

const raceCategoryByType: Record<PublicRace['race_type'], RaceCategory> = {
  president: { key: 'presidential', label: '總統副總統', order: 10 },
  vice_president: { key: 'presidential', label: '總統副總統', order: 10 },
  municipality_mayor: { key: 'local_chief', label: '縣市長', order: 20 },
  county_mayor: { key: 'local_chief', label: '縣市長', order: 20 },
  local_chief: { key: 'local_chief', label: '縣市長', order: 20 },
  legislator: { key: 'legislator', label: '立法委員', order: 30 },
  legislative_district: { key: 'legislator', label: '立法委員', order: 30 },
  party_list_legislator: { key: 'legislator', label: '立法委員', order: 30 },
  city_councilor: { key: 'councilor', label: '議員', order: 40 },
  county_councilor: { key: 'councilor', label: '議員', order: 40 },
  councilor_district: { key: 'councilor', label: '議員', order: 40 },
  township_mayor: { key: 'township_mayor', label: '鄉鎮市長', order: 50 },
  township_representative: { key: 'township_representative', label: '鄉鎮市民代表', order: 60 },
  township_representative_district: { key: 'township_representative', label: '鄉鎮市民代表', order: 60 },
  village_chief: { key: 'village_chief', label: '村里長', order: 70 },
  referendum: { key: 'referendum', label: '公投', order: 80 },
  recall: { key: 'recall', label: '罷免', order: 90 },
  indigenous: { key: 'indigenous', label: '原住民選區', order: 100 },
  other: { key: 'other', label: '其他', order: 999 },
};

const countyCityOrder = new Map(taiwanRegions.map((region, index) => [region.name, index]));
const nationalRegionNames = new Set(['全國', '臺灣', '台灣']);

function normalizeRegionLabel(label: string) {
  return label.replace(/台/g, '臺');
}

export function getElectionCountyCityName(label: string | null | undefined) {
  if (!label) return null;
  const normalizedLabel = normalizeRegionLabel(label);
  return taiwanRegions.find((region) => normalizedLabel.startsWith(region.name))?.name ?? null;
}

export function compareElectionRegionLabels(left: string, right: string) {
  const getRegionOrder = (label: string) => {
    if (nationalRegionNames.has(label)) return -1;
    const countyCityName = getElectionCountyCityName(label);
    if (countyCityName) return countyCityOrder.get(countyCityName) ?? taiwanRegions.length;
    if (label === '未指定區域') return taiwanRegions.length + 2;
    return taiwanRegions.length + 1;
  };

  const orderDiff = getRegionOrder(left) - getRegionOrder(right);
  if (orderDiff !== 0) return orderDiff;
  return left.localeCompare(right, 'zh-TW', { numeric: true });
}

function getRaceDistrictNumber(race: PublicRace) {
  const match = [race.region_name, race.title]
    .filter(Boolean)
    .join(' ')
    .match(/(?:第\s*)?0*(\d+)\s*(?:選舉區|選區)/);

  return match ? Number.parseInt(match[1], 10) : null;
}

function getRaceSortRegionLabel(race: PublicRace) {
  if (['president', 'vice_president', 'party_list_legislator', 'referendum'].includes(race.race_type)) {
    return '全國';
  }

  return race.region_name ?? '未指定區域';
}

export function getElectionTypeLabel(type: PublicElection['election_type'] | string) {
  return electionTypeLabels[type] ?? type;
}

export function getElectionStatusLabel(status: PublicElection['status'] | string) {
  return electionStatusLabels[status] ?? status;
}

export function getRaceTypeLabel(type: PublicRace['race_type'] | string) {
  return raceTypeLabels[type] ?? type;
}

export function getRaceStatusLabel(status: PublicRace['status'] | string) {
  return raceStatusLabels[status] ?? status;
}

export function getRegistrationStatusLabel(status: PublicCandidate['registration_status'] | string) {
  return registrationStatusLabels[status] ?? status;
}

export function getRaceCategoryByType(raceType: PublicRace['race_type']): RaceCategory {
  return raceCategoryByType[raceType] ?? raceCategoryByType.other;
}

export function getRaceCategory(race: PublicRace): RaceCategory {
  return getRaceCategoryByType(race.race_type);
}

export function groupRacesByCategory<T extends PublicRace>(races: T[]) {
  const groups = new Map<RaceCategoryKey, { category: RaceCategory; races: T[] }>();

  for (const race of races) {
    const category = getRaceCategory(race);
    const group = groups.get(category.key) ?? { category, races: [] };
    group.races.push(race);
    groups.set(category.key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      races: group.races.slice().sort(compareRacesForDisplay),
    }))
    .sort((left, right) => left.category.order - right.category.order || left.category.label.localeCompare(right.category.label, 'zh-TW'));
}

export function compareRacesForDisplay(left: PublicRace, right: PublicRace) {
  const leftCategory = getRaceCategory(left);
  const rightCategory = getRaceCategory(right);

  if (leftCategory.order !== rightCategory.order) {
    return leftCategory.order - rightCategory.order;
  }

  const leftRegionLabel = getRaceSortRegionLabel(left);
  const rightRegionLabel = getRaceSortRegionLabel(right);
  const leftCountyCity = getElectionCountyCityName(leftRegionLabel) ?? leftRegionLabel;
  const rightCountyCity = getElectionCountyCityName(rightRegionLabel) ?? rightRegionLabel;
  const regionDiff = compareElectionRegionLabels(leftCountyCity, rightCountyCity);
  if (regionDiff !== 0) return regionDiff;

  const leftDistrictNumber = getRaceDistrictNumber(left);
  const rightDistrictNumber = getRaceDistrictNumber(right);
  if (leftDistrictNumber !== rightDistrictNumber) {
    if (leftDistrictNumber === null) return -1;
    if (rightDistrictNumber === null) return 1;
    return leftDistrictNumber - rightDistrictNumber;
  }

  const fullRegionDiff = compareElectionRegionLabels(leftRegionLabel, rightRegionLabel);
  if (fullRegionDiff !== 0) return fullRegionDiff;
  return left.title.localeCompare(right.title, 'zh-TW', { numeric: true });
}
