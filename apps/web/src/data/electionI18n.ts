import type { Translate, TranslationKey } from '../i18n';
import type { ElectionEvent } from './electionEvents';

const electionTypeKeys: Record<string, TranslationKey> = {
  presidential: 'election.type.presidential',
  president: 'election.type.presidential',
  legislative: 'election.type.legislative',
  legislator: 'election.type.legislative',
  local: 'election.type.local',
  local_chief: 'election.type.localChief',
  councilor: 'election.type.councilor',
  township_representative: 'election.type.townshipRepresentative',
  village_chief: 'election.type.villageChief',
  recall: 'election.type.recall',
  referendum: 'election.type.referendum',
  by_election: 'election.type.byElection',
  other: 'election.type.other',
};

const electionStatusKeys: Record<string, TranslationKey> = {
  draft: 'election.status.draft',
  announced: 'election.status.announced',
  upcoming: 'election.status.upcoming',
  active: 'election.status.active',
  completed: 'election.status.completed',
  cancelled: 'election.status.cancelled',
  unknown: 'election.status.unknown',
};

const raceStatusKeys: Record<string, TranslationKey> = {
  draft: 'race.status.draft',
  announced: 'race.status.announced',
  upcoming: 'race.status.upcoming',
  registration_open: 'race.status.registrationOpen',
  candidates_announced: 'race.status.candidatesAnnounced',
  voting: 'race.status.voting',
  completed: 'race.status.completed',
  cancelled: 'race.status.cancelled',
  unknown: 'race.status.unknown',
};

const raceTypeKeys: Record<string, TranslationKey> = {
  president: 'race.type.president',
  vice_president: 'race.type.vicePresident',
  legislator: 'race.type.legislator',
  legislative_district: 'race.type.legislativeDistrict',
  party_list_legislator: 'race.type.partyListLegislator',
  municipality_mayor: 'race.type.municipalityMayor',
  county_mayor: 'race.type.countyMayor',
  local_chief: 'race.type.localChief',
  city_councilor: 'race.type.cityCouncilor',
  county_councilor: 'race.type.countyCouncilor',
  councilor_district: 'race.type.councilorDistrict',
  township_mayor: 'race.type.townshipMayor',
  township_representative: 'race.type.townshipRepresentative',
  township_representative_district: 'race.type.townshipRepresentativeDistrict',
  village_chief: 'race.type.villageChief',
  indigenous: 'race.type.indigenous',
  recall: 'race.type.recall',
  referendum: 'race.type.referendum',
  other: 'race.type.other',
};

const registrationStatusKeys: Record<string, TranslationKey> = {
  registered: 'registration.status.registered',
  qualified: 'registration.status.qualified',
  pending: 'registration.status.pending',
  elected: 'registration.status.elected',
  not_elected: 'registration.status.notElected',
  disqualified: 'registration.status.disqualified',
  withdrawn: 'registration.status.withdrawn',
  unknown: 'registration.status.unknown',
};

const raceCategoryKeys: Record<string, TranslationKey> = {
  presidential: 'race.category.presidential',
  local_chief: 'race.category.localChief',
  legislator: 'race.category.legislator',
  councilor: 'race.category.councilor',
  township_mayor: 'race.category.townshipMayor',
  township_representative: 'race.category.townshipRepresentative',
  village_chief: 'race.category.villageChief',
  referendum: 'race.category.referendum',
  recall: 'race.category.recall',
  indigenous: 'race.category.indigenous',
  other: 'race.category.other',
};

function translateMappedValue(value: string, keys: Record<string, TranslationKey>, t: Translate) {
  const key = keys[value];
  return key ? t(key) : value;
}

export function translateElectionType(type: string, t: Translate) {
  return translateMappedValue(type, electionTypeKeys, t);
}

export function translateElectionStatus(status: string, t: Translate) {
  return translateMappedValue(status, electionStatusKeys, t);
}

export function translateRaceStatus(status: string, t: Translate) {
  return translateMappedValue(status, raceStatusKeys, t);
}

export function translateRaceType(type: string, t: Translate) {
  return translateMappedValue(type, raceTypeKeys, t);
}

export function translateRegistrationStatus(status: string, t: Translate) {
  return translateMappedValue(status, registrationStatusKeys, t);
}

export function translateRaceCategory(category: string, t: Translate) {
  return translateMappedValue(category, raceCategoryKeys, t);
}

export function translateElectionEventTitle(event: ElectionEvent, t: Translate) {
  const year = event.year ?? t('elections.unknownYear');
  const categories = new Set(event.categoryKeys);

  if (event.family === 'national') {
    const hasPresident = categories.has('presidential');
    const hasLegislator = categories.has('legislator');
    if (hasPresident && hasLegislator) return t('event.title.nationalCombined', { year });
    if (hasPresident) return t('event.title.president', { year });
    if (hasLegislator) return t('event.title.legislator', { year });
  }

  if (event.family === 'local') return t('event.title.local', { year });
  if (event.family === 'referendum') return t('event.title.referendum', { year });
  if (event.family === 'recall') return t('event.title.recall', { year });
  if (event.family === 'by_election') return t('event.title.byElection', { year });
  if (event.elections.length === 1) return event.elections[0].name;
  return t('event.title.other', { year });
}
