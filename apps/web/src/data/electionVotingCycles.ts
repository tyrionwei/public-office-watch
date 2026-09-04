import type { VotingRegionPreference } from '../votingRegion';

export type VotingCycleArea = {
  countyIds: readonly string[];
  districtIds?: readonly string[];
  villageNames?: readonly string[];
};

export type ElectionVotingCycle = {
  id: string;
  title: {
    'zh-TW': string;
    en: string;
  };
  votingDate: string;
  votingHours?: {
    startsAt: string;
    endsAt: string;
  };
  pollingPlaceStatus: 'not-announced' | 'lookup-available';
  pollingPlaceLookupUrl?: string;
  officialAnnouncementUrl?: string;
  scope:
    | { kind: 'nationwide' }
    | { kind: 'registered-areas'; areas: readonly VotingCycleArea[] };
};

export const electionVotingCycles: readonly ElectionVotingCycle[] = [
  {
    id: '2026-local-general-election-day',
    title: {
      'zh-TW': '2026 地方公職人員選舉',
      en: '2026 Local Elections',
    },
    votingDate: '2026-11-28',
    votingHours: {
      startsAt: '08:00',
      endsAt: '16:00',
    },
    pollingPlaceStatus: 'lookup-available',
    pollingPlaceLookupUrl: 'https://info.cec.gov.tw/vote2026/voteSearch/',
    officialAnnouncementUrl: 'https://web.cec.gov.tw/central/article/63625',
    scope: { kind: 'nationwide' },
  },
];

function matchesRegisteredArea(cycle: ElectionVotingCycle, preference: VotingRegionPreference) {
  if (cycle.scope.kind === 'nationwide') return true;

  return cycle.scope.areas.some((area) => {
    if (!area.countyIds.includes(preference.county.id)) return false;
    if (area.districtIds && (!preference.district || !area.districtIds.includes(preference.district.id))) return false;
    if (area.villageNames && (!preference.village || !area.villageNames.includes(preference.village.name))) return false;
    return true;
  });
}

export function selectNextElectionVotingCycle(
  preference: VotingRegionPreference,
  earliestDate: string,
  cycles: readonly ElectionVotingCycle[] = electionVotingCycles,
) {
  return cycles
    .filter((cycle) => cycle.votingDate >= earliestDate)
    .filter((cycle) => matchesRegisteredArea(cycle, preference))
    .sort((left, right) => left.votingDate.localeCompare(right.votingDate) || left.id.localeCompare(right.id))[0] ?? null;
}
