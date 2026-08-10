import { getRaceCategoryByType, type RaceCategory } from '../data/electionLabels.ts';
import type { PublicRace } from '../types/publicViews.ts';
import { normalizePartyLabel } from './personData.ts';
import { educationProfileItems } from './profileResume.ts';

export type EducationStatisticsKey =
  | 'doctorate'
  | 'master'
  | 'university'
  | 'tertiary_unspecified'
  | 'junior_college'
  | 'high_school'
  | 'secondary_or_below'
  | 'other'
  | 'unknown';

export type EducationStatisticsDimension = {
  key: EducationStatisticsKey;
  label: string;
  order: number;
};

const educationDimensions: Record<EducationStatisticsKey, EducationStatisticsDimension> = {
  doctorate: { key: 'doctorate', label: '博士', order: 10 },
  master: { key: 'master', label: '碩士', order: 20 },
  university: { key: 'university', label: '大學', order: 30 },
  tertiary_unspecified: { key: 'tertiary_unspecified', label: '大專（未細分）', order: 40 },
  junior_college: { key: 'junior_college', label: '專科', order: 50 },
  high_school: { key: 'high_school', label: '高中職', order: 60 },
  secondary_or_below: { key: 'secondary_or_below', label: '高中職以下（未細分）', order: 70 },
  other: { key: 'other', label: '其他', order: 80 },
  unknown: { key: 'unknown', label: '未提供', order: 90 },
};

function normalizedEducationText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/台/g, '臺')
    .replace(/国/g, '國')
    .replace(/学/g, '學')
    .replace(/专/g, '專')
    .replace(/职/g, '職')
    .replace(/[\s;；,，、()[\]（）]+/gu, '')
    .toLocaleLowerCase('zh-TW');
}

export function getStatisticsPartyLabel(party: string | null | undefined) {
  const normalized = normalizePartyLabel(party);
  return normalized;
}

export function getStatisticsRaceCategory(raceType: PublicRace['race_type']): RaceCategory {
  return getRaceCategoryByType(raceType);
}

export function getEducationStatisticsDimension(
  education: string | null | undefined,
): EducationStatisticsDimension {
  const raw = education?.trim();
  if (!raw) return educationDimensions.unknown;

  const normalizedRaw = normalizedEducationText(raw);
  if (/高中職?以下/u.test(normalizedRaw)) return educationDimensions.secondary_or_below;
  if (/^(?:其他|不詳|未知|無資料)$/u.test(normalizedRaw)) return educationDimensions.other;
  if (/^大專(?:學歷)?$/u.test(normalizedRaw)) return educationDimensions.tertiary_unspecified;

  const items = educationProfileItems(raw);
  const normalized = normalizedEducationText(items.join('；') || raw);

  if (/博士|phd|doctorate/u.test(normalized)) return educationDimensions.doctorate;
  if (/碩士|研究所|master|emba|mba/u.test(normalized)) return educationDimensions.master;
  if (/大學|學院|學士|學系|university|college|bachelor/u.test(normalized)) return educationDimensions.university;
  if (/專科|工專|商專|醫專|護專|警專|五專|二專/u.test(normalized)) return educationDimensions.junior_college;
  if (/高中|高職|高級中學|職校/u.test(normalized)) return educationDimensions.high_school;
  if (/國中|國民中學|初中|國小|國民小學|小學/u.test(normalized)) return educationDimensions.secondary_or_below;
  return educationDimensions.other;
}

export function compareStatisticsDimensions(
  left: { order: number; label: string },
  right: { order: number; label: string },
) {
  return left.order - right.order || left.label.localeCompare(right.label, 'zh-TW');
}
