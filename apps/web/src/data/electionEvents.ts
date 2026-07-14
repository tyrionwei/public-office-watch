import type { PublicElection, PublicElectionRaceSummary, PublicRace } from '../types/publicViews';
import { compareElectionRegionLabels, compareRacesForDisplay, getElectionCountyCityName, getRaceCategory, getRaceCategoryByType, groupRacesByCategory } from './electionLabels';

export type ElectionEventFamily = 'national' | 'local' | 'referendum' | 'recall' | 'by_election' | 'other';

export type ElectionEventRegion = {
  key: string;
  label: string;
  races: PublicRace[];
};

export type ElectionEvent = {
  key: string;
  title: string;
  year: number | null;
  votingDate: string | null;
  family: ElectionEventFamily;
  status: PublicElection['status'];
  elections: PublicElection[];
  races: PublicRace[];
  raceCount: number;
  categorySummary: string;
  regionSummary: string;
  sourceNameSummary: string;
  categoryGroups: ReturnType<typeof groupRacesByCategory<PublicRace>>;
  regionGroups: ElectionEventRegion[];
};

const statusOrder: PublicElection['status'][] = ['active', 'upcoming', 'announced', 'draft', 'completed', 'cancelled', 'unknown'];
const localRaceTypes = new Set<PublicRace['race_type']>([
  'municipality_mayor',
  'county_mayor',
  'local_chief',
  'city_councilor',
  'county_councilor',
  'councilor_district',
  'township_mayor',
  'township_representative',
  'township_representative_district',
  'village_chief',
]);
const nationalRaceTypes = new Set<PublicRace['race_type']>(['president', 'vice_president', 'legislator', 'legislative_district', 'party_list_legislator', 'indigenous']);

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function summarizeLabels(labels: string[], emptyLabel: string, maxVisible = 4) {
  if (labels.length === 0) return emptyLabel;
  return labels.slice(0, maxVisible).join('、') + (labels.length > maxVisible ? ` 等 ${labels.length} 項` : '');
}

export function getDisplayElectionYear(election: PublicElection) {
  if (election.voting_date) {
    const year = Number.parseInt(election.voting_date.slice(0, 4), 10);
    if (Number.isFinite(year)) return year;
  }

  return election.year;
}

function getEventFamily(elections: PublicElection[], raceTypes: PublicRace['race_type'][]): ElectionEventFamily {
  if (raceTypes.some((raceType) => nationalRaceTypes.has(raceType)) || elections.some((election) => election.election_type === 'presidential' || election.election_type === 'president' || election.election_type === 'legislative' || election.election_type === 'legislator')) {
    return 'national';
  }

  if (raceTypes.some((raceType) => localRaceTypes.has(raceType)) || elections.some((election) => ['local', 'local_chief', 'councilor', 'township_representative', 'village_chief'].includes(election.election_type))) {
    return 'local';
  }

  if (raceTypes.includes('referendum') || elections.some((election) => election.election_type === 'referendum')) {
    return 'referendum';
  }

  if (raceTypes.includes('recall') || elections.some((election) => election.election_type === 'recall')) {
    return 'recall';
  }

  if (elections.some((election) => election.election_type === 'by_election')) {
    return 'by_election';
  }

  return 'other';
}

function getInitialFamily(election: PublicElection) {
  if (['presidential', 'president', 'legislative', 'legislator'].includes(election.election_type)) return 'national';
  if (['local', 'local_chief', 'councilor', 'township_representative', 'village_chief'].includes(election.election_type)) return 'local';
  if (election.election_type === 'referendum') return 'referendum';
  if (election.election_type === 'recall') return 'recall';
  if (election.election_type === 'by_election') return 'by_election';
  return 'other';
}

function buildEventTitle(year: number | null, family: ElectionEventFamily, elections: PublicElection[], raceTypes: PublicRace['race_type'][]) {
  const yearLabel = year ? `${year}` : '未定年份';
  const categories = new Set(raceTypes.map((raceType) => getRaceCategoryByType(raceType).key));

  if (family === 'national') {
    const hasPresident = categories.has('presidential') || elections.some((election) => election.election_type === 'presidential' || election.election_type === 'president');
    const hasLegislator = categories.has('legislator') || elections.some((election) => election.election_type === 'legislative' || election.election_type === 'legislator');

    if (hasPresident && hasLegislator) {
      return `${yearLabel} 總統副總統及立法委員選舉`;
    }

    if (hasPresident) return `${yearLabel} 總統副總統選舉`;
    if (hasLegislator) return `${yearLabel} 立法委員選舉`;
  }

  if (family === 'local') return `${yearLabel} 地方公職人員選舉 / 九合一大選`;
  if (family === 'referendum') return `${yearLabel} 公民投票`;
  if (family === 'recall') return `${yearLabel} 罷免投票`;
  if (family === 'by_election') return `${yearLabel} 補選`;

  if (elections.length === 1) return elections[0].name;
  return `${yearLabel} 選舉事件`;
}

function getEventStatus(elections: PublicElection[]) {
  return elections.slice().sort((left, right) => statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status))[0]?.status ?? 'unknown';
}

function isNationalRace(race: PublicRace) {
  return ['president', 'vice_president', 'party_list_legislator', 'referendum'].includes(race.race_type) || ['全國', '臺灣', '台灣'].includes(race.region_name ?? '');
}

export function getRaceRegionGroup(race: PublicRace) {
  if (isNationalRace(race)) {
    return { key: 'national', label: '全國' };
  }

  const regionName = race.region_name ?? '未指定區域';
  const countyCityName = getElectionCountyCityName(regionName);

  if (countyCityName) {
    return { key: countyCityName, label: countyCityName };
  }

  return { key: regionName, label: regionName };
}

function groupRacesByRegion(races: PublicRace[]): ElectionEventRegion[] {
  const groups = new Map<string, ElectionEventRegion>();

  for (const race of races) {
    const region = getRaceRegionGroup(race);
    const group = groups.get(region.key) ?? { key: region.key, label: region.label, races: [] };
    group.races.push(race);
    groups.set(region.key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, races: group.races.slice().sort(compareRacesForDisplay) }))
    .sort((left, right) => compareElectionRegionLabels(left.label, right.label));
}

function finalizeEvent(elections: PublicElection[], allRaces: PublicRace[], allSummaries: PublicElectionRaceSummary[]): ElectionEvent {
  const electionIds = new Set(elections.map((election) => election.election_id));
  const races = allRaces.filter((race) => electionIds.has(race.election_id)).sort(compareRacesForDisplay);
  const summaries = allSummaries.filter((summary) => electionIds.has(summary.election_id));
  const raceTypes = Array.from(new Set([
    ...races.map((race) => race.race_type),
    ...summaries.flatMap((summary) => summary.race_types),
  ]));
  const family = getEventFamily(elections, raceTypes);
  const year = elections.map(getDisplayElectionYear).find((value): value is number => value !== null) ?? null;
  const votingDate = elections.map((election) => election.voting_date).find((value): value is string => Boolean(value)) ?? null;
  const categoryGroups = groupRacesByCategory(races);
  const summaryCategories = Array.from(new Map(raceTypes.map((raceType) => {
    const category = getRaceCategoryByType(raceType);
    return [category.key, category] as const;
  })).values()).sort((left, right) => left.order - right.order);
  const regionGroups = groupRacesByRegion(races);

  return {
    key: buildElectionEventKey(year, votingDate, family),
    title: buildEventTitle(year, family, elections, raceTypes),
    year,
    votingDate,
    family,
    status: getEventStatus(elections),
    elections: elections.slice().sort((left, right) => left.name.localeCompare(right.name, 'zh-TW')),
    races,
    raceCount: races.length > 0 ? races.length : summaries.reduce((total, summary) => total + summary.race_count, 0),
    categorySummary: summarizeLabels(summaryCategories.map((category) => category.label), '尚未接入選舉項目'),
    regionSummary: races.length > 0 ? summarizeLabels(regionGroups.map((group) => group.label), '未指定區域', 3) : '進入查看區域',
    sourceNameSummary: summarizeLabels(uniqueValues(elections.map((election) => election.name)), '公開選舉資料', 3),
    categoryGroups,
    regionGroups,
  };
}

export function buildElectionEventKey(year: number | null, votingDate: string | null, family: ElectionEventFamily) {
  return `${year ?? 'unknown'}-${votingDate ?? 'undated'}-${family}`;
}

export function buildElectionEvents(elections: PublicElection[], races: PublicRace[], raceSummaries: PublicElectionRaceSummary[] = []) {
  const groups = new Map<string, PublicElection[]>();

  for (const election of elections) {
    const year = getDisplayElectionYear(election);
    const key = buildElectionEventKey(year, election.voting_date, getInitialFamily(election));
    const group = groups.get(key) ?? [];
    group.push(election);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => finalizeEvent(group, races, raceSummaries))
    .sort((left, right) => {
      const leftUpcoming = ['active', 'upcoming', 'announced'].includes(left.status);
      const rightUpcoming = ['active', 'upcoming', 'announced'].includes(right.status);

      if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
      if (left.votingDate && right.votingDate && left.votingDate !== right.votingDate) {
        return leftUpcoming ? left.votingDate.localeCompare(right.votingDate) : right.votingDate.localeCompare(left.votingDate);
      }
      if (left.year !== right.year) return (right.year ?? 0) - (left.year ?? 0);
      return left.title.localeCompare(right.title, 'zh-TW');
    });
}

export function getElectionEventByKey(events: ElectionEvent[], eventKey: string) {
  return events.find((event) => event.key === eventKey) ?? null;
}

export function getElectionEventForRace(events: ElectionEvent[], race: PublicRace | null) {
  if (!race) return null;
  return events.find((event) => event.elections.some((election) => election.election_id === race.election_id)) ?? null;
}

export function filterEventRaces(event: ElectionEvent, categoryKey: string, regionKey: string) {
  return event.races.filter((race) => {
    const category = getRaceCategory(race);
    const region = getRaceRegionGroup(race);
    if (categoryKey && category.key !== categoryKey) return false;
    if (regionKey && region.key !== regionKey) return false;
    return true;
  });
}
