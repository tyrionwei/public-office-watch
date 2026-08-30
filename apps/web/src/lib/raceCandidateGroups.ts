import type { PublicCandidate, PublicRace } from '../types/publicViews';

export type CandidateIncumbencyBadge = {
  kind:
    | 'seeking_reelection'
    | 'reelected'
    | 'reelection_failed'
    | 'current_other_office'
    | 'former_other_office';
  office: string | null;
};

export type RaceCandidateGroup = {
  key: string;
  representative: PublicCandidate;
  members: PublicCandidate[];
  isElected: boolean;
  isIncumbent: boolean;
  incumbencyBadges: CandidateIncumbencyBadge[];
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

function candidateElectionOutcome(candidate: PublicCandidate) {
  if (candidate.election_result === 'elected') return 'elected';
  if (candidate.election_result === 'not_elected') return 'not_elected';
  return 'unknown';
}

export function getCandidateIncumbencyBadge(
  candidate: PublicCandidate,
  raceStatus: PublicRace['status'] | null | undefined,
): CandidateIncumbencyBadge | null {
  const officeAtElection = candidate.office_at_election?.trim() || null;
  const isCompleted = raceStatus === 'completed';
  const hasEnded = isCompleted || raceStatus === 'cancelled';
  const isOngoing = raceStatus !== null
    && raceStatus !== undefined
    && raceStatus !== 'unknown'
    && !hasEnded;

  if (officeAtElection) {
    if (hasEnded) return { kind: 'former_other_office', office: officeAtElection };
    if (isOngoing) return { kind: 'current_other_office', office: officeAtElection };
    return null;
  }

  if (candidate.is_incumbent !== true) return null;
  if (isOngoing) return { kind: 'seeking_reelection', office: null };
  if (!isCompleted) return null;

  const outcome = candidateElectionOutcome(candidate);
  if (outcome === 'elected') return { kind: 'reelected', office: null };
  if (outcome === 'not_elected') return { kind: 'reelection_failed', office: null };
  return null;
}

function preferredCandidate(current: PublicCandidate, candidate: PublicCandidate) {
  if (current.vote_count === null && candidate.vote_count !== null) return candidate;
  if (!candidateHasElectionResult(current) && candidateHasElectionResult(candidate)) return candidate;
  return current;
}

function groupFromMembers(
  key: string,
  ticketCandidates: PublicCandidate[],
  raceStatus: PublicRace['status'] | null | undefined,
): RaceCandidateGroup {
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
  const badgesByKey = new Map<string, CandidateIncumbencyBadge>();

  for (const member of members) {
    const badge = getCandidateIncumbencyBadge(member, raceStatus);
    if (!badge) continue;
    const badgeKey = badge.kind + ':' + (badge.office ?? '');
    if (!badgesByKey.has(badgeKey)) badgesByKey.set(badgeKey, badge);
  }

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
    incumbencyBadges: Array.from(badgesByKey.values()),
  };
}

export function groupRaceCandidates(
  candidates: PublicCandidate[],
  raceTitle: string | null | undefined,
  raceStatus?: PublicRace['status'] | null,
) {
  if (!isPresidentialTicketRace(raceTitle)) {
    return candidates.map((candidate) => groupFromMembers('candidate:' + candidate.candidate_id, [candidate], raceStatus));
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
    .map(([key, members]) => groupFromMembers('ticket:' + key, members, raceStatus))
    .sort((left, right) => {
      const numberDiff = candidateNumber(left.representative) - candidateNumber(right.representative);
      if (numberDiff !== 0) return numberDiff;
      return left.key.localeCompare(right.key, 'zh-TW');
    });
}
