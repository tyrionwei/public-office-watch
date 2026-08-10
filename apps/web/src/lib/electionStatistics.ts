import { getRaceRegionGroup } from '../data/electionEvents.ts';
import { isCandidateElected } from '../data/electionI18n.ts';
import type {
  PublicCandidate,
  PublicElectionEducationDistribution,
  PublicPartyElectionPerformance,
  PublicPerson,
  PublicPersonClaim,
  PublicRace,
} from '../types/publicViews.ts';
import { getEducationStatisticsDimension, getStatisticsPartyLabel } from './statisticsDimensions.ts';

export type ElectionPerformanceFilters = {
  raceTypes?: PublicRace['race_type'][];
  regionKey?: string;
};

export function buildPartyElectionPerformance(
  candidates: PublicCandidate[],
  races: PublicRace[],
  electionIds: string[],
  filters: ElectionPerformanceFilters = {},
): PublicPartyElectionPerformance[] {
  const electionIdSet = new Set(electionIds.filter(Boolean));
  const raceTypeSet = new Set(filters.raceTypes ?? []);
  const raceIds = new Set(races
    .filter((race) => electionIdSet.has(race.election_id))
    .filter((race) => raceTypeSet.size === 0 || raceTypeSet.has(race.race_type))
    .filter((race) => !filters.regionKey || getRaceRegionGroup(race).key === filters.regionKey)
    .map((race) => race.race_id));
  const groups = new Map<string, PublicPartyElectionPerformance>();

  for (const candidate of candidates) {
    if (!electionIdSet.has(candidate.election_id) || !raceIds.has(candidate.race_id)) continue;
    const partyName = getStatisticsPartyLabel(candidate.party ?? candidate.person_party) || '無黨籍';
    const group = groups.get(partyName) ?? {
      party_name: partyName,
      candidate_count: 0,
      elected_count: 0,
      pending_count: 0,
    };
    group.candidate_count += 1;
    if (isCandidateElected(candidate)) group.elected_count += 1;
    if (candidate.election_result === 'pending') group.pending_count += 1;
    groups.set(partyName, group);
  }

  return Array.from(groups.values()).sort((left, right) => (
    right.candidate_count - left.candidate_count
    || right.elected_count - left.elected_count
    || left.party_name.localeCompare(right.party_name, 'zh-Hant-TW')
  ));
}

export function collapsePartyElectionPerformance(
  rows: PublicPartyElectionPerformance[],
  maxRows = 10,
): PublicPartyElectionPerformance[] {
  if (rows.length <= maxRows || maxRows < 2) return rows;
  const visibleRows = rows.slice(0, maxRows - 1);
  const remainingRows = rows.slice(maxRows - 1);
  return [
    ...visibleRows,
    remainingRows.reduce<PublicPartyElectionPerformance>((summary, row) => ({
      party_name: '__other_parties__',
      candidate_count: summary.candidate_count + row.candidate_count,
      elected_count: summary.elected_count + row.elected_count,
      pending_count: summary.pending_count + row.pending_count,
    }), {
      party_name: '__other_parties__',
      candidate_count: 0,
      elected_count: 0,
      pending_count: 0,
    }),
  ];
}

const educationOrder: Record<PublicElectionEducationDistribution['education_key'], number> = {
  doctorate: 10,
  master: 20,
  university: 30,
  tertiary_unspecified: 40,
  junior_college: 50,
  high_school: 60,
  secondary_or_below: 70,
  other: 80,
  unknown: 90,
};

export function buildElectionEducationDistribution(
  candidates: PublicCandidate[],
  races: PublicRace[],
  people: PublicPerson[],
  claims: PublicPersonClaim[],
  electionIds: string[],
  filters: ElectionPerformanceFilters = {},
): PublicElectionEducationDistribution[] {
  const electionIdSet = new Set(electionIds.filter(Boolean));
  const raceTypeSet = new Set(filters.raceTypes ?? []);
  const raceIds = new Set(races
    .filter((race) => electionIdSet.has(race.election_id))
    .filter((race) => raceTypeSet.size === 0 || raceTypeSet.has(race.race_type))
    .filter((race) => !filters.regionKey || getRaceRegionGroup(race).key === filters.regionKey)
    .map((race) => race.race_id));
  const peopleById = new Map(people.map((person) => [person.person_id, person]));
  const educationClaimsByPersonId = new Map<string, string[]>();

  for (const claim of claims) {
    if (claim.claim_type !== 'education' || !claim.claim_value?.trim()) continue;
    const values = educationClaimsByPersonId.get(claim.person_id) ?? [];
    values.push(claim.claim_value.trim());
    educationClaimsByPersonId.set(claim.person_id, values);
  }

  const groups = new Map<string, PublicElectionEducationDistribution>();
  for (const candidate of candidates) {
    if (!electionIdSet.has(candidate.election_id) || !raceIds.has(candidate.race_id)) continue;
    const person = peopleById.get(candidate.person_id);
    const education = person?.education?.trim()
      || Array.from(new Set(educationClaimsByPersonId.get(candidate.person_id) ?? [])).join('；')
      || null;
    const dimension = getEducationStatisticsDimension(education);
    const group = groups.get(dimension.key) ?? {
      education_key: dimension.key,
      candidate_count: 0,
    };
    group.candidate_count += 1;
    groups.set(dimension.key, group);
  }

  return Array.from(groups.values()).sort((left, right) => (
    educationOrder[left.education_key] - educationOrder[right.education_key]
  ));
}
