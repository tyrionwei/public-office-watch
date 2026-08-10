export type LegalStatisticsKey =
  | 'final_conviction'
  | 'non_final_or_unspecified'
  | 'acquittal_only';

export type LegalStatisticsRecord = {
  recordType?: string | null;
  caseStage?: string | null;
};

const finalConvictionStages = new Set([
  'criminal_judgment_final',
  'historical_criminal_judgment_final',
  'historical_self_reported_conviction',
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
