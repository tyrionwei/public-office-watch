import { isActiveCandidacy, isCandidateElected } from '../data/electionI18n.ts';
import type { StageRegionNode } from '../types/stageMap.ts';
import type {
  PublicCandidate,
  PublicCouncilorPartyCount,
  PublicLocalOfficeSummary,
  PublicPerson,
  PublicPersonClaim,
  PublicPersonPartyAffiliation,
  PublicPersonTimelineItem,
  PublicPersonFilters,
  PublicPersonIdentityRecord,
  PublicPersonListItem,
  PublicPersonProfile,
  PublicPersonRole,
  PublicPersonStatus,
} from '../types/publicViews.ts';
import type { PartyThemeKey } from '../styles/partyThemes.ts';
import { canonicalPartyName } from './partyNames.ts';

const statusLabels: Record<PublicPersonStatus, string> = {
  current: '現任',
  candidate: '候選人',
  former: '曾參選',
  other: '其他',
};

const roleLabels: Record<PublicPersonRole, string> = {
  president: '總統',
  vice_president: '副總統',
  legislator: '立法委員',
  local_chief: '縣市首長',
  local_deputy: '副縣市首長',
  agency_head: '主要單位首長',
  councilor: '議員',
  party_officer: '政黨職務',
  candidate: '候選人',
  other: '其他公眾人物',
};

const statusRank: Record<PublicPersonStatus, number> = {
  current: 0,
  candidate: 1,
  former: 2,
  other: 3,
};

const roleRank: Record<PublicPersonRole, number> = {
  president: 0,
  vice_president: 1,
  legislator: 2,
  local_chief: 3,
  local_deputy: 4,
  councilor: 5,
  party_officer: 6,
  agency_head: 6,
  candidate: 7,
  other: 8,
};

const commonCompoundSurnames = [
  '歐陽',
  '司馬',
  '諸葛',
  '上官',
  '夏侯',
  '東方',
  '皇甫',
  '尉遲',
  '公孫',
  '司徒',
  '司空',
  '南宮',
  '宇文',
  '慕容',
  '令狐',
];

const surnameStrokeCounts: Record<string, number> = {
  丁: 2,
  刁: 2,
  王: 4,
  尹: 4,
  毛: 4,
  方: 4,
  文: 4,
  孔: 4,
  古: 5,
  史: 5,
  田: 5,
  白: 5,
  石: 5,
  朱: 6,
  江: 6,
  任: 6,
  伍: 6,
  吳: 7,
  李: 7,
  何: 7,
  呂: 7,
  宋: 7,
  沈: 7,
  邱: 8,
  林: 8,
  周: 8,
  金: 8,
  侯: 9,
  洪: 9,
  胡: 9,
  柯: 9,
  姚: 9,
  徐: 10,
  孫: 10,
  高: 10,
  馬: 10,
  袁: 10,
  張: 11,
  許: 11,
  梁: 11,
  郭: 11,
  曹: 11,
  陳: 11,
  黃: 12,
  曾: 12,
  彭: 12,
  游: 12,
  童: 12,
  楊: 13,
  葉: 13,
  董: 13,
  萬: 13,
  趙: 14,
  劉: 15,
  蔡: 15,
  鄭: 15,
  潘: 15,
  蕭: 16,
  賴: 16,
  謝: 17,
  鍾: 17,
  簡: 18,
  羅: 19,
  蘇: 19,
  顏: 18,
  魏: 18,
};

const strokeCollator = new Intl.Collator('zh-Hant-TW-u-co-stroke');
const fallbackCollator = new Intl.Collator('zh-Hant-TW');

export function normalizePartyLabel(party: string | null | undefined) {
  return canonicalPartyName(party) ?? '未知政黨';
}

export function getPartyChangeAffiliations(
  affiliations: PublicPersonPartyAffiliation[],
  currentParty: string | null | undefined,
) {
  const representativeByParty = new Map<string, PublicPersonPartyAffiliation>();

  for (const affiliation of affiliations) {
    if (affiliation.role_context === 'party_officer') continue;
    const partyName = canonicalPartyName(affiliation.party_name);
    if (partyName && !representativeByParty.has(partyName)) {
      representativeByParty.set(partyName, affiliation);
    }
  }

  const distinctParties = new Set(representativeByParty.keys());
  const normalizedCurrentParty = canonicalPartyName(currentParty);
  if (normalizedCurrentParty) distinctParties.add(normalizedCurrentParty);

  return distinctParties.size > 1
    ? Array.from(representativeByParty.values())
    : [];
}

function partyAffiliationYear(affiliation: PublicPersonPartyAffiliation) {
  if (affiliation.observed_year !== null) return affiliation.observed_year;

  for (const value of [affiliation.observed_date, affiliation.start_date, affiliation.end_date]) {
    const year = value?.match(/(?:19|20)\d{2}/)?.[0];
    if (year) return Number.parseInt(year, 10);
  }

  return null;
}

export function getPreviousPartyName(
  affiliations: PublicPersonPartyAffiliation[],
  candidateParty: string | null | undefined,
  electionYear: number | null | undefined,
) {
  const normalizedCandidateParty = canonicalPartyName(candidateParty);
  if (!normalizedCandidateParty || electionYear === null || electionYear === undefined) return null;

  const previousAffiliation = affiliations
    .filter((affiliation) => affiliation.role_context !== 'party_officer')
    .map((affiliation) => ({
      partyName: canonicalPartyName(affiliation.party_name),
      year: partyAffiliationYear(affiliation),
    }))
    .filter((item) => (
      item.partyName !== null
      && item.partyName !== normalizedCandidateParty
      && item.year !== null
      && item.year < electionYear
    ))
    .sort((left, right) => (right.year ?? Number.MIN_SAFE_INTEGER) - (left.year ?? Number.MIN_SAFE_INTEGER))[0];

  return previousAffiliation?.partyName ?? null;
}

export function toPartyThemeKey(partyLabel: string | null | undefined): PartyThemeKey {
  const label = normalizePartyLabel(partyLabel);
  if (label === '民主進步黨') return 'dpp';
  if (label === '中國國民黨') return 'kmt';
  if (label === '台灣民眾黨') return 'tpp';
  if (label === '時代力量') return 'npp';
  if (label === '親民黨') return 'pfp';
  if (label === '台灣基進') return 'tsp';
  if (label === '無黨籍') return 'independent';
  return 'unknown';
}

function getRoleFromText(text: string): PublicPersonRole {
  if (text.includes('副總統')) return 'vice_president';
  if (text.includes('總統')) return 'president';
  if (text.includes('立法委員') || text.includes('立委')) return 'legislator';
  if (text.includes('議員')) return 'councilor';
  if (text.includes('副市長') || text.includes('副縣長') || text.includes('副縣市長')) return 'local_deputy';
  if (text.includes('市長') || text.includes('縣長')) return 'local_chief';
  if (text.includes('局長') || text.includes('處長') || text.includes('主任委員')) return 'agency_head';
  if (text.includes('黨主席') || text.includes('主席') || text.includes('秘書長')) return 'party_officer';
  if (text.includes('候選人')) return 'candidate';
  return 'other';
}

function candidateRoleText(candidate: PublicCandidate) {
  return [candidate.race_title, candidate.person_position].filter(Boolean).join(' ');
}

function normalizeOfficeLabel(value: string | null | undefined) {
  return value
    ?.replace(/候選人/g, '')
    .replace(/選舉/g, '')
    .replace(/全國/g, '')
    .trim() || null;
}

function isOfficeLabel(value: string | null | undefined) {
  return Boolean(value && /總統|副總統|立法委員|立委|市長|縣長|議員/.test(value));
}

function candidateOfficeLabel(candidate: PublicCandidate) {
  const personPosition = normalizeOfficeLabel(candidate.person_position);

  if (isOfficeLabel(personPosition)) {
    return personPosition;
  }

  const raceTitle = normalizeOfficeLabel(candidate.race_title);

  if (isOfficeLabel(raceTitle)) {
    return raceTitle;
  }

  return personPosition;
}

function currentOfficeCandidateLabel(candidate: PublicCandidate) {
  const raceTitle = normalizeOfficeLabel(candidate.race_title);
  const personPosition = normalizeOfficeLabel(candidate.person_position);

  if (raceTitle?.includes('總統') && raceTitle.includes('副總統') && personPosition?.includes('副總統')) {
    return '副總統';
  }

  if (raceTitle?.includes('總統') && raceTitle.includes('副總統') && personPosition?.includes('總統')) {
    return '總統';
  }

  if (raceTitle?.includes('總統') && personPosition?.includes('副總統')) {
    return personPosition;
  }

  if (isOfficeLabel(raceTitle)) {
    return raceTitle;
  }

  if (isOfficeLabel(personPosition)) {
    return personPosition;
  }

  return raceTitle ?? personPosition;
}

function isCandidatePosition(value: string | null | undefined) {
  return Boolean(value && /候選人|參選|擬參選/.test(value));
}

function officeLabelMatchesRole(value: string, role: PublicPersonRole): boolean {
  if (role === 'president') return value.includes('總統') && !value.includes('副總統');
  if (role === 'vice_president') return value.includes('副總統');
  if (role === 'legislator') return value.includes('立法委員') || value.includes('立委');
  if (role === 'local_deputy') return value.includes('副市長') || value.includes('副縣長') || value.includes('副縣市長');
  if (role === 'local_chief') return (value.includes('市長') || value.includes('縣長')) && !officeLabelMatchesRole(value, 'local_deputy');
  if (role === 'agency_head') return value.includes('局長') || value.includes('處長') || value.includes('主任委員');
  if (role === 'councilor') return value.includes('議員');
  if (role === 'party_officer') return value.includes('黨主席') || value.includes('主席') || value.includes('秘書長');
  return true;
}

function displayRuleYear() {
  return new Date().getFullYear();
}

function isUpcomingElectionYear(year: number | null | undefined) {
  return typeof year === 'number' && year >= displayRuleYear();
}

export function getPersonDisplayPosition(
  person: Pick<PublicPersonListItem, 'display_position_label' | 'position'>,
  fallback = '公開人物資料',
) {
  return person.display_position_label ?? fallback;
}

export function getPersonRole(position: string | null | undefined, candidateRecords: PublicCandidate[] = []): PublicPersonRole {
  const currentOfficeCandidate = currentOfficeCandidateFor(candidateRecords);

  if (currentOfficeCandidate) {
    return getRoleFromText(currentOfficeCandidateLabel(currentOfficeCandidate) ?? candidateRoleText(currentOfficeCandidate));
  }

  const positionText = position?.trim() ?? '';

  if (positionText && !isCandidatePosition(positionText)) {
    return getRoleFromText(positionText);
  }

  const candidateText = candidateRecords.map(candidateRoleText).filter(Boolean).join(' ');
  return getRoleFromText([positionText, candidateText].filter(Boolean).join(' '));
}

function candidateElectionYear(candidate: PublicCandidate) {
  if (candidate.election_year !== null) return candidate.election_year;
  const text = [candidate.election_name, candidate.race_title].filter(Boolean).join(' ');
  const year = text.match(/(?:19|20)\d{2}/)?.[0];
  return year ? Number.parseInt(year, 10) : null;
}

export function getCandidateElectionLabel(candidate: PublicCandidate) {
  const year = candidateElectionYear(candidate);
  if (!year || candidate.election_name.includes(String(year))) return candidate.election_name;
  return `${year}年${candidate.election_name}`;
}

function compareCandidateRecordsNewestFirst(left: PublicCandidate, right: PublicCandidate) {
  const leftYear = candidateElectionYear(left) ?? Number.MIN_SAFE_INTEGER;
  const rightYear = candidateElectionYear(right) ?? Number.MIN_SAFE_INTEGER;
  if (leftYear !== rightYear) return rightYear - leftYear;
  return fallbackCollator.compare(left.race_title, right.race_title);
}

function isUpcomingCandidate(candidate: PublicCandidate) {
  return isActiveCandidacy(candidate) && isUpcomingElectionYear(candidateElectionYear(candidate));
}

function compareUpcomingCandidates(left: PublicCandidate, right: PublicCandidate) {
  const leftYear = candidateElectionYear(left) ?? Number.MAX_SAFE_INTEGER;
  const rightYear = candidateElectionYear(right) ?? Number.MAX_SAFE_INTEGER;
  if (leftYear !== rightYear) return leftYear - rightYear;

  const leftRole = getRoleFromText(candidateOfficeLabel(left) ?? candidateRoleText(left));
  const rightRole = getRoleFromText(candidateOfficeLabel(right) ?? candidateRoleText(right));
  const roleDiff = roleRank[leftRole] - roleRank[rightRole];
  if (roleDiff !== 0) return roleDiff;

  return fallbackCollator.compare(candidateRoleText(left), candidateRoleText(right));
}

function upcomingCandidateFor(candidateRecords: PublicCandidate[]) {
  return candidateRecords
    .filter(isUpcomingCandidate)
    .sort(compareUpcomingCandidates)[0] ?? null;
}

function upcomingCandidateLabelFor(candidateRecords: PublicCandidate[]) {
  const upcomingCandidate = upcomingCandidateFor(candidateRecords);
  return upcomingCandidate ? candidateOfficeLabel(upcomingCandidate) ?? candidateRoleText(upcomingCandidate) : null;
}

function compareCurrentOfficeCandidates(left: PublicCandidate, right: PublicCandidate) {
  const leftRole = getRoleFromText(currentOfficeCandidateLabel(left) ?? candidateRoleText(left));
  const rightRole = getRoleFromText(currentOfficeCandidateLabel(right) ?? candidateRoleText(right));
  const roleDiff = roleRank[leftRole] - roleRank[rightRole];
  if (roleDiff !== 0) return roleDiff;

  const leftYear = candidateElectionYear(left) ?? Number.MIN_SAFE_INTEGER;
  const rightYear = candidateElectionYear(right) ?? Number.MIN_SAFE_INTEGER;
  if (leftYear !== rightYear) return rightYear - leftYear;

  return fallbackCollator.compare(candidateRoleText(left), candidateRoleText(right));
}

function currentOfficeCandidateFor(candidateRecords: PublicCandidate[]) {
  return candidateRecords
    .filter(isLikelyCurrentElectedCandidate)
    .sort(compareCurrentOfficeCandidates)[0] ?? null;
}

function currentOfficeLabelFor(candidateRecords: PublicCandidate[]) {
  const currentOfficeCandidate = currentOfficeCandidateFor(candidateRecords);
  return currentOfficeCandidate ? currentOfficeCandidateLabel(currentOfficeCandidate) : null;
}

function isLikelyCurrentElectedCandidate(candidate: PublicCandidate) {
  const isElected = isCandidateElected(candidate);

  if (!isElected) {
    return false;
  }

  const year = candidateElectionYear(candidate);
  const text = [candidate.election_name, candidate.race_title, candidate.person_position].filter(Boolean).join(' ');

  if (!year) {
    return true;
  }

  if (/總統|副總統|立法委員|立委|不分區/.test(text)) {
    return year >= 2024;
  }

  if (/市長|縣長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表/.test(text)) {
    return year >= 2022;
  }

  return year >= 2024;
}

function getPersonStatus(
  position: string | null | undefined,
  role: PublicPersonRole,
  candidateRecords: PublicCandidate[],
  electionYear: number | null | undefined,
): PublicPersonStatus {
  const hasCurrentElectedRecord = candidateRecords.some(isLikelyCurrentElectedCandidate);
  const hasUpcomingCandidate = candidateRecords.some(isUpcomingCandidate);
  const hasUpcomingCandidateText = (position?.includes('候選人') ?? false) && isUpcomingElectionYear(electionYear);

  if (hasCurrentElectedRecord && role !== 'candidate') {
    return 'current';
  }

  if (hasUpcomingCandidate || hasUpcomingCandidateText) {
    return 'candidate';
  }

  if (candidateRecords.length > 0) {
    return 'former';
  }

  if (role !== 'other') {
    return 'current';
  }

  return 'other';
}

function regionRoleLabel(role: PublicPersonRole, roleLabel: string, regionName: string | null | undefined) {
  const regionPrefix = regionName && role !== 'president' && role !== 'vice_president' ? regionName : '';
  return regionPrefix + roleLabel;
}

function displayPositionLabelFor(
  person: PublicPerson,
  role: PublicPersonRole,
  roleLabel: string,
  status: PublicPersonStatus,
  currentOfficeLabel: string | null,
  upcomingCandidateLabel: string | null,
  regionName: string | null | undefined,
) {
  const position = person.position?.trim();

  if (status === 'current' && role !== 'candidate') {
    const officeLabel = currentOfficeLabel?.trim();

    if (officeLabel && officeLabelMatchesRole(officeLabel, role)) {
      return officeLabel;
    }

    if (position && !isCandidatePosition(position) && officeLabelMatchesRole(position, role)) {
      return position;
    }

    if (roleLabel !== '其他公眾人物') {
      return regionRoleLabel(role, roleLabel, regionName);
    }
  }

  if (upcomingCandidateLabel) {
    return upcomingCandidateLabel;
  }

  if (position && isCandidatePosition(position) && isUpcomingElectionYear(person.election_year)) {
    return position;
  }

  return null;
}

function surnameOf(name: string) {
  const compound = commonCompoundSurnames.find((surname) => name.startsWith(surname));
  return compound ?? name.slice(0, 1);
}

function compareNameByStroke(leftName: string, rightName: string) {
  const leftSurname = surnameOf(leftName);
  const rightSurname = surnameOf(rightName);
  const leftStroke = surnameStrokeCounts[leftSurname] ?? surnameStrokeCounts[leftSurname.slice(0, 1)] ?? Number.MAX_SAFE_INTEGER;
  const rightStroke = surnameStrokeCounts[rightSurname] ?? surnameStrokeCounts[rightSurname.slice(0, 1)] ?? Number.MAX_SAFE_INTEGER;

  if (leftStroke !== rightStroke) {
    return leftStroke - rightStroke;
  }

  const strokeResult = strokeCollator.compare(leftName, rightName);
  return strokeResult === 0 ? fallbackCollator.compare(leftName, rightName) : strokeResult;
}

function normalizeNameSearchText(value: string | null | undefined) {
  return value?.replace(/\s+/g, '').trim().toLowerCase() ?? '';
}

function matchesPersonName(name: string, query: string) {
  return normalizeNameSearchText(name).includes(normalizeNameSearchText(query));
}

function normalizePersonNameForDedupe(name: string) {
  const chinesePrefix = name.match(/^[\u3400-\u9fff]+/)?.[0] ?? name;
  return chinesePrefix.replace(/\s+/g, '').trim();
}

function regionKeysFor(region: StageRegionNode) {
  return [region.id, region.publicRegionId, region.label, region.stageLabel].filter(Boolean) as string[];
}

function findRegionByTextValues(textValues: string[], stageRegions: StageRegionNode[]) {
  return stageRegions.find((region) =>
    regionKeysFor(region).some((key) => textValues.some((value) => value === key || value.includes(region.label) || value.includes(key))),
  ) ?? null;
}

function isNationalCandidateRecord(candidate: PublicCandidate) {
  const text = [candidate.region_name, candidate.race_title].filter(Boolean).join(' ');
  return text.includes('全國') || text.includes('臺灣') || text.includes('台灣') || text.includes('總統');
}

function inferRegionForPerson(person: PublicPerson, candidateRecords: PublicCandidate[], stageRegions: StageRegionNode[]) {
  const personTextValues = [person.district, person.position].filter(Boolean) as string[];
  const personRegion = findRegionByTextValues(personTextValues, stageRegions);

  if (personRegion) {
    return personRegion;
  }

  const localCandidateTextValues = candidateRecords
    .filter((candidate) => !isNationalCandidateRecord(candidate))
    .flatMap((candidate) => [candidate.region_id, candidate.region_name, candidate.race_title])
    .filter(Boolean) as string[];
  const localCandidateRegion = findRegionByTextValues(localCandidateTextValues, stageRegions);

  if (localCandidateRegion) {
    return localCandidateRegion;
  }

  const candidateTextValues = candidateRecords
    .flatMap((candidate) => [candidate.region_id, candidate.region_name, candidate.race_title])
    .filter(Boolean) as string[];
  return findRegionByTextValues(candidateTextValues, stageRegions);
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function claimText(claim: PublicPersonClaim) {
  return claim.claim_value?.trim() || null;
}

function profileClaimsFor(personIds: string[], claims: PublicPersonClaim[]) {
  return claims
    .filter((claim) => personIds.includes(claim.person_id))
    .sort((left, right) => {
      const scoreDiff = right.review_score - left.review_score;
      if (scoreDiff !== 0) return scoreDiff;
      return fallbackCollator.compare(left.claim_type, right.claim_type);
    });
}

function partyAffiliationsFor(personIds: string[], affiliations: PublicPersonPartyAffiliation[]) {
  return affiliations
    .filter((affiliation) => personIds.includes(affiliation.person_id))
    .sort((left, right) => {
      if (left.is_current !== right.is_current) return left.is_current ? -1 : 1;
      const leftYear = left.observed_year ?? Number.MIN_SAFE_INTEGER;
      const rightYear = right.observed_year ?? Number.MIN_SAFE_INTEGER;
      if (leftYear !== rightYear) return rightYear - leftYear;
      return fallbackCollator.compare(left.party_name, right.party_name);
    });
}

function timelineYearFromDate(value: string | null | undefined) {
  const year = value?.match(/(?:19|20)\d{2}/)?.[0];
  return year ? Number.parseInt(year, 10) : null;
}

function timelineYearForCandidate(candidate: PublicCandidate) {
  return candidateElectionYear(candidate) ?? timelineYearFromDate(candidate.election_name);
}

function timelineStatusForCandidate(candidate: PublicCandidate, isCurrentOffice: boolean): PublicPersonTimelineItem['status'] {
  if (isActiveCandidacy(candidate)) return 'candidate';
  if (isCurrentOffice) return 'current';
  return 'past';
}

function buildTimelineRecords(
  candidateRecords: PublicCandidate[],
  publicClaims: PublicPersonClaim[],
): PublicPersonTimelineItem[] {
  const currentOfficeCandidateId = currentOfficeCandidateFor(candidateRecords)?.candidate_id ?? null;
  const candidateItems: PublicPersonTimelineItem[] = candidateRecords.map((candidate) => {
    const isCurrentOffice = candidate.candidate_id === currentOfficeCandidateId;
    const isElected = isCandidateElected(candidate);
    return {
      id: 'candidate:' + candidate.candidate_id,
      year: timelineYearForCandidate(candidate),
      date: null,
      label: candidate.race_title,
      detail: [getCandidateElectionLabel(candidate), normalizePartyLabel(candidate.party), candidate.region_name].filter(Boolean).join(' · ') || null,
      category: isElected ? 'office' : 'candidacy',
      status: timelineStatusForCandidate(candidate, isCurrentOffice),
      source_name: candidate.source_name,
      source_url: candidate.source_url,
      confidence_level: candidate.source_name ? 'A' : null,
    };
  });

  const seenExperienceLabels = new Set<string>();
  const experienceItems: PublicPersonTimelineItem[] = publicClaims
    .filter((claim) => claim.claim_type === 'experience')
    .flatMap((claim) => (joinClaimTexts([claim], 'experience') ?? '').split(/[；;]/).map((item, index) => ({ claim, item, index })))
    .filter(({ item }) => {
      const label = item.trim();
      const normalizedLabel = label.replace(/\s+/g, '').replace(/[，,。．·・:：()（）]/g, '').toLowerCase();
      const year = timelineYearFromDate(label);

      if (label.length > 240) return false;
      if (!year || normalizedLabel === '政治人物' || /^politician$/i.test(normalizedLabel)) return false;
      if (/^(?:19|20)\d{2}年.*選舉/.test(normalizedLabel)) return false;
      if (seenExperienceLabels.has(normalizedLabel)) return false;

      seenExperienceLabels.add(normalizedLabel);
      return true;
    })
    .map(({ claim, item, index }) => ({
      id: 'experience:' + claim.claim_id + ':' + index,
      year: timelineYearFromDate(item),
      date: null,
      label: item.trim(),
      detail: null,
      category: 'experience',
      status: 'unknown',
      source_name: claim.source_name,
      source_url: claim.source_url,
      confidence_level: claim.confidence_level,
    }));

  return [...candidateItems, ...experienceItems]
    .sort((left, right) => {
      const leftYear = left.year ?? Number.MIN_SAFE_INTEGER;
      const rightYear = right.year ?? Number.MIN_SAFE_INTEGER;
      if (leftYear !== rightYear) return rightYear - leftYear;
      return fallbackCollator.compare(left.label, right.label);
    })
    .slice(0, 16);
}

function firstClaimText(claims: PublicPersonClaim[], claimType: PublicPersonClaim['claim_type']) {
  return claims.find((claim) => claim.claim_type === claimType && hasText(claim.claim_value))?.claim_value?.trim() ?? null;
}

function joinClaimTexts(claims: PublicPersonClaim[], claimType: PublicPersonClaim['claim_type']) {
  const values = claims
    .filter((claim) => claim.claim_type === claimType)
    .map(claimText)
    .filter(Boolean) as string[];

  return Array.from(new Set(values)).join('；') || null;
}

function structuredClaimText(claims: PublicPersonClaim[], claimType: PublicPersonClaim['claim_type']) {
  for (const claim of claims) {
    if (claim.claim_type !== claimType || !Array.isArray(claim.claim_json.items)) continue;
    const items = claim.claim_json.items
      .map((value) => typeof value === 'string' ? value.trim() : '')
      .filter(Boolean);
    if (items.length > 0) return Array.from(new Set(items)).join('；');
  }
  return null;
}

function genderFromClaimText(value: string | null | undefined): PublicPerson['gender'] {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) return null;
  if (normalized === 'female' || normalized === 'f' || normalized.includes('女')) return 'female';
  if (normalized === 'male' || normalized === 'm' || normalized.includes('男')) return 'male';
  if (normalized === 'unknown' || normalized.includes('未知')) return 'unknown';
  return null;
}

function applyClaimBackfill(person: PublicPerson, claims: PublicPersonClaim[]): PublicPerson {
  const genderClaim = genderFromClaimText(firstClaimText(claims, 'gender'));
  const structuredEducationClaim = structuredClaimText(claims, 'education');
  const structuredExperienceClaim = structuredClaimText(claims, 'experience');
  const educationClaim = joinClaimTexts(claims, 'education');
  const experienceClaim = joinClaimTexts(claims, 'experience');

  return {
    ...person,
    gender: person.gender && person.gender !== 'unknown' ? person.gender : genderClaim ?? person.gender,
    education: structuredEducationClaim ?? (hasText(person.education) ? person.education : educationClaim),
    experience: structuredExperienceClaim ?? (hasText(person.experience) ? person.experience : experienceClaim),
  };
}

function externalIdsForPerson(claims: PublicPersonClaim[]) {
  return Array.from(new Set(
    claims
      .filter((claim) => claim.claim_type === 'external_id')
      .flatMap((claim) => {
        const wikidataQid = typeof claim.claim_json.wikidataQid === 'string' ? `wikidata:${claim.claim_json.wikidataQid}` : null;
        return [claim.claim_value, wikidataQid].filter(Boolean) as string[];
      })
      .map((value) => value.trim())
      .filter(Boolean),
  )).sort();
}

function normalizeExternalIdForDedupe(value: string) {
  const normalized = value.trim();
  const wikidataQid = normalized.match(/^wikidata:(Q\d+)$/i)?.[1];
  return wikidataQid ? `wikidata:${wikidataQid.toUpperCase()}` : normalized.toLowerCase();
}

function dedupeKeysFor(person: PublicPersonListItem) {
  const keys = new Set<string>([
    ['name-party', normalizePersonNameForDedupe(person.name), normalizePartyLabel(person.party)].join('|'),
  ]);

  for (const externalId of person.external_ids) {
    keys.add(`external:${normalizeExternalIdForDedupe(externalId)}`);
  }

  return Array.from(keys);
}

function profileCompletenessScore(person: PublicPersonListItem) {
  return [
    person.position,
    person.district,
    person.gender && person.gender !== 'unknown' ? person.gender : null,
    person.education,
    person.experience,
    person.primary_photo_url,
  ].filter(Boolean).length + person.merged_candidate_count;
}

function comparePreferredDuplicate(left: PublicPersonListItem, right: PublicPersonListItem) {
  const statusDiff = statusRank[left.status] - statusRank[right.status];
  if (statusDiff !== 0) return statusDiff;

  const roleDiff = roleRank[left.role] - roleRank[right.role];
  if (roleDiff !== 0) return roleDiff;

  return profileCompletenessScore(right) - profileCompletenessScore(left);
}

function mergePersonListItems(left: PublicPersonListItem, right: PublicPersonListItem) {
  const preferred = comparePreferredDuplicate(left, right) < 0 ? left : right;
  const secondary = preferred === left ? right : left;

  return {
    ...preferred,
    current_office_label: preferred.current_office_label ?? secondary.current_office_label,
    display_position_label: preferred.display_position_label ?? secondary.display_position_label,
    external_ids: Array.from(new Set([...preferred.external_ids, ...secondary.external_ids])).sort(),
    merged_person_ids: Array.from(new Set([...preferred.merged_person_ids, ...secondary.merged_person_ids])),
    merged_role_labels: Array.from(new Set([...preferred.merged_role_labels, ...secondary.merged_role_labels])),
    merged_candidate_count: preferred.merged_candidate_count + secondary.merged_candidate_count,
  };
}

function dedupePersonListItems(items: PublicPersonListItem[]) {
  const byKey = new Map<string, PublicPersonListItem>();

  for (const item of items) {
    const matchingItems = Array.from(new Set(dedupeKeysFor(item).map((key) => byKey.get(key)).filter(Boolean))) as PublicPersonListItem[];

    let mergedItem = item;
    for (const existing of matchingItems) {
      mergedItem = mergePersonListItems(mergedItem, existing);
    }

    for (const [key, existing] of byKey.entries()) {
      if (matchingItems.includes(existing)) {
        byKey.delete(key);
      }
    }

    for (const key of dedupeKeysFor(mergedItem)) {
      byKey.set(key, mergedItem);
    }
  }

  return Array.from(new Set(byKey.values()));
}

function candidateRoleLabel(candidate: PublicCandidate) {
  const text = [candidate.person_position, candidate.race_title].filter(Boolean).join(' ');
  const role = getPersonRole(candidate.person_position, [candidate]);
  const label = roleLabels[role];

  if (label !== '其他公眾人物') {
    return label;
  }

  return text.includes('候選人') ? '候選人' : null;
}

function mergedRoleLabelsFor(roleLabel: string, candidateRecords: PublicCandidate[]) {
  const labels = new Set<string>([roleLabel]);

  for (const candidate of candidateRecords) {
    const label = candidateRoleLabel(candidate);
    if (label) {
      labels.add(label);
    }
  }

  return Array.from(labels);
}

export function buildPersonListItems(
  people: PublicPerson[],
  candidates: PublicCandidate[],
  stageRegions: StageRegionNode[],
  claims: PublicPersonClaim[] = [],
): PublicPersonListItem[] {
  const candidatesByPersonId = candidates.reduce<Map<string, PublicCandidate[]>>((recordsByPersonId, candidate) => {
    const records = recordsByPersonId.get(candidate.person_id) ?? [];
    records.push(candidate);
    recordsByPersonId.set(candidate.person_id, records);
    return recordsByPersonId;
  }, new Map<string, PublicCandidate[]>());
  const claimsByPersonId = claims.reduce<Map<string, PublicPersonClaim[]>>((recordsByPersonId, claim) => {
    const records = recordsByPersonId.get(claim.person_id) ?? [];
    records.push(claim);
    recordsByPersonId.set(claim.person_id, records);
    return recordsByPersonId;
  }, new Map<string, PublicPersonClaim[]>());

  return people.map((person) => {
    const personClaims = claimsByPersonId.get(person.person_id) ?? [];
    const enrichedPerson = applyClaimBackfill(person, personClaims);
    const candidateRecords = candidatesByPersonId.get(person.person_id) ?? [];
    const role = getPersonRole(enrichedPerson.position, candidateRecords);
    const status = getPersonStatus(enrichedPerson.position, role, candidateRecords, enrichedPerson.election_year);
    const region = inferRegionForPerson(enrichedPerson, candidateRecords, stageRegions);
    const roleLabel = roleLabels[role];
    const currentOfficeLabel = enrichedPerson.current_office_label ?? currentOfficeLabelFor(candidateRecords);
    const upcomingCandidateLabel = enrichedPerson.upcoming_candidate_label ?? upcomingCandidateLabelFor(candidateRecords);
    const regionName = region?.label ?? enrichedPerson.district ?? candidateRecords[0]?.region_name ?? null;

    return {
      ...enrichedPerson,
      role,
      role_label: roleLabel,
      status,
      status_label: statusLabels[status],
      current_office_label: currentOfficeLabel,
      upcoming_candidate_label: upcomingCandidateLabel,
      display_position_label: displayPositionLabelFor(enrichedPerson, role, roleLabel, status, currentOfficeLabel, upcomingCandidateLabel, regionName),
      region_id: region?.id ?? candidateRecords[0]?.region_id ?? null,
      region_name: regionName,
      candidate_count: candidateRecords.length,
      external_ids: externalIdsForPerson(personClaims),
      merged_person_ids: [enrichedPerson.person_id],
      merged_role_labels: mergedRoleLabelsFor(roleLabels[role], candidateRecords),
      merged_candidate_count: candidateRecords.length,
    };
  });
}

export function sortPersonListItems(items: PublicPersonListItem[]) {
  return items.slice().sort((left, right) => {
    const statusDiff = statusRank[left.status] - statusRank[right.status];
    if (statusDiff !== 0) return statusDiff;

    const roleDiff = roleRank[left.role] - roleRank[right.role];
    if (roleDiff !== 0) return roleDiff;

    return compareNameByStroke(left.name, right.name);
  });
}

export function filterPersonListItems(items: PublicPersonListItem[], filters: PublicPersonFilters = {}) {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return sortPersonListItems(
    dedupePersonListItems(items.filter((person) => {
      if (query && !matchesPersonName(person.name, query)) {
        return false;
      }

      if (filters.regionId && person.region_id !== filters.regionId && person.region_name !== filters.regionId) {
        return false;
      }

      if (filters.party && normalizePartyLabel(person.party) !== filters.party) {
        return false;
      }

      if (filters.role && person.role !== filters.role) {
        return false;
      }

      if (filters.status && person.status !== filters.status) {
        return false;
      }

      return true;
    })),
  );
}

function identityRecordsFor(personIds: string[], items: PublicPersonListItem[]): PublicPersonIdentityRecord[] {
  return items
    .filter((item) => personIds.includes(item.person_id))
    .map((item) => ({
      person_id: item.person_id,
      name: item.name,
      party: item.party,
      position: item.display_position_label,
      district: item.district,
      role_label: item.role_label,
      status_label: item.status_label,
    }));
}

export function buildLocalOfficeSummaryFromItems(
  regionId: string,
  items: PublicPersonListItem[],
  stageRegions: StageRegionNode[],
): PublicLocalOfficeSummary {
  const region = stageRegions.find((item) => item.id === regionId || item.publicRegionId === regionId);
  const resolvedRegionId = region?.id ?? regionId;
  const resolvedRegionName = region?.label ?? regionId;
  const localPeople = filterPersonListItems(items, {
    regionId: resolvedRegionId,
    status: 'current',
  });
  const chiefExecutive = localPeople.find((person) => person.role === 'local_chief') ?? null;
  const deputies = localPeople.filter((person) => person.role === 'local_deputy');
  const agencyHeads = localPeople.filter((person) => person.role === 'agency_head');
  const councilors = localPeople.filter((person) => person.role === 'councilor');
  const partyCounts = councilors.reduce<Map<string, number>>((counts, person) => {
    const party = normalizePartyLabel(person.party);
    counts.set(party, (counts.get(party) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const councilorPartyCounts: PublicCouncilorPartyCount[] = Array.from(partyCounts.entries())
    .map(([party, count]) => ({ party, count }))
    .sort((left, right) => right.count - left.count || fallbackCollator.compare(left.party, right.party));

  return {
    region_id: resolvedRegionId,
    region_name: resolvedRegionName,
    chief_executive: chiefExecutive,
    deputies,
    agency_heads: agencyHeads,
    councilor_party_counts: councilorPartyCounts,
    councilor_total: councilors.length,
    data_status: [
      {
        label: '縣市首長',
        status: chiefExecutive ? 'available' : 'todo',
        note: chiefExecutive ? '已由公開人物資料整理' : '尚未找到可公開的現任首長資料',
      },
      {
        label: '副首長',
        status: deputies.length > 0 ? 'available' : 'todo',
        note: deputies.length > 0 ? `已收錄 ${deputies.length} 位` : '地方政府名冊待同步',
      },
      {
        label: '主要單位首長',
        status: agencyHeads.length > 0 ? 'available' : 'todo',
        note: agencyHeads.length > 0 ? `已收錄 ${agencyHeads.length} 位` : '局處首長資料待同步',
      },
      {
        label: '議員',
        status: councilors.length > 0 ? 'available' : 'todo',
        note: councilors.length > 0 ? `已收錄 ${councilors.length} 位` : '尚未找到可公開的現任議員資料',
      },
    ],
  };
}

export function buildLocalOfficeSummary(
  regionId: string,
  people: PublicPerson[],
  candidates: PublicCandidate[],
  stageRegions: StageRegionNode[],
  claims: PublicPersonClaim[] = [],
): PublicLocalOfficeSummary {
  return buildLocalOfficeSummaryFromItems(
    regionId,
    buildPersonListItems(people, candidates, stageRegions, claims),
    stageRegions,
  );
}

export function buildPersonProfileFromItems(
  personId: string,
  allItems: PublicPersonListItem[],
  candidates: PublicCandidate[],
  claims: PublicPersonClaim[] = [],
  partyAffiliations: PublicPersonPartyAffiliation[] = [],
): PublicPersonProfile | null {
  const mergedItems = dedupePersonListItems(allItems);
  const person = mergedItems.find((item) => item.person_id === personId || item.merged_person_ids.includes(personId));

  if (!person) {
    return null;
  }

  const mergedPersonIds = person.merged_person_ids;
  const publicClaims = profileClaimsFor(mergedPersonIds, claims);
  const profilePartyAffiliations = partyAffiliationsFor(mergedPersonIds, partyAffiliations);
  const candidateRecords = candidates
    .filter((candidate) => mergedPersonIds.includes(candidate.person_id))
    .sort(compareCandidateRecordsNewestFirst);
  const enrichedPerson = applyClaimBackfill(person, publicClaims) as PublicPersonListItem;

  return {
    person: enrichedPerson,
    identity_records: identityRecordsFor(mergedPersonIds, allItems),
    candidate_records: candidateRecords,
    party_affiliations: profilePartyAffiliations,
    timeline_records: buildTimelineRecords(candidateRecords, publicClaims),
    public_claims: publicClaims,
    experience_status: hasText(enrichedPerson.experience) ? 'available' : 'todo',
    contribution_status: publicClaims.some((claim) => claim.claim_type === 'finance_summary') ? 'summary_only' : 'todo',
    platform_status: publicClaims.some((claim) => claim.claim_type === 'platform') ? 'available' : 'todo',
    legal_record_status: publicClaims.some((claim) => claim.claim_type === 'legal_case') ? 'review_required' : 'todo',
    family_relation_status: publicClaims.some((claim) => claim.claim_type === 'family_relation') ? 'review_required' : 'todo',
  };
}

export function buildPersonProfile(
  personId: string,
  people: PublicPerson[],
  candidates: PublicCandidate[],
  stageRegions: StageRegionNode[],
  claims: PublicPersonClaim[] = [],
  partyAffiliations: PublicPersonPartyAffiliation[] = [],
): PublicPersonProfile | null {
  return buildPersonProfileFromItems(
    personId,
    buildPersonListItems(people, candidates, stageRegions, claims),
    candidates,
    claims,
    partyAffiliations,
  );
}
