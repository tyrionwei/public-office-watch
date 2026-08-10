import type { PublicPartyLegalStatistics, PublicPerson, PublicPersonClaim } from '../types/publicViews.ts';
import { getStatisticsPartyLabel } from './statisticsDimensions.ts';

export type LegalStatisticsKey =
  | 'final_conviction'
  | 'non_final_or_unspecified'
  | 'acquittal_only';

export type LegalStatisticsRecord = {
  recordType?: string | null;
  caseStage?: string | null;
};

export type PartyLegalCategory =
  | 'final_conviction'
  | 'non_final'
  | 'other'
  | 'acquittal';

const finalConvictionStages = new Set([
  'criminal_judgment_final',
  'historical_criminal_judgment_final',
  'historical_self_reported_conviction',
]);

const nonFinalStages = new Set([
  'criminal_judgment_non_final',
  'criminal_judgment_first_instance',
  'criminal_judgment_appellate_non_final',
  'acquitted_non_final',
]);

const finalNonConvictionStages = new Set([
  'acquitted_final',
  'criminal_acquittal_final',
  'non_prosecution',
]);

const acquittalStages = new Set([
  'acquitted_final',
  'acquitted_non_final',
  'criminal_acquittal_final',
]);

export const LEGAL_STATISTICS_TITLE_ZH_TW = '已確認刑事司法紀錄';

export const LEGAL_STATISTICS_SCOPE_NOTE_ZH_TW =
  '僅統計本站已完成身分與來源核對、目前公開的刑事司法紀錄；未收錄不代表無相關紀錄，數值可能隨後續查證與司法進度調整。';

export function getPersonLegalStatisticsKey(
  records: LegalStatisticsRecord[],
): LegalStatisticsKey | null {
  const criminalRecords = records.filter((record) => record.recordType === 'criminal');
  if (criminalRecords.length === 0) return null;

  if (criminalRecords.some((record) => finalConvictionStages.has(record.caseStage ?? ''))) {
    return 'final_conviction';
  }
  if (criminalRecords.some((record) => !acquittalStages.has(record.caseStage ?? ''))) {
    return 'non_final_or_unspecified';
  }
  return 'acquittal_only';
}

export function getPartyLegalCategory(
  record: LegalStatisticsRecord,
): PartyLegalCategory | null {
  if (record.recordType !== 'criminal') return null;
  const stage = record.caseStage ?? '';
  if (finalConvictionStages.has(stage)) return 'final_conviction';
  if (nonFinalStages.has(stage)) return 'non_final';
  if (finalNonConvictionStages.has(stage)) return 'acquittal';
  return 'other';
}

export function getPersonPartyLegalCategory(
  records: LegalStatisticsRecord[],
): PartyLegalCategory | null {
  const categories = records
    .map(getPartyLegalCategory)
    .filter((category): category is PartyLegalCategory => category !== null);
  if (categories.includes('final_conviction')) return 'final_conviction';
  if (categories.includes('non_final')) return 'non_final';
  if (categories.includes('other')) return 'other';
  if (categories.includes('acquittal')) return 'acquittal';
  return null;
}

export function buildPartyLegalStatistics(
  partyName: string,
  people: PublicPerson[],
  claims: PublicPersonClaim[],
): PublicPartyLegalStatistics {
  const canonicalParty = getStatisticsPartyLabel(partyName);
  const partyPeople = people.filter((person) => (
    getStatisticsPartyLabel(person.party) === canonicalParty
  ));
  const partyPersonIds = new Set(partyPeople.map((person) => person.person_id));
  const recordsByPersonId = new Map<string, LegalStatisticsRecord[]>();
  const recordCategories: PartyLegalCategory[] = [];

  for (const claim of claims) {
    if (!partyPersonIds.has(claim.person_id) || claim.claim_type !== 'legal_case') continue;
    const record = {
      recordType: typeof claim.claim_json.recordType === 'string'
        ? claim.claim_json.recordType
        : null,
      caseStage: typeof claim.claim_json.caseStage === 'string'
        ? claim.claim_json.caseStage
        : null,
    };
    const category = getPartyLegalCategory(record);
    if (!category) continue;
    recordsByPersonId.set(claim.person_id, [
      ...(recordsByPersonId.get(claim.person_id) ?? []),
      record,
    ]);
    recordCategories.push(category);
  }

  const peopleCategories = partyPeople.map((person) => (
    getPersonPartyLegalCategory(recordsByPersonId.get(person.person_id) ?? [])
  ));
  const countPeople = (category: PartyLegalCategory) => (
    peopleCategories.filter((value) => value === category).length
  );
  const countRecords = (category: PartyLegalCategory) => (
    recordCategories.filter((value) => value === category).length
  );
  const confirmedRecordPeople = peopleCategories.filter(Boolean).length;

  return {
    party_name: canonicalParty,
    total_people: partyPeople.length,
    final_conviction_people: countPeople('final_conviction'),
    non_final_people: countPeople('non_final'),
    other_record_people: countPeople('other'),
    acquittal_only_people: countPeople('acquittal'),
    no_confirmed_record_people: partyPeople.length - confirmedRecordPeople,
    confirmed_record_people: confirmedRecordPeople,
    record_count: recordCategories.length,
    final_conviction_records: countRecords('final_conviction'),
    non_final_records: countRecords('non_final'),
    other_records: countRecords('other'),
    acquittal_records: countRecords('acquittal'),
  };
}
