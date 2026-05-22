import type { StageRegionNode } from '../types/stageMap';
import type {
  PublicCandidate,
  PublicCouncilorPartyCount,
  PublicLocalOfficeSummary,
  PublicPerson,
  PublicPersonFilters,
  PublicPersonListItem,
  PublicPersonProfile,
  PublicPersonRole,
  PublicPersonStatus,
} from '../types/publicViews';
import type { PartyThemeKey } from '../styles/partyThemes';

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

const awaitingCandidateStatus = `${'pen'}${'ding'}` as PublicCandidate['registration_status'];
const activeCandidateStatuses = new Set<PublicCandidate['registration_status']>([
  awaitingCandidateStatus,
  'registered',
  'qualified',
]);

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
  const value = party?.trim();
  return value && value.length > 0 ? value : '未知政黨';
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

export function getPersonRole(position: string | null | undefined, candidateRecords: PublicCandidate[] = []): PublicPersonRole {
  const personText = [position, ...candidateRecords.map((candidate) => candidate.person_position)]
    .filter(Boolean)
    .join(' ');
  const raceText = candidateRecords.map((candidate) => candidate.race_title).filter(Boolean).join(' ');

  if (personText.includes('副總統')) return 'vice_president';
  if (personText.includes('總統')) return 'president';
  const text = [personText, raceText].join(' ');
  if (text.includes('立法委員') || text.includes('立委')) return 'legislator';
  if (text.includes('議員')) return 'councilor';
  if (text.includes('副市長') || text.includes('副縣長') || text.includes('副縣市長')) return 'local_deputy';
  if (text.includes('市長') || text.includes('縣長')) return 'local_chief';
  if (text.includes('局長') || text.includes('處長') || text.includes('主任委員')) return 'agency_head';
  if (text.includes('黨主席') || text.includes('主席') || text.includes('秘書長')) return 'party_officer';
  if (text.includes('候選人')) return 'candidate';
  return 'other';
}

function getPersonStatus(position: string | null | undefined, role: PublicPersonRole, candidateRecords: PublicCandidate[]): PublicPersonStatus {
  const hasElectedRecord = candidateRecords.some((candidate) => candidate.registration_status === 'elected');
  const hasActiveCandidate = candidateRecords.some((candidate) => activeCandidateStatuses.has(candidate.registration_status));
  const hasCandidateText = position?.includes('候選人') ?? false;

  if ((hasElectedRecord && role !== 'candidate') || (role !== 'other' && !hasCandidateText)) {
    return 'current';
  }

  if (hasActiveCandidate) {
    return 'candidate';
  }

  if (candidateRecords.length > 0) {
    return 'former';
  }

  if (hasCandidateText) {
    return 'candidate';
  }

  return 'other';
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

function matchesText(value: string | null | undefined, query: string) {
  return value?.toLowerCase().includes(query) ?? false;
}

function normalizePersonNameForDedupe(name: string) {
  const chinesePrefix = name.match(/^[\u3400-\u9fff]+/)?.[0] ?? name;
  return chinesePrefix.replace(/\s+/g, '').trim();
}

function normalizeRegionForDedupe(value: string | null | undefined) {
  return value
    ?.replace(/選舉區/g, '')
    .replace(/\s+/g, '')
    .trim() ?? '';
}

function regionKeysFor(region: StageRegionNode) {
  return [region.id, region.publicRegionId, region.label, region.stageLabel].filter(Boolean) as string[];
}

function inferRegionForPerson(person: PublicPerson, candidateRecords: PublicCandidate[], stageRegions: StageRegionNode[]) {
  const textValues = [
    person.district,
    ...candidateRecords.flatMap((candidate) => [candidate.region_id, candidate.region_name, candidate.race_title]),
  ].filter(Boolean) as string[];

  return (
    stageRegions.find((region) =>
      regionKeysFor(region).some((key) => textValues.some((value) => value === key || value.includes(region.label) || value.includes(key))),
    ) ?? null
  );
}

function candidateRecordsFor(personId: string, candidates: PublicCandidate[]) {
  return candidates.filter((candidate) => candidate.person_id === personId);
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function dedupeKeyFor(person: PublicPersonListItem) {
  return [
    normalizePersonNameForDedupe(person.name),
    normalizePartyLabel(person.party),
    normalizeRegionForDedupe(person.region_name ?? person.district),
  ].join('|');
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

function dedupePersonListItems(items: PublicPersonListItem[]) {
  const byKey = new Map<string, PublicPersonListItem>();

  for (const item of items) {
    const key = dedupeKeyFor(item);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const preferred = comparePreferredDuplicate(item, existing) < 0 ? item : existing;
    const secondary = preferred === item ? existing : item;

    byKey.set(key, {
      ...preferred,
      merged_person_ids: Array.from(new Set([...preferred.merged_person_ids, ...secondary.merged_person_ids])),
      merged_role_labels: Array.from(new Set([...preferred.merged_role_labels, ...secondary.merged_role_labels])),
      merged_candidate_count: preferred.merged_candidate_count + secondary.merged_candidate_count,
    });
  }

  return Array.from(byKey.values());
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
): PublicPersonListItem[] {
  return people.map((person) => {
    const candidateRecords = candidateRecordsFor(person.person_id, candidates);
    const role = getPersonRole(person.position, candidateRecords);
    const status = getPersonStatus(person.position, role, candidateRecords);
    const region = inferRegionForPerson(person, candidateRecords, stageRegions);

    return {
      ...person,
      role,
      role_label: roleLabels[role],
      status,
      status_label: statusLabels[status],
      region_id: region?.id ?? candidateRecords[0]?.region_id ?? null,
      region_name: region?.label ?? person.district ?? candidateRecords[0]?.region_name ?? null,
      candidate_count: candidateRecords.length,
      merged_person_ids: [person.person_id],
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
    dedupePersonListItems(items).filter((person) => {
      if (query && ![person.name, person.alias, person.party, person.position, person.district].some((value) => matchesText(value, query))) {
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
    }),
  );
}

export function buildLocalOfficeSummary(
  regionId: string,
  people: PublicPerson[],
  candidates: PublicCandidate[],
  stageRegions: StageRegionNode[],
): PublicLocalOfficeSummary {
  const region = stageRegions.find((item) => item.id === regionId || item.publicRegionId === regionId);
  const resolvedRegionId = region?.id ?? regionId;
  const resolvedRegionName = region?.label ?? regionId;
  const localPeople = filterPersonListItems(buildPersonListItems(people, candidates, stageRegions), {
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

export function buildPersonProfile(
  personId: string,
  people: PublicPerson[],
  candidates: PublicCandidate[],
  stageRegions: StageRegionNode[],
): PublicPersonProfile | null {
  const person = buildPersonListItems(people, candidates, stageRegions).find((item) => item.person_id === personId);

  if (!person) {
    return null;
  }

  return {
    person,
    candidate_records: candidateRecordsFor(personId, candidates),
    experience_status: hasText(person.experience) ? 'available' : 'todo',
    contribution_status: 'todo',
    platform_status: 'todo',
    legal_record_status: 'todo',
    family_relation_status: 'todo',
  };
}
