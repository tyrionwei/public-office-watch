import type { PublicCandidate } from '../types/publicViews';

export type RaceCandidateGroup = {
  key: string;
  representative: PublicCandidate;
  members: PublicCandidate[];
  isElected: boolean;
  isIncumbent: boolean;
};

export function isPresidentialTicketRace(raceTitle: string | null | undefined) {
  return Boolean(raceTitle?.includes('總統副總統'));
}

function candidateNumber(candidate: PublicCandidate) {
  const value = Number.parseInt(candidate.candidate_no ?? '', 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function ticketMemberRank(candidate: PublicCandidate) {
  if (candidate.person_position?.includes('副總統候選人')) return 1;
  if (candidate.person_position?.includes('總統候選人')) return 0;
  return 2;
}

function candidateHasElectionResult(candidate: PublicCandidate) {
  return candidate.is_elected !== null || candidate.election_result !== 'unknown';
}

function preferredCandidate(current: PublicCandidate, candidate: PublicCandidate) {
  if (current.vote_count === null && candidate.vote_count !== null) return candidate;
  if (!candidateHasElectionResult(current) && candidateHasElectionResult(candidate)) return candidate;
  return current;
}

function groupFromMembers(key: string, ticketCandidates: PublicCandidate[]): RaceCandidateGroup {
  const membersByPerson = new Map<string, PublicCandidate>();

  for (const candidate of ticketCandidates) {
    const memberKey = candidate.person_id || candidate.person_name;
    const current = membersByPerson.get(memberKey);
    membersByPerson.set(memberKey, current ? preferredCandidate(current, candidate) : candidate);
  }

  const members = Array.from(membersByPerson.values()).sort((left, right) => {
    const rankDiff = ticketMemberRank(left) - ticketMemberRank(right);
    if (rankDiff !== 0) return rankDiff;
    return left.person_name.localeCompare(right.person_name, 'zh-TW');
  });
  const representative = members.find((candidate) => candidate.vote_count !== null)
    ?? members.find(candidateHasElectionResult)
    ?? members[0];

  return {
    key,
    representative,
    members,
    isElected: members.some((candidate) => (
      candidate.is_elected === true
      || candidate.election_result === 'elected'
      || candidate.registration_status === 'elected'
    )),
    isIncumbent: members.some((candidate) => candidate.is_incumbent === true),
  };
}

export function groupRaceCandidates(candidates: PublicCandidate[], raceTitle: string | null | undefined) {
  if (!isPresidentialTicketRace(raceTitle)) {
    return candidates.map((candidate) => groupFromMembers(`candidate:${candidate.candidate_id}`, [candidate]));
  }

  const membersByTicket = new Map<string, PublicCandidate[]>();
  for (const candidate of candidates) {
    const key = [
      candidate.candidate_no?.trim() ?? '',
      (candidate.party ?? candidate.person_party)?.trim() ?? '',
    ].join('|');
    membersByTicket.set(key, [...(membersByTicket.get(key) ?? []), candidate]);
  }

  return Array.from(membersByTicket.entries())
    .map(([key, members]) => groupFromMembers(`ticket:${key}`, members))
    .sort((left, right) => {
      const numberDiff = candidateNumber(left.representative) - candidateNumber(right.representative);
      if (numberDiff !== 0) return numberDiff;
      return left.key.localeCompare(right.key, 'zh-TW');
    });
}
