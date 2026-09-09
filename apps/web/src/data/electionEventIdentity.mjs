const nationalRaceTypes = new Set(['president', 'vice_president', 'legislator', 'legislative_district', 'party_list_legislator', 'indigenous']);
const localRaceTypes = new Set(['municipality_mayor', 'county_mayor', 'local_chief', 'city_councilor', 'county_councilor', 'councilor_district', 'township_mayor', 'township_representative', 'township_representative_district', 'village_chief']);

export function getDisplayElectionYear(election) {
  if (election.voting_date) {
    const year = Number.parseInt(election.voting_date.slice(0, 4), 10);
    if (Number.isFinite(year)) return year;
  }
  return election.year;
}

function getEventFamily(elections, raceTypes) {
  if (raceTypes.some(type => nationalRaceTypes.has(type)) || elections.some(election => ['presidential', 'president', 'legislative', 'legislator'].includes(election.election_type))) return 'national';
  if (raceTypes.some(type => localRaceTypes.has(type)) || elections.some(election => ['local', 'local_chief', 'councilor', 'township_representative', 'village_chief'].includes(election.election_type))) return 'local';
  if (raceTypes.includes('referendum') || elections.some(election => election.election_type === 'referendum')) return 'referendum';
  if (raceTypes.includes('recall') || elections.some(election => election.election_type === 'recall')) return 'recall';
  if (elections.some(election => election.election_type === 'by_election')) return 'by_election';
  return 'other';
}

function legacyLocalKind(election) {
  if (election.election_type === 'councilor') return 'councilor';
  if (election.election_type === 'township_representative') return 'township-representative';
  if (election.election_type === 'village_chief') return 'village-chief';
  return ['local', 'local_chief'].includes(election.election_type) ? null : election.election_type;
}

export function buildElectionEventKey(year, votingDate, family, discriminator = null) {
  const baseKey = `${year ?? 'unknown'}-${votingDate ?? 'undated'}-${family}`;
  return discriminator ? `${baseKey}-${discriminator}` : baseKey;
}

export function electionEventIdentity(elections, raceTypes = []) {
  const family = getEventFamily(elections, raceTypes);
  const year = elections.map(getDisplayElectionYear).find(value => value !== null) ?? null;
  const votingDate = elections.map(election => election.voting_date).find(Boolean) ?? null;
  const discriminator = family === 'local' && year !== null && year < 2014 ? legacyLocalKind(elections[0]) : null;
  return { family, year, votingDate, key: buildElectionEventKey(year, votingDate, family, discriminator) };
}

// Initial grouping intentionally uses election types, before race summaries refine the family.
export function initialElectionEventKey(election) {
  return electionEventIdentity([election]).key;
}
